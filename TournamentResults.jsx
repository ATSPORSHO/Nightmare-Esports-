import { Fragment, useEffect, useState } from 'react'
import { Plus, Save, Trash2, Award } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { ErrorBox, Modal, Notice, Spinner } from '../../components/ui'
import { placementPoints } from '../../lib/points'
import { rank, totalOf } from '../../lib/tournament'

const two = (n) => String(Number(n) || 0).padStart(2, '0')

/**
 * Admin: enter results match by match.  Pick a round and group, press "New match", type each team's
 * placement and kills (placement points are automatic), save, then start the next match.
 * Every save re-adds all matches into the group's table (MP, WWCD, PP, KP, TP) that the leaderboard and the A4 report use.
 */
export default function TournamentResults({ tournament, onClose }) {
  const tid = tournament.id
  const rounds = useData(() => supabase.from('tournament_rounds').select('*').eq('tournament_id', tid).order('sort'), [tid])
  const groups = useData(() => supabase.from('tournament_groups').select('*').eq('tournament_id', tid).order('sort'), [tid])
  const gts = useData(() => supabase.from('tournament_group_teams').select('*').eq('tournament_id', tid), [tid])
  const teams = useData(() => supabase.from('tournament_teams').select('*').eq('tournament_id', tid), [tid])
  const matches = useData(() => supabase.from('tournament_matches').select('*').eq('tournament_id', tid).order('number'), [tid])
  const results = useData(async () => {
    const ms = await supabase.from('tournament_matches').select('id').eq('tournament_id', tid)
    const ids = (ms.data || []).map((m) => m.id)
    if (!ids.length) return { data: [] }
    return supabase.from('tournament_match_results').select('*').in('match_id', ids)
  }, [tid])

  const players = useData(() => supabase.from('tournament_team_players').select('*').order('sort'), [tid])
  const pstats = useData(async () => {
    const ms = await supabase.from('tournament_matches').select('id').eq('tournament_id', tid)
    const ids = (ms.data || []).map((m) => m.id)
    if (!ids.length) return { data: [] }
    return supabase.from('tmatch_player_stats').select('*').in('match_id', ids)
  }, [tid])
  const [rid, setRid] = useState(null)
  const [gid, setGid] = useState(null)
  const [mid, setMid] = useState(null)
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const R = rounds.data || []
  const G = groups.data || []
  const GT = gts.data || []
  const T = teams.data || []
  const M = matches.data || []
  const RES = results.data || []
  const PL = players.data || []
  const PS = pstats.data || []
  const teamById = Object.fromEntries(T.map((t) => [t.id, t]))
  const reloadAll = () => { matches.reload(); results.reload(); gts.reload(); pstats.reload() }

  const round = R.find((r) => r.id === rid) || R[R.length - 1] || null
  const gList = G.filter((g) => g.round_id === round?.id)
  const group = gList.find((g) => g.id === gid) || gList[0] || null
  const rows = group ? GT.filter((x) => x.group_id === group.id).sort((a, b) => (a.slot || 0) - (b.slot || 0)) : []
  const gMatches = group ? M.filter((m) => m.group_id === group.id).sort((a, b) => a.number - b.number) : []
  const match = gMatches.find((m) => m.id === mid) || gMatches[gMatches.length - 1] || null

  // load the saved numbers of the selected match into the form
  useEffect(() => {
    const d = {}
    if (match) {
      RES.filter((r) => r.match_id === match.id).forEach((r) => { d[r.team_id] = { placement: r.placement ?? '', kills: r.kills ?? 0, sel: {} } })
      PS.filter((x) => x.match_id === match.id).forEach((x) => { const e = (d[x.team_id] ||= { placement: '', kills: 0, sel: {} }); (e.sel ||= {})[x.player_id] = x.kills ?? 0 })
    }
    setDraft(d)
    setMsg(''); setErr('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, results.data, pstats.data])

  const setCell = (teamId, k, v) => setDraft((d) => ({ ...d, [teamId]: { ...(d[teamId] || {}), [k]: v } }))
  // players who played: toggle (max 4) and type their eliminations; team kills = sum of player kills when typed
  const togglePlayer = (teamId, pid) => setDraft((d) => {
    const cur = { ...(d[teamId]?.sel || {}) }
    if (pid in cur) delete cur[pid]
    else { if (Object.keys(cur).length >= 4) { setErr('Only 4 players can play a match. Untick one first.'); return d } cur[pid] = 0 }
    return { ...d, [teamId]: { ...(d[teamId] || {}), sel: cur } }
  })
  const setPlayerKills = (teamId, pid, v) => setDraft((d) => ({ ...d, [teamId]: { ...(d[teamId] || {}), sel: { ...(d[teamId]?.sel || {}), [pid]: v } } }))
  const playerSum = (teamId) => Object.values(draft[teamId]?.sel || {}).reduce((t, v) => t + (Number(v) || 0), 0)
  const teamKills = (teamId) => (playerSum(teamId) > 0 ? playerSum(teamId) : Number(draft[teamId]?.kills) || 0)

  /** re-add every saved match of this group into the group table */
  const recompute = async (groupId) => {
    const ms = await supabase.from('tournament_matches').select('id').eq('group_id', groupId)
    const ids = (ms.data || []).map((m) => m.id)
    const rs = ids.length ? await supabase.from('tournament_match_results').select('*').in('match_id', ids) : { data: [] }
    if (rs.error) throw rs.error
    const agg = {}
    ;(rs.data || []).forEach((r) => {
      if (r.placement == null) return
      const a = (agg[r.team_id] ||= { mp: 0, wwcd: 0, place_pts: 0, kill_pts: 0 })
      a.mp += 1
      if (r.placement === 1) a.wwcd += 1
      a.place_pts += placementPoints(r.placement)
      a.kill_pts += Number(r.kills) || 0
    })
    const fresh = await supabase.from('tournament_group_teams').select('*').eq('group_id', groupId)
    if (fresh.error) throw fresh.error
    const ups = await Promise.all((fresh.data || []).map((x) => {
      const a = { ...(agg[x.team_id] || { mp: 0, wwcd: 0, place_pts: 0, kill_pts: 0 }) }
      a.wwcd += Number(x.cd_extra) || 0   // chicken dinners added by hand
      return supabase.from('tournament_group_teams').update(a).eq('id', x.id)
    }))
    const bad = ups.find((u) => u.error)
    if (bad) throw bad.error
  }

  const newMatch = async () => {
    if (!group) return
    setBusy(true); setErr(''); setMsg('')
    const number = (gMatches[gMatches.length - 1]?.number || 0) + 1
    const { data, error } = await supabase.from('tournament_matches').insert({ tournament_id: tid, group_id: group.id, number }).select('id').single()
    setBusy(false)
    if (error) return setErr(error.message)
    await matches.reload()
    setMid(data.id)
  }

  const saveMatch = async () => {
    if (!match) return
    setErr(''); setMsg('')
    const entered = rows.map((x) => ({ team_id: x.team_id, placement: Number(draft[x.team_id]?.placement), kills: teamKills(x.team_id), sel: draft[x.team_id]?.sel || {}, has: draft[x.team_id]?.placement !== '' && draft[x.team_id]?.placement != null }))
    const played = entered.filter((e) => e.has)
    if (played.some((e) => !Number.isInteger(e.placement) || e.placement < 1 || e.placement > 25)) return setErr('Placement must be a whole number from 1 to 25.')
    const seen = new Set()
    for (const e of played) { if (seen.has(e.placement)) return setErr(`Two teams have placement ${e.placement}. Each placement can be used once per match.`); seen.add(e.placement) }
    if (!played.length) return setErr('Enter at least one placement.')
    setBusy(true)
    try {
      const del = await supabase.from('tournament_match_results').delete().eq('match_id', match.id)
      if (del.error) throw del.error
      const ins = await supabase.from('tournament_match_results').insert(played.map((e) => ({ match_id: match.id, team_id: e.team_id, placement: e.placement, kills: e.kills })))
      if (ins.error) throw ins.error
      const dp = await supabase.from('tmatch_player_stats').delete().eq('match_id', match.id)
      const prow = played.flatMap((e) => Object.entries(e.sel).map(([player_id, k]) => ({ match_id: match.id, team_id: e.team_id, player_id, kills: Number(k) || 0 })))
      if (prow.length) {
        const ip = await supabase.from('tmatch_player_stats').insert(prow)
        if (dp.error || ip.error) throw new Error(`Match saved, but the players could not be saved: ${(dp.error || ip.error).message} (run supabase/match-players.sql once in Supabase)`)
      }
      await recompute(group.id)
      setMsg(`Match ${match.number} saved. Totals updated.`)
      reloadAll()
    } catch (e) { setErr(e.message || String(e)) }
    setBusy(false)
  }

  const deleteMatch = async () => {
    if (!match || !window.confirm(`Delete Match ${match.number} and its results?`)) return
    setBusy(true); setErr('')
    try {
      const del = await supabase.from('tournament_matches').delete().eq('id', match.id)
      if (del.error) throw del.error
      await recompute(group.id)
      setMid(null); reloadAll()
    } catch (e) { setErr(e.message || String(e)) }
    setBusy(false)
  }

  /** add chicken dinners by hand for a team (on top of the ones counted from 1st placements) */
  const setExtraCd = async (x, v) => {
    const n = Math.max(0, Math.floor(Number(v) || 0))
    if (n === (Number(x.cd_extra) || 0)) return
    setBusy(true); setErr(''); setMsg('')
    try {
      const u = await supabase.from('tournament_group_teams').update({ cd_extra: n }).eq('id', x.id)
      if (u.error) throw new Error(/cd_extra/.test(u.error.message) ? 'Run supabase/cd-extra.sql once in Supabase (SQL Editor), then try again.' : u.error.message)
      await recompute(group.id)
      reloadAll()
    } catch (e) { setErr(e.message || String(e)) }
    setBusy(false)
  }

  const markQualified = async () => {
    if (!group) return
    setBusy(true); setErr(''); setMsg('')
    const n = Number(group.qualify) || 0
    const top = rank(rows).slice(0, n).map((x) => x.id)
    const a = await supabase.from('tournament_group_teams').update({ qualified: false }).eq('group_id', group.id)
    const b = top.length ? await supabase.from('tournament_group_teams').update({ qualified: true }).in('id', top) : { error: null }
    setBusy(false)
    if (a.error || b.error) return setErr((a.error || b.error).message)
    setMsg(`Top ${n} teams marked as qualified.`)
    reloadAll()
  }

  const loading = rounds.loading || groups.loading || gts.loading || teams.loading || matches.loading
  const board = rank(rows)
  const maxMp = Math.max(0, ...rows.map((x) => x.mp || 0))
  const live = (teamId) => {
    const p = Number(draft[teamId]?.placement)
    return Number.isInteger(p) && p >= 1 ? placementPoints(p) : null
  }

  return (
    <Modal title={`Match results — ${tournament.title}`} onClose={onClose} wide>
      {loading ? <Spinner /> : !G.length ? (
        <div className="py-8 text-center text-sm text-slate-400">Draw the groups first (Teams &amp; groups), then come back to enter the match results.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label>
              <span className="label">Round</span>
              <select className="input" value={round?.id || ''} onChange={(e) => { setRid(e.target.value); setGid(null); setMid(null) }}>
                {R.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {gList.map((g) => (
                <button key={g.id} onClick={() => { setGid(g.id); setMid(null) }} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${group?.id === g.id ? 'border-accent bg-accent/15 text-white' : 'border-ink-600 text-slate-300'}`}>{g.name}</button>
              ))}
            </div>
          </div>

          {group && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Matches:</span>
                {gMatches.map((m) => (
                  <button key={m.id} onClick={() => setMid(m.id)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${match?.id === m.id ? 'border-accent bg-accent text-white' : 'border-ink-600 text-slate-300'}`}>Match {m.number}</button>
                ))}
                <button className="btn-primary btn-sm" disabled={busy} onClick={newMatch}><Plus size={14} /> New match</button>
                <span className="ml-auto rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-slate-300">Total matches played: <b className="text-white">{gMatches.length}</b></span>
              </div>

              {match ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">{group.name} · Match {match.number}</div>
                    <div className="text-[11px] text-slate-500">Placement points: 1st=10, 2nd=6, 3rd=5, 4th=4, 5th=3, 6th=2, 7th–8th=1, then 0. Kill = 1 point. Leave placement empty if a team did not play. Tick the players who played (max 4) and type their eliminations: team kills become their sum.</div>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-ink-700">
                    <table className="w-full text-sm">
                      <thead className="bg-ink-950 text-[11px] uppercase tracking-wider text-slate-400">
                        <tr><th className="px-3 py-2 text-left">Slot</th><th className="px-3 py-2 text-left">Team</th><th className="px-2 py-2">Placement</th><th className="px-2 py-2">Kills</th><th className="px-2 py-2">PP</th><th className="px-2 py-2">Match pts</th></tr>
                      </thead>
                      <tbody>
                        {rows.map((x) => {
                          const t = teamById[x.team_id]
                          const pp = live(x.team_id)
                          const tp = PL.filter((p) => p.team_id === x.team_id)
                          const sel = draft[x.team_id]?.sel || {}
                          return (
                            <Fragment key={x.id}>
                            <tr className="border-t border-ink-700/60">
                              <td className="px-3 py-1.5 text-slate-400">{x.slot}</td>
                              <td className="px-3 py-1.5"><span className="flex items-center gap-2">{t?.logo_url && <img src={t.logo_url} alt="" className="h-6 w-6 object-contain" />}<span className={t?.is_ours ? 'font-semibold text-white' : ''}>{t?.name}</span></span></td>
                              <td className="px-2 py-1.5 text-center"><input className="input !w-16 !px-1 !py-0.5 text-center" type="number" min="1" max="25" value={draft[x.team_id]?.placement ?? ''} onChange={(e) => setCell(x.team_id, 'placement', e.target.value)} /></td>
                              <td className="px-2 py-1.5 text-center"><input className="input !w-16 !px-1 !py-0.5 text-center" type="number" min="0" disabled={playerSum(x.team_id) > 0} title={playerSum(x.team_id) > 0 ? 'Sum of the player eliminations below' : ''} value={playerSum(x.team_id) > 0 ? playerSum(x.team_id) : (draft[x.team_id]?.kills ?? '')} onChange={(e) => setCell(x.team_id, 'kills', e.target.value)} /></td>
                              <td className="px-2 py-1.5 text-center text-slate-300">{pp ?? '—'}</td>
                              <td className="px-2 py-1.5 text-center font-semibold text-white">{pp == null ? '—' : pp + teamKills(x.team_id)}</td>
                            </tr>
                            {tp.length > 0 && (
                              <tr>
                                <td />
                                <td colSpan={5} className="px-3 pb-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-500">Played ({Object.keys(sel).length}/4)</span>
                                    {tp.map((p) => {
                                      const on = p.id in sel
                                      return (
                                        <span key={p.id} className={`flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-xs ${on ? 'border-accent bg-accent/15 text-white' : 'border-ink-600 text-slate-400'}`}>
                                          <button type="button" onClick={() => togglePlayer(x.team_id, p.id)} className="flex items-center gap-1" title={on ? 'Click to remove' : 'Click: this player played'}>
                                            {p.photo_url ? <img src={p.photo_url} alt="" className="h-5 w-5 rounded-full object-cover" /> : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-700 text-[9px] font-bold">{p.name.slice(0, 1)}</span>}
                                            {p.name}
                                          </button>
                                          {on && <input type="number" min="0" title="Eliminations" placeholder="K" className="input !w-12 !px-1 !py-0 text-center text-xs" value={sel[p.id] ?? 0} onChange={(e) => setPlayerKills(x.team_id, p.id, e.target.value)} />}
                                        </span>
                                      )
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button className="btn-primary" disabled={busy} onClick={saveMatch}><Save size={15} /> Save Match {match.number}</button>
                    <button className="btn-ghost text-red-300" disabled={busy} onClick={deleteMatch}><Trash2 size={14} /> Delete this match</button>
                    <span className="text-xs text-slate-500">After saving, press “New match” to enter the next one.</span>
                  </div>
                </div>
              ) : <div className="rounded-lg border border-dashed border-ink-600 py-6 text-center text-sm text-slate-400">No matches yet. Press <b>New match</b> to start entering results.</div>}

              <ErrorBox>{err}</ErrorBox>
              {msg && <Notice>{msg}</Notice>}

              {/* running totals */}
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white">Total standings · {maxMp} match{maxMp === 1 ? '' : 'es'} played</div>
                  <button className="btn-ghost btn-sm" disabled={busy || !board.length} onClick={markQualified}><Award size={13} /> Mark top {group.qualify} as qualified</button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-ink-700">
                  <table className="w-full text-sm">
                    <thead className="bg-ink-950 text-[11px] uppercase tracking-wider text-slate-400">
                      <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Team</th><th className="px-2 py-2" title="Matches played">MP</th><th className="px-2 py-2" title="Winner Winner Chicken Dinner (from 1st places + the ones you add)">CD</th><th className="px-2 py-2" title="Add chicken dinners by hand">+ CD</th><th className="px-2 py-2" title="Placement points">PP</th><th className="px-2 py-2" title="Kill points">KP</th><th className="px-2 py-2" title="Total points">TP</th></tr>
                    </thead>
                    <tbody>
                      {board.map((x, i) => (
                        <tr key={x.id} className="border-t border-ink-700/60">
                          <td className={`px-3 py-1.5 font-bold ${x.qualified ? 'text-emerald-300' : 'text-slate-400'}`}>{i + 1}</td>
                          <td className="px-3 py-1.5">{teamById[x.team_id]?.name}{x.qualified && <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">QUALIFIED</span>}</td>
                          <td className="px-2 py-1.5 text-center">{x.mp || 0}</td>
                          <td className="px-2 py-1.5 text-center">{x.wwcd || 0}</td>
                          <td className="px-2 py-1.5 text-center"><input key={`${x.id}-${x.cd_extra || 0}`} className="input !w-14 !px-1 !py-0.5 text-center" type="number" min="0" defaultValue={x.cd_extra || 0} disabled={busy} onBlur={(e) => setExtraCd(x, e.target.value)} /></td>
                          <td className="px-2 py-1.5 text-center">{x.place_pts || 0}</td>
                          <td className="px-2 py-1.5 text-center">{x.kill_pts || 0}</td>
                          <td className="px-2 py-1.5 text-center font-bold text-white">{two(totalOf(x))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

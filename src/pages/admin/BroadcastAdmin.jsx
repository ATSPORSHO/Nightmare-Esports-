import { useEffect, useRef, useState } from 'react'
import { Radio, Copy, Undo2, RotateCcw, Square, Minus, Plus, Play, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { Card, ErrorBox, Field, Notice, Spinner } from '../../components/ui'
import ImageField from '../../components/ImageField'
import LiveScorecard from '../../components/LiveScorecard'
import { computeRows, LIVE_THEMES, WWCD_THEMES } from '../../lib/live'
import { placementPoints } from '../../lib/points'

const linkOf = (id, theme) => `${window.location.origin}${window.location.pathname}#/live/${id}${theme ? `?theme=${theme}` : ''}`

/**
 * Broadcast: every session gets its own link. While it is live the scorecard updates by itself on the link.
 * Automatic = one-click buttons (kill +1, Eliminate), placement and points are worked out for you.
 * Manual = you type kills / placement / point adjustments yourself.
 * End = the live data is deleted from the broadcast, the match result is saved into the tournament Results.
 */
export default function BroadcastAdmin() {
  const tours = useData(() => supabase.from('tournaments').select('id, title, logo_url').order('start_date', { ascending: false }))
  const sessions = useData(() => supabase.from('tbroadcast_sessions').select('*').eq('status', 'live').order('created_at', { ascending: false }))
  const [openId, setOpenId] = useState(null)
  const [msg, setMsg] = useState('')
  const open = (sessions.data || []).find((s) => s.id === openId)

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Create a broadcast session, copy its link into OBS (Browser Source) or open it in a browser, and run the scorecard from here. When you press <b>End</b> the live data disappears from the link and the match result is saved automatically into the tournament <b>Results</b>, ready for the A4 report.</p>
      {msg && <Notice>{msg}</Notice>}
      {open
        ? <Control key={open.id} session={open} onClose={() => setOpenId(null)} onEnded={(m) => { setMsg(m); setOpenId(null); sessions.reload() }} />
        : (
          <>
            <NewSession tours={tours.data || []} onCreated={(id) => { sessions.reload(); setOpenId(id) }} />
            <Card title="Live sessions" icon={Radio}>
              {sessions.loading ? <Spinner /> : !(sessions.data || []).length ? <div className="py-4 text-center text-sm text-slate-500">No live session. Create one above.</div> : (
                <ul className="divide-y divide-ink-700/60">
                  {sessions.data.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                      <div className="min-w-[160px] flex-1"><div className="font-medium text-white">{s.title}</div><div className="text-xs text-slate-500">{s.mode === 'auto' ? 'Automatic' : 'Manual'} · {(s.state?.teams || []).length} teams · started {new Date(s.created_at).toLocaleString('en-GB')}</div></div>
                      <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(linkOf(s.id, s.theme))}><Copy size={13} /> Copy link</button>
                      <button className="btn-primary btn-sm" onClick={() => setOpenId(s.id)}><Play size={13} /> Open controls</button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
    </div>
  )
}

function NewSession({ tours, onCreated }) {
  const [tid, setTid] = useState('')
  const [rid, setRid] = useState('')
  const [gid, setGid] = useState('')
  const [mode, setMode] = useState('auto')
  const [theme, setTheme] = useState('blue')
  const [title, setTitle] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const rounds = useData(() => (tid ? supabase.from('tournament_rounds').select('*').eq('tournament_id', tid).order('sort') : Promise.resolve({ data: [] })), [tid])
  const groups = useData(() => (tid ? supabase.from('tournament_groups').select('*').eq('tournament_id', tid).order('sort') : Promise.resolve({ data: [] })), [tid])
  const R = rounds.data || []
  const G = (groups.data || []).filter((g) => !rid || g.round_id === rid)
  const group = G.find((g) => g.id === gid)

  const create = async () => {
    setErr('')
    if (!tid || !group) return setErr('Choose the tournament and the group first.')
    setBusy(true)
    const gt0 = await supabase.from('tournament_group_teams').select('team_id, slot, place_pts, kill_pts, wwcd, mp').eq('group_id', group.id)
    const gt = { data: (gt0.data || []).map((x) => ({ ...x, base: { pp: Number(x.place_pts) || 0, kills: Number(x.kill_pts) || 0, wwcd: Number(x.wwcd) || 0, mp: Number(x.mp) || 0 } })) }
    const ids = (gt.data || []).map((x) => x.team_id)
    const tm = ids.length ? await supabase.from('tournament_teams').select('*').in('id', ids) : { data: [] }
    const pq = ids.length ? await supabase.from('tournament_team_players').select('id, team_id, name, photo_url').in('team_id', ids).order('sort') : { data: [] }
    const playersOf = {}
    ;(pq.data || []).forEach((p) => { (playersOf[p.team_id] ||= []).push({ key: p.id, id: p.id, name: p.name || '', photo: p.photo_url || '', kills: 0, total: 0 }) })
    const baseOf = Object.fromEntries((gt.data || []).map((x) => [x.team_id, x.base]))
    const slotOf = Object.fromEntries((gt.data || []).map((x) => [x.team_id, x.slot || 99]))
    const teams = (tm.data || []).sort((a, b) => slotOf[a.id] - slotOf[b.id]).map((t) => ({ id: t.id, name: t.name, tag: t.tag || '', logo: t.logo_url || '', photo: t.photo_url || '', base: baseOf[t.id] || { pp: 0, kills: 0, wwcd: 0, mp: 0 }, country: t.country || '', kills: 0, placement: null, adj: 0, pl: ['a', 'a', 'a', 'a'], players: playersOf[t.id] || [] }))
    if (!teams.length) { setBusy(false); return setErr('This group has no teams yet.') }
    const tr0 = tours.find((t) => t.id === tid)
    const ttl = tr0?.title
    const mc = await supabase.from('tournament_matches').select('number').eq('group_id', group.id).order('number', { ascending: false }).limit(1)
    const { data, error } = await supabase.from('tbroadcast_sessions').insert({
      tournament_id: tid, group_id: group.id, title: title.trim() || `${ttl} · ${group.name}`, mode, theme, state: { teams, history: [], group: group.name, scene: 'live', info: { tournament: ttl || '', logo: tr0?.logo_url || '', match: String((mc.data?.[0]?.number || 0) + 1), map: '' } },
    }).select('id').single()
    setBusy(false)
    if (error) return setErr(/tbroadcast_sessions|schema cache/i.test(error.message) ? 'Run supabase/broadcast.sql once in Supabase (SQL Editor), then try again.' : error.message)
    onCreated(data.id)
  }

  return (
    <Card title="New broadcast session" icon={Radio}>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Tournament"><select className="input" value={tid} onChange={(e) => { setTid(e.target.value); setRid(''); setGid('') }}><option value="">— choose —</option>{tours.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></Field>
        <Field label="Round"><select className="input" value={rid} onChange={(e) => { setRid(e.target.value); setGid('') }} disabled={!tid}><option value="">All rounds</option>{R.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        <Field label="Group (its teams play this match)"><select className="input" value={gid} onChange={(e) => setGid(e.target.value)} disabled={!tid}><option value="">— choose —</option>{G.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
        <Field label="Title on the scorecard (optional)"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nightmare Invitational · Group A · Match 1" /></Field>
        <Field label="Theme"><select className="input" value={theme} onChange={(e) => setTheme(e.target.value)}>{Object.entries(LIVE_THEMES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></Field>
        <Field label="Broadcast mode">
          <div className="flex overflow-hidden rounded-lg border border-ink-600">
            {[['auto', 'Automatic'], ['manual', 'Manual']].map(([k, l]) => <button type="button" key={k} onClick={() => setMode(k)} className={`flex-1 px-3 py-2 text-sm font-semibold ${mode === k ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-700'}`}>{l}</button>)}
          </div>
        </Field>
      </div>
      <p className="mt-2 text-[11px] text-slate-500"><b>Automatic:</b> click “+1 kill” and “Eliminate”; placements and points are worked out for you (alive teams already count the placement points they are guaranteed). <b>Manual:</b> you type kills, placement and point adjustments yourself. You can switch while live.</p>
      <ErrorBox>{err}</ErrorBox>
      <div className="mt-3"><button className="btn-primary" disabled={busy} onClick={create}><Radio size={15} /> {busy ? 'Creating…' : 'Create session & get link'}</button></div>
    </Card>
  )
}

/** Number box that only changes the live scoreboard when you press Enter (Esc cancels). */
function EnterNum({ value, onCommit, className = '', ...rest }) {
  const [d, setD] = useState(null)
  const shown = d ?? (value ?? '')
  return <input {...rest} type="number" className={`${className} ${d !== null ? '!border-amber-400' : ''}`} value={shown}
    onChange={(e) => setD(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter') { onCommit(d ?? shown); setD(null); e.target.blur() } if (e.key === 'Escape') { setD(null); e.target.blur() } }}
    onBlur={() => setD(null)} title="Type, then press Enter to send to the live scoreboard" />
}

/** Match overlay: tournament name + logo, match number, map. Sent to the live scoreboard when you press Apply. */
function InfoEditor({ info, onApply }) {
  const [d, setD] = useState({ tournament: '', logo: '', match: '', map: '', ...info })
  const dirty = JSON.stringify({ tournament: '', logo: '', match: '', map: '', ...info }) !== JSON.stringify(d)
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Match overlay (shown above the scorecard)</div>
      <div className="grid gap-3 md:grid-cols-[1fr_110px_1fr_200px]">
        <Field label="Tournament name"><input className="input" value={d.tournament} onChange={(e) => setD({ ...d, tournament: e.target.value })} /></Field>
        <Field label="Match no."><input className="input" value={d.match} onChange={(e) => setD({ ...d, match: e.target.value })} /></Field>
        <Field label="Map name"><input className="input" list="bc-maps" value={d.map} onChange={(e) => setD({ ...d, map: e.target.value })} placeholder="Erangel" /><datalist id="bc-maps">{['Erangel', 'Miramar', 'Rondo', 'Sanhok', 'Vikendi', 'Livik', 'Karakin'].map((m) => <option key={m} value={m} />)}</datalist></Field>
        <ImageField label="Tournament logo" folder="tournament" value={d.logo || null} onChange={(v) => setD({ ...d, logo: v || '' })} />
      </div>
      <button className={`mt-2 ${dirty ? 'btn-primary' : 'btn-ghost'} btn-sm`} disabled={!dirty} onClick={() => onApply(d)}>{dirty ? 'Apply to live scoreboard' : 'Applied ✓'}</button>
    </div>
  )
}

const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }

/** "Starting soon" countdown: pick the match start time (or press +5 / +10 / +15 / +30 min). */
function Countdown({ startAt, onSet }) {
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-ink-700 bg-ink-950 p-2">
      <Field label="Match starts at (countdown on “Starting soon”)"><input type="datetime-local" className="input" value={toLocalInput(startAt)} onChange={(e) => onSet(e.target.value ? new Date(e.target.value).toISOString() : '')} /></Field>
      {[5, 10, 15, 30].map((m) => <button key={m} className="btn-ghost btn-sm" onClick={() => onSet(new Date(Date.now() + m * 60000).toISOString())}>+{m} min</button>)}
      {startAt && <button className="btn-ghost btn-sm text-red-300" onClick={() => onSet('')}>Clear</button>}
    </div>
  )
}

const SCENES = [['starting', 'Starting soon'], ['teams', 'Participating teams'], ['live', 'Live match'], ['scoreboard', 'Live scoreboard'], ['h2h', 'Head to head'], ['mvp', 'MVP list']]

function PlayersPanel({ team, onAdd, onEdit, onDel }) {
  const [nm, setNm] = useState('')
  return (
    <div className="space-y-1 border-t border-ink-700/60 bg-ink-950 px-4 py-2">
      {(team.players || []).map((p) => (
        <div key={p.key} className="flex flex-wrap items-center gap-2 text-sm">
          <input className="input !w-44 !py-0.5" defaultValue={p.name} onBlur={(e) => e.target.value.trim() !== p.name && onEdit(p.key, { name: e.target.value.trim() })} />
          <button className="btn-ghost btn-sm !px-2" onClick={() => onEdit(p.key, { kills: Math.max(0, (Number(p.kills) || 0) - 1) })}><Minus size={12} /></button>
          <span className="w-8 text-center font-display text-lg font-extrabold text-white">{Number(p.kills) || 0}</span>
          <button className="btn-primary btn-sm !px-2" onClick={() => onEdit(p.key, { kills: (Number(p.kills) || 0) + 1 })}><Plus size={12} /> kill</button>
          {(Number(p.total) || 0) > 0 && <span className="text-[11px] text-slate-500">earlier matches: {p.total}</span>}
          <button className="ml-auto text-xs text-red-300" onClick={() => onDel(p.key)}>remove</button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <input className="input !w-44 !py-0.5" placeholder="Add player name" value={nm} onChange={(e) => setNm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { onAdd(nm); setNm('') } }} />
        <button className="btn-ghost btn-sm" onClick={() => { onAdd(nm); setNm('') }}>Add</button>
      </div>
    </div>
  )
}

function Control({ session, onClose, onEnded }) {
  const [st, setSt] = useState(session.state || { teams: [], history: [] })
  const [mode, setMode] = useState(session.mode)
  const [theme, setTheme] = useState(session.theme)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)
  const latest = useRef({ st, mode, theme })
  latest.current = { st, mode, theme }

  // push every change to the live link (small delay so fast clicks are sent together)
  const dirty = useRef(false)
  const [sync, setSync] = useState('ok') // ok | sending | error
  const push = (delay = 250) => {
    dirty.current = true
    setSync('sending')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const { st: s, mode: m, theme: t } = latest.current
      const { error } = await supabase.from('tbroadcast_sessions').update({ state: s, mode: m, theme: t, updated_at: new Date().toISOString() }).eq('id', session.id)
      if (error) { setErr(error.message); setSync('error') } else { setErr(''); dirty.current = false; setSync('ok') }
    }, delay)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  const update = (fn, delay) => { setSt((o) => fn(o)); push(delay) }

  const alive = st.teams.filter((t) => t.placement == null || t.placement === '').length
  const patch = (id, p) => update((o) => ({ ...o, teams: o.teams.map((t) => (t.id === id ? { ...t, ...p } : t)) }))
  const setPlayers = (tid, fn) => update((o) => ({ ...o, teams: o.teams.map((t) => (t.id === tid ? { ...t, players: fn(t.players || []) } : t)) }))
  const addPlayer = (tid, name) => name.trim() && setPlayers(tid, (L) => [...L, { key: `g${Date.now()}${L.length}`, id: null, name: name.trim(), kills: 0, total: 0 }])
  const editPlayer = (tid, key, patch) => setPlayers(tid, (L) => L.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  const delPlayer = (tid, key) => setPlayers(tid, (L) => L.filter((p) => p.key !== key))
  const scene = st.scene || 'live'
  const setScene = (k) => update((o) => ({ ...o, scene: k }), 30)   // scene changes go out immediately
  const wwcdOn = (o) => ({ ...o, wwcd: { on: true, key: Date.now() } })
  const wwcdOff = (o) => ({ ...o, wwcd: { on: false, key: o.wwcd?.key } })
  const kill = (id, d) => patch(id, { kills: Math.max(0, (Number(st.teams.find((t) => t.id === id).kills) || 0) + d) })
  const [pend, setPend] = useState(null) // { id, value } — rank typed when eliminating
  const eliminate = (id, rank) => update((o0) => { const o = Number(rank) === 2 && o0.wwcdAuto !== false ? wwcdOn(o0) : o0; return { ...o, teams: o.teams.map((t) => (t.id === id ? { ...t, placement: Number(rank) || alive, pl: ['d', 'd', 'd', 'd'] } : t)), history: [...(o.history || []), id] } })
  const undo = () => update((o) => {
    const h = [...(o.history || [])]; const last = h.pop()
    if (!last) return o
    const undone = o.teams.find((t) => t.id === last)
    const base = { ...o, history: h, teams: o.teams.map((t) => (t.id === last ? { ...t, placement: null, pl: ['a', 'a', 'a', 'a'] } : t)) }
    return Number(undone?.placement) === 2 ? wwcdOff(base) : base
  })
  const reset = () => { if (window.confirm('Reset kills, eliminations and adjustments for all teams?')) update((o) => wwcdOff({ ...o, history: [], teams: o.teams.map((t) => ({ ...t, kills: 0, placement: null, adj: 0, pl: ['a', 'a', 'a', 'a'], players: (t.players || []).map((p) => ({ ...p, kills: 0 })) })) })) }
  const setMd = (m) => { setMode(m); push() }
  const setTh = (t) => { setTheme(t); push() }
  const link = linkOf(session.id, theme)

  const [note, setNote] = useState('')
  const warnRef = useRef('')
  const baseRef = useRef({}) // team id -> running totals after the last upload (kept when the scoreboard is reset)
  const [openT, setOpenT] = useState(null)
  const active = st.teams.some((t) => (Number(t.kills) || 0) > 0 || !(t.placement == null || t.placement === ''))

  /** write this match into the tournament Results (so the A4 reports show it) and refresh the group totals */
  const saveResult = async () => {
    if (!session.group_id || !session.tournament_id) throw new Error('This session is not linked to a tournament group.')
    // teams still alive at the end get the best placements, ordered by kills
    const teams = st.teams.map((t) => ({ ...t, kills: Number(t.kills) || 0 }))
    teams.filter((t) => t.placement == null || t.placement === '').sort((a, b) => b.kills - a.kills).forEach((t, i) => { t.placement = i + 1 })
    // placements must be unique: if two teams share one, order by placement then kills and renumber
    const used = teams.map((t) => Number(t.placement))
    if (new Set(used).size !== used.length) [...teams].sort((a, b) => a.placement - b.placement || b.kills - a.kills).forEach((t, i) => { t.placement = i + 1 })

    const gm = await supabase.from('tournament_matches').select('number').eq('group_id', session.group_id).order('number', { ascending: false }).limit(1)
    const number = (gm.data?.[0]?.number || 0) + 1
    const m = await supabase.from('tournament_matches').insert({ tournament_id: session.tournament_id, group_id: session.group_id, number }).select('id').single()
    if (m.error) throw m.error
    const ins = await supabase.from('tournament_match_results').insert(teams.map((t) => ({ match_id: m.data.id, team_id: t.id, placement: Number(t.placement), kills: t.kills })))
    if (ins.error) { await supabase.from('tournament_matches').delete().eq('id', m.data.id); throw ins.error }

    // player kills (kept apart from the scoreboard) feed the MVP list of the A4 report
    const prow = st.teams.flatMap((t) => (t.players || []).filter((p) => p.id && (Number(p.kills) || 0) > 0).map((p) => ({ match_id: m.data.id, team_id: t.id, player_id: p.id, kills: Number(p.kills) })))
    warnRef.current = ''
    if (prow.length) { const ip = await supabase.from('tmatch_player_stats').insert(prow); if (ip.error) warnRef.current = ` (Player kills could not be saved for the MVP report: ${ip.error.message} — run supabase/match-players.sql once.)` }
    baseRef.current = {}
    const ms = await supabase.from('tournament_matches').select('id').eq('group_id', session.group_id)
    const ids = (ms.data || []).map((x) => x.id)
    const rs = await supabase.from('tournament_match_results').select('*').in('match_id', ids)
    if (rs.error) throw rs.error
    const agg = {}
    ;(rs.data || []).forEach((r) => {
      if (r.placement == null) return
      const a = (agg[r.team_id] ||= { mp: 0, wwcd: 0, place_pts: 0, kill_pts: 0 })
      a.mp += 1; if (r.placement === 1) a.wwcd += 1
      a.place_pts += placementPoints(r.placement); a.kill_pts += Number(r.kills) || 0
    })
    const fresh = await supabase.from('tournament_group_teams').select('*').eq('group_id', session.group_id)
    if (fresh.error) throw fresh.error
    const ups = await Promise.all((fresh.data || []).map((x) => {
      const a = { ...(agg[x.team_id] || { mp: 0, wwcd: 0, place_pts: 0, kill_pts: 0 }) }
      a.wwcd += Number(x.cd_extra) || 0
      baseRef.current[x.team_id] = { pp: a.place_pts, kills: a.kill_pts, wwcd: a.wwcd, mp: a.mp }
      return supabase.from('tournament_group_teams').update(a).eq('id', x.id)
    }))
    if (ups.find((u) => u.error)) throw ups.find((u) => u.error).error
    return number
  }

  const blank = (o, nextMatch) => wwcdOff({ ...o, history: [], teams: o.teams.map((t) => ({ ...t, base: baseRef.current[t.id] || t.base, kills: 0, placement: null, adj: 0, pl: ['a', 'a', 'a', 'a'], players: (t.players || []).map((p) => ({ ...p, total: (Number(p.total) || 0) + (Number(p.kills) || 0), kills: 0 })) })), info: nextMatch ? { ...(o.info || {}), match: String(nextMatch) } : o.info })

  /** save this match to Results, then clear the scoreboard ready for the next match (broadcast stays live) */
  const upload = async () => {
    if (!active) return setErr('Nothing to upload yet — no kills or eliminations in this match.')
    if (!window.confirm('Upload this match result to the tournament Results / A4 report and reset the scoreboard for the next match?')) return
    setBusy(true); setErr(''); setNote('')
    try {
      const n = await saveResult()
      update((o) => blank(o, n + 1))
      setNote(`Match ${n} uploaded to Results. The A4 report now includes it, and the scoreboard is reset for match ${n + 1}.${warnRef.current}`)
    } catch (e) { setErr(e.message || String(e)) }
    setBusy(false)
  }

  const end = async () => {
    if (!window.confirm(active
      ? 'End this broadcast?\n\nThe current match result is saved into the tournament Results (and the A4 reports), then the live scorecard and its link are deleted.'
      : 'End this broadcast? The live scorecard and its link are deleted.')) return
    setBusy(true); setErr('')
    clearTimeout(timer.current)
    try {
      const number = active ? await saveResult() : null
      const del = await supabase.from('tbroadcast_sessions').delete().eq('id', session.id)
      if (del.error) throw new Error(`${number ? 'The result was saved, but t' : 'T'}he live session could not be deleted: ${del.error.message}`)
      onEnded(number ? `Broadcast ended. Match ${number} was saved in the tournament Results — you can print it from the A4 report.` : 'Broadcast ended.')
    } catch (e) { setErr(e.message || String(e)) }
    setBusy(false)
  }

  const rows = computeRows(st, mode)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-600 bg-ink-850 p-3">
        <span className="flex items-center gap-2 font-semibold text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> {session.title}</span>
        <input readOnly className="input !w-auto min-w-[260px] flex-1 !py-1 text-xs" value={link} onFocus={(e) => e.target.select()} />
        <button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }}><Copy size={13} /> {copied ? 'Copied ✓' : 'Copy link'}</button>
        <div className="flex overflow-hidden rounded-lg border border-ink-600">
          {[['auto', 'Automatic'], ['manual', 'Manual']].map(([k, l]) => <button key={k} onClick={() => setMd(k)} className={`px-3 py-1.5 text-xs font-semibold ${mode === k ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-700'}`}>{l}</button>)}
        </div>
        <select className="input !w-auto !py-1 text-xs" value={theme} onChange={(e) => setTh(e.target.value)}>{Object.entries(LIVE_THEMES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select>
        <button className="btn-ghost btn-sm" onClick={onClose}>Back</button>
        <button className="btn-primary btn-sm !bg-red-700" disabled={busy} onClick={end}><Square size={13} /> End broadcast</button>
      </div>
      <ErrorBox>{err}</ErrorBox>
      {note && <Notice>{note}</Notice>}
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
        <div className="mb-2 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Scene on air <span className={`rounded px-1.5 py-0.5 text-[10px] normal-case tracking-normal ${sync === 'ok' ? 'bg-emerald-900/50 text-emerald-300' : sync === 'error' ? 'bg-red-900/60 text-red-300' : 'bg-amber-900/50 text-amber-300'}`}>{sync === 'ok' ? '✓ sent to the live link' : sync === 'error' ? '✗ not sent — check the message above' : 'sending…'}</span></div>
        <div className="flex flex-wrap gap-2">
          {SCENES.map(([k, l], i) => <button key={k} onClick={() => setScene(k)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${scene === k ? 'border-red-500 bg-red-600 text-white' : 'border-ink-600 text-slate-300 hover:bg-ink-700'}`}>{i + 1}. {l}{scene === k ? ' ● ON AIR' : ''}</button>)}
        </div>
        <Countdown startAt={st.info?.startAt} onSet={(iso) => update((o) => ({ ...o, info: { ...(o.info || {}), startAt: iso || '' } }), 30)} />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider">Live scoreboard shows</span>
          {[['match', 'This match only'], ['overall', 'Full tournament (past matches + this match)']].map(([k, l]) => <button key={k} onClick={() => update((o) => ({ ...o, board: k }), 30)} className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${(st.board || 'match') === k ? 'border-accent bg-accent text-white' : 'border-ink-600 text-slate-300 hover:bg-ink-700'}`}>{l}</button>)}
        </div>
        <div className="mt-3 rounded-lg border border-ink-700 bg-ink-950 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold uppercase tracking-wider text-slate-400">🍗 WWCD video (loops on screen)</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${st.wwcd?.on ? 'bg-red-600 text-white' : 'bg-ink-700 text-slate-400'}`}>{st.wwcd?.on ? '● PLAYING' : 'off'}</span>
            <button className="btn-primary btn-sm" onClick={() => update(wwcdOn, 30)}>▶ Play</button>
            <button className="btn-ghost btn-sm" onClick={() => update(wwcdOff, 30)}>■ Stop</button>
            <label className="ml-2 flex items-center gap-1 text-slate-300"><input type="checkbox" checked={st.wwcdAuto !== false} onChange={(e) => update((o) => ({ ...o, wwcdAuto: e.target.checked }), 30)} /> Play automatically when a team is eliminated at 2nd place</label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Background theme</span>
            {Object.entries(WWCD_THEMES).map(([k, v]) => <button key={k} onClick={() => update((o) => ({ ...o, wwcdTheme: k }), 30)} className={`rounded-lg border px-3 py-1 text-sm font-semibold ${(st.wwcdTheme || 'blue') === k ? 'border-accent bg-accent text-white' : 'border-ink-600 text-slate-300 hover:bg-ink-700'}`}>{v.name}</button>)}
          </div>
        </div>
        {st.teams.length > 8 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Scoreboard page (8 teams per page, like the A4 report)</span>
            {['auto', ...Array.from({ length: Math.ceil(st.teams.length / 8) }, (_, i) => i)].map((k) => <button key={k} onClick={() => update((o) => ({ ...o, boardPage: k }), 30)} className={`rounded-lg border px-3 py-1 text-sm font-semibold ${String(st.boardPage ?? 'auto') === String(k) ? 'border-accent bg-accent text-white' : 'border-ink-600 text-slate-300 hover:bg-ink-700'}`}>{k === 'auto' ? 'Auto flip' : `Page ${k + 1}`}</button>)}
          </div>
        )}
        {scene === 'h2h' && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {['a', 'b'].map((side) => (
              <Field key={side} label={`Team ${side.toUpperCase()}`}><select className="input" value={st.h2h?.[side] || ''} onChange={(e) => update((o) => ({ ...o, h2h: { ...(o.h2h || {}), [side]: e.target.value } }), 30)}><option value="">— choose —</option>{st.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">Open <b>Players</b> on a team below to add names and count player kills. Player kills never change the live scoreboard — they only feed Head to head and the MVP list (and the MVP report when you upload the result).</p>
      </div>
      <InfoEditor key={JSON.stringify(st.info || {})} info={st.info || {}} onApply={(info) => update((o) => ({ ...o, info }))} />
      <div className="grid gap-4 xl:grid-cols-[1fr_580px]">
        <div className="rounded-xl border border-ink-700">
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-950 px-3 py-2 text-xs text-slate-400">
            <span>{alive} of {st.teams.length} alive</span>
            <span className="ml-auto flex gap-2">
              {mode === 'auto' && <button className="btn-ghost btn-sm" onClick={undo} disabled={!(st.history || []).length}><Undo2 size={13} /> Undo last elimination</button>}
              <button className="btn-ghost btn-sm" onClick={reset} title="Set every team back to alive with 0 kills (nothing is saved)"><RotateCcw size={13} /> Reset kills & alive teams</button>
              <button className="btn-primary btn-sm" disabled={busy} onClick={upload} title="Save this match to Results / A4 report, then reset for the next match"><Upload size={13} /> Upload result</button>
            </span>
          </div>
          <div className="max-h-[640px] divide-y divide-ink-700/60 overflow-y-auto">
            {st.teams.map((t) => {
              const isAlive = t.placement == null || t.placement === ''
              return (
                <div key={t.id}>
                <div className={`flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm ${isAlive ? '' : 'opacity-60'}`}>
                  <span className="flex min-w-[130px] flex-1 items-center gap-2">
                    {t.logo ? <img src={t.logo} alt="" className="h-6 w-6 rounded-full bg-white object-contain" /> : <span className="h-6 w-6 rounded-full bg-ink-700" />}
                    <span className="truncate font-medium text-white">{t.tag || t.name}</span>
                  </span>
                  {mode === 'auto' ? (
                    <>
                      <button className="btn-ghost btn-sm !px-2" onClick={() => kill(t.id, -1)}><Minus size={12} /></button>
                      <span className="w-8 text-center font-display text-lg font-extrabold text-white">{Number(t.kills) || 0}</span>
                      <button className="btn-primary btn-sm !px-2" onClick={() => kill(t.id, 1)}><Plus size={12} /> kill</button>
                      {isAlive
                        ? (pend?.id === t.id
                          ? <span className="flex w-40 items-center gap-1"><span className="text-[10px] text-slate-400">Rank</span><input autoFocus className="input !w-12 !px-1 !py-0.5 text-center" type="number" min="1" max="25" value={pend.value} onChange={(e) => setPend({ id: t.id, value: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { eliminate(t.id, pend.value); setPend(null) } if (e.key === 'Escape') setPend(null) }} /><button className="btn-primary btn-sm !px-2 !bg-red-700" onClick={() => { eliminate(t.id, pend.value); setPend(null) }}>OK</button><button className="btn-ghost btn-sm !px-1" onClick={() => setPend(null)}>✕</button></span>
                          : <button className="btn-ghost btn-sm w-28 text-red-300" onClick={() => setPend({ id: t.id, value: alive })}>Eliminate</button>)
                        : <span className={`w-28 text-center text-xs font-bold ${Number(t.placement) === 1 ? 'text-amber-300' : 'text-red-400'}`}>{Number(t.placement) === 1 ? '🍗 WWCD · #1' : `OUT · #${t.placement}`}</span>}
                    </>
                  ) : (
                    <>
                      <label className="text-[10px] text-slate-500">Kills <EnterNum className="input !w-14 !px-1 !py-0.5 text-center" min="0" value={t.kills ?? 0} onCommit={(v) => patch(t.id, { kills: Math.max(0, Number(v) || 0) })} /></label>
                      <label className="text-[10px] text-slate-500">Place <EnterNum className="input !w-14 !px-1 !py-0.5 text-center" min="1" max="25" placeholder="alive" value={t.placement ?? ''} onCommit={(v) => { patch(t.id, { placement: v === '' ? null : Number(v), pl: v === '' ? undefined : ['d', 'd', 'd', 'd'] }); if (Number(v) === 2 && st.wwcdAuto !== false) update(wwcdOn, 30) }} /></label>
                      <label className="text-[10px] text-slate-500">± pts <EnterNum className="input !w-14 !px-1 !py-0.5 text-center" value={t.adj ?? 0} onCommit={(v) => patch(t.id, { adj: Number(v) || 0 })} /></label>
                    </>
                  )}
                  {isAlive && <span className="flex gap-0.5" title="Players: click to change alive → knocked → out">{[0, 1, 2, 3].map((i) => { const c = (t.pl || [])[i] || 'a'; return <button key={i} type="button" onClick={() => patch(t.id, { pl: [0, 1, 2, 3].map((j) => (j === i ? { a: 'k', k: 'd', d: 'a' }[c] : (t.pl || [])[j] || 'a')) })} className="h-5 w-2.5 rounded-sm" style={{ background: c === 'a' ? '#22c55e' : c === 'k' ? '#ef4444' : '#5b6270' }} /> })}</span>}
                  <span className="w-10 text-right font-display text-lg font-extrabold text-amber-300" title="Points">{rows.find((r) => r.id === t.id)?.tp}</span>
                  <button className={`btn-ghost btn-sm !px-2 ${openT === t.id ? '!bg-ink-700' : ''}`} onClick={() => setOpenT(openT === t.id ? null : t.id)} title="Player names and player kills">Players ({(t.players || []).length})</button>
                </div>
                {openT === t.id && <PlayersPanel team={t} onAdd={(n) => addPlayer(t.id, n)} onEdit={(k, p) => editPlayer(t.id, k, p)} onDel={(k) => delPlayer(t.id, k)} />}
                </div>
              )
            })}
          </div>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-950 p-3">
          <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">Preview (what viewers see)</div>
          <div className="overflow-x-auto"><LiveScorecard title={session.title} state={st} mode={mode} theme={theme} width={540} view={st.board || 'match'} /></div>
        </div>
      </div>
    </div>
  )
}

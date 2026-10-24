import { useState } from 'react'
import { Shuffle, Trash2, Plus, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { ErrorBox, Field, Modal, Notice, Spinner } from '../../components/ui'
import { rank, totalOf } from '../../lib/tournament'
import LogoPick from '../../components/LogoPick'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const MIN_SLOT = 2
const MAX_SLOT = 25

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const j = buf[0] % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Admin tool.  1) add teams  2) draw a round (random groups)  3) set date/time/qualifiers per group
 * 4) tick the teams that qualified  5) draw the next round from the qualified teams ... (past rounds stay visible)
 */
export default function TournamentGroups({ tournament, onClose }) {
  const tid = tournament.id
  const teams = useData(() => supabase.from('tournament_teams').select('*').eq('tournament_id', tid).order('name'), [tid])
  const rounds = useData(() => supabase.from('tournament_rounds').select('*').eq('tournament_id', tid).order('sort'), [tid])
  const groups = useData(() => supabase.from('tournament_groups').select('*').eq('tournament_id', tid).order('sort'), [tid])
  const gts = useData(() => supabase.from('tournament_group_teams').select('*').eq('tournament_id', tid), [tid])
  const [names, setNames] = useState('')
  const [one, setOne] = useState({ name: '', logo: null })
  const [draw, setDraw] = useState({ round: '', groups: 2, qualify: 8, slot_start: 2 })
  const [rid, setRid] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const T = teams.data || []
  const R = rounds.data || []
  const G = groups.data || []
  const GT = gts.data || []
  const teamById = Object.fromEntries(T.map((t) => [t.id, t]))
  const reload = () => { teams.reload(); rounds.reload(); groups.reload(); gts.reload() }
  const fail = (e) => { setErr(e?.message || String(e)); setBusy(false) }

  const active = R.find((r) => r.id === rid) || R[R.length - 1] || null
  const lastRound = R[R.length - 1] || null
  const groupsOf = (r) => G.filter((g) => g.round_id === r?.id)
  const entriesOf = (g) => GT.filter((x) => x.group_id === g.id).sort((a, b) => (a.slot || 0) - (b.slot || 0))
  const qualifiedOfLast = lastRound ? groupsOf(lastRound).flatMap((g) => entriesOf(g)).filter((x) => x.qualified).map((x) => teamById[x.team_id]).filter(Boolean) : []

  const addTeams = async () => {
    const list = [...new Set(names.split('\n').map((x) => x.trim()).filter(Boolean))]
    if (!list.length) return
    setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.from('tournament_teams').insert(list.map((name) => ({ tournament_id: tid, name })))
    setBusy(false)
    if (error) return setErr(error.message)
    setNames(''); reload()
  }
  const addOne = async () => {
    const name = one.name.trim()
    if (!name) return
    setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.from('tournament_teams').insert({ tournament_id: tid, name, logo_url: one.logo || null })
    setBusy(false)
    if (error) return setErr(error.message)
    setOne({ name: '', logo: null }); reload()
  }
  const setLogo = async (t, url) => {
    const { error } = await supabase.from('tournament_teams').update({ logo_url: url }).eq('id', t.id)
    if (error) return setErr(error.message)
    reload()
  }
  const removeTeam = async (t) => {
    if (!window.confirm(`Remove ${t.name} from the tournament (all rounds)?`)) return
    await supabase.from('tournament_teams').delete().eq('id', t.id)
    reload()
  }
  const toggleOurs = async (t) => {
    await supabase.from('tournament_teams').update({ is_ours: !t.is_ours }).eq('id', t.id)
    reload()
  }

  /** create a new round: first round draws all teams, later rounds draw only the teams ticked "qualified" in the previous round */
  const runDraw = async () => {
    setErr(''); setMsg('')
    const pool = lastRound ? qualifiedOfLast : T
    const n = pool.length
    if (!T.length) return setErr('Add some teams first.')
    if (lastRound && !n) return setErr(`Tick the qualified teams in “${lastRound.name}” first (section 3), then create the next round.`)
    const g = Math.max(1, Math.min(Number(draw.groups) || 1, n))
    const start = Number(draw.slot_start)
    if (start < MIN_SLOT || start > MAX_SLOT) return setErr(`Slots start between ${MIN_SLOT} and ${MAX_SLOT}.`)
    const size = Math.ceil(n / g)
    if (start + size - 1 > MAX_SLOT) return setErr(`${size} teams per group starting at slot ${start} would pass slot ${MAX_SLOT}. Use more groups or an earlier start slot.`)
    const roundName = draw.round.trim() || `Round ${R.length + 1}`

    setBusy(true)
    const rr = await supabase.from('tournament_rounds').insert({ tournament_id: tid, name: roundName, sort: R.length + 1 }).select('id').single()
    if (rr.error) return fail(rr.error)
    const ins = await supabase.from('tournament_groups').insert(
      Array.from({ length: g }, (_, i) => ({
        tournament_id: tid, round_id: rr.data.id, round: roundName, name: `Group ${LETTERS[i] || i + 1}`,
        qualify: Number(draw.qualify) || 0, slot_start: start, sort: i + 1,
      })),
    ).select('id, sort')
    if (ins.error) return fail(ins.error)
    const gs = [...ins.data].sort((a, b) => a.sort - b.sort)

    const mixed = shuffle(pool)
    const base = Math.floor(n / g); const extra = n % g
    let k = 0
    const rows = []
    gs.forEach((grp, i) => {
      const count = base + (i < extra ? 1 : 0)
      for (let s = 0; s < count; s++) rows.push({ tournament_id: tid, group_id: grp.id, team_id: mixed[k++].id, slot: start + s })
    })
    const up = await supabase.from('tournament_group_teams').insert(rows)
    setBusy(false)
    if (up.error) return setErr(up.error.message)
    setRid(rr.data.id)
    setDraw({ ...draw, round: '' })
    setMsg(`${roundName}: ${n} teams drawn into ${g} groups.`)
    reload()
  }

  const toggleEnded = async (r) => {
    const status = r.status === 'ended' ? 'open' : 'ended'
    const { error } = await supabase.from('tournament_rounds').update({ status }).eq('id', r.id)
    if (error) return setErr(error.message)
    setMsg(status === 'ended' ? `${r.name} ended: visitors now see the results / leaderboard instead of the slot list.` : `${r.name} reopened: visitors see the slot list again.`)
    reload()
  }

  const deleteRound = async (r) => {
    if (!window.confirm(`Delete “${r.name}” with all its groups and qualified marks?`)) return
    const { error } = await supabase.from('tournament_rounds').delete().eq('id', r.id)
    if (error) return setErr(error.message)
    setRid(null); reload()
  }

  return (
    <Modal title={`Teams, rounds & groups — ${tournament.title}`} onClose={onClose} wide>
      <div className="space-y-5">
        {/* 1. teams */}
        <section>
          <div className="label">1. Add the participating teams</div>
          <div className="flex items-center gap-2">
            <LogoPick size={40} value={one.logo} onChange={(u) => setOne({ ...one, logo: u })} title="Team logo (optional)" />
            <input className="input" placeholder="Team name" value={one.name} onChange={(e) => setOne({ ...one, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOne() } }} />
            <button type="button" className="btn-primary btn-sm shrink-0" disabled={busy || !one.name.trim()} onClick={addOne}><Plus size={14} /> Add team</button>
          </div>
          <div className="mb-1 mt-3 text-xs text-slate-500">Or paste many names at once (one per line) and add the logos afterwards by clicking the small square next to each team:</div>
          <textarea className="input min-h-[90px]" value={names} onChange={(e) => setNames(e.target.value)} placeholder={'INF ESPORTS\nNM ESPORTS\nT6 ESPORTS'} />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">{T.length} teams added</span>
            <button type="button" className="btn-primary btn-sm" disabled={busy || !names.trim()} onClick={addTeams}><Plus size={14} /> Add teams</button>
          </div>
          {teams.loading ? <Spinner /> : T.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {T.map((t) => (
                <span key={t.id} className={`flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-1.5 text-xs ${t.is_ours ? 'border-accent bg-accent/15 text-white' : 'border-ink-600 text-slate-300'}`}>
                  <LogoPick size={24} value={t.logo_url} onChange={(u) => setLogo(t, u)} />
                  <button type="button" title="Mark as our team (highlighted)" onClick={() => toggleOurs(t)}>{t.is_ours ? '★' : '☆'}</button>
                  {t.name}
                  <button type="button" onClick={() => removeTeam(t)} className="text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 2. new round */}
        <section>
          <div className="label">
            2. {lastRound ? `Create the next round (draws the ${qualifiedOfLast.length} teams qualified from “${lastRound.name}”)` : 'Draw the first round (all teams)'}
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <Field label="Round name"><input className="input" value={draw.round} onChange={(e) => setDraw({ ...draw, round: e.target.value })} placeholder={`Round ${R.length + 1}`} /></Field>
            <Field label="Number of groups"><input className="input" type="number" min="1" value={draw.groups} onChange={(e) => setDraw({ ...draw, groups: e.target.value })} /></Field>
            <Field label="Teams qualifying per group"><input className="input" type="number" min="0" value={draw.qualify} onChange={(e) => setDraw({ ...draw, qualify: e.target.value })} /></Field>
            <Field label={`Slot list starts at (${MIN_SLOT}–${MAX_SLOT})`}><input className="input" type="number" min={MIN_SLOT} max={MAX_SLOT} value={draw.slot_start} onChange={(e) => setDraw({ ...draw, slot_start: e.target.value })} /></Field>
            <div className="flex items-end"><button type="button" className="btn-primary w-full" disabled={busy || !T.length} onClick={runDraw}><Shuffle size={15} /> {lastRound ? 'Create round' : 'Draw groups'}</button></div>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Slots count up from the start slot, e.g. 18 teams starting at 3 use slots 3–20. Past rounds stay saved and visible to visitors.</p>
        </section>

        <ErrorBox>{err}</ErrorBox>
        <Notice>{msg}</Notice>

        {/* 3. rounds + groups */}
        <section>
          <div className="label">3. Rounds — date, time, qualifiers, match results and qualified teams</div>
          {rounds.loading || groups.loading || gts.loading ? <Spinner /> : !R.length ? (
            <div className="rounded-lg border border-ink-700 p-4 text-center text-sm text-slate-500">No rounds yet. Add teams and press “Draw groups”.</div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {R.map((r) => (
                  <button key={r.id} type="button" onClick={() => setRid(r.id)} className={`btn btn-sm ${active?.id === r.id ? 'bg-accent text-white' : 'border border-ink-600 text-slate-300'}`}>{r.name}</button>
                ))}
                {active && (
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <span className={active.status === 'ended' ? 'badge-green' : 'badge-amber'}>{active.status === 'ended' ? 'results shown' : 'slot list shown'}</span>
                    <button type="button" className="btn-primary btn-sm" onClick={() => toggleEnded(active)}>{active.status === 'ended' ? 'Reopen round (show slot list)' : 'End round & show results'}</button>
                    <button type="button" className="btn-ghost btn-sm text-red-300" onClick={() => deleteRound(active)}><Trash2 size={13} /> Delete</button>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {groupsOf(active).map((g) => (
                  <GroupEditor key={g.id + (g.slot_start ?? '')} g={g} groups={groupsOf(active)} entries={entriesOf(g)} allEntries={GT} teamById={teamById} onChanged={reload} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </Modal>
  )
}

function GroupEditor({ g, groups, entries, allEntries, teamById, onChanged }) {
  const [f, setF] = useState({
    name: g.name, round: g.round || '', match_date: g.match_date || '', match_time: String(g.match_time || '').slice(0, 5),
    match_note: g.match_note || '', qualify: g.qualify, slot_start: g.slot_start,
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState({}) // entry id -> { wwcd, place_pts, kill_pts } being typed
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const val = (x, k) => (res[x.id]?.[k] ?? x[k] ?? 0)
  const setVal = (x, k, v) => setRes((r) => ({ ...r, [x.id]: { ...r[x.id], [k]: v } }))
  const withRes = (x) => ({ ...x, wwcd: val(x, 'wwcd'), place_pts: val(x, 'place_pts'), kill_pts: val(x, 'kill_pts') })
  const last = Number(f.slot_start) + entries.length - 1
  const qualifiedCount = entries.filter((x) => x.qualified).length

  const renumber = async (list, start) => {
    const jobs = list.map((x, i) => supabase.from('tournament_group_teams').update({ slot: start + i }).eq('id', x.id))
    return (await Promise.all(jobs)).find((r) => r.error)?.error
  }

  const save = async () => {
    setErr('')
    const start = Number(f.slot_start)
    if (start < MIN_SLOT || start > MAX_SLOT) return setErr(`Start slot must be between ${MIN_SLOT} and ${MAX_SLOT}.`)
    if (last > MAX_SLOT) return setErr(`${entries.length} teams starting at slot ${start} would pass slot ${MAX_SLOT}.`)
    setBusy(true)
    const { error } = await supabase.from('tournament_groups').update({
      name: f.name, match_date: f.match_date || null, match_time: f.match_time || null, match_note: f.match_note || null,
      qualify: Number(f.qualify) || 0, slot_start: start,
    }).eq('id', g.id)
    if (error) { setBusy(false); return setErr(error.message) }
    const e2 = await renumber(entries, start)
    if (e2) { setBusy(false); return setErr(e2.message) }
    const e3 = await saveResults()
    if (e3) { setBusy(false); return setErr(e3.message) }
    // results typed? then the top teams are marked as qualified automatically
    const e4 = await applyQualified(Number(f.qualify) || 0)
    setBusy(false)
    if (e4) return setErr(e4.message)
    onChanged()
  }

  const saveResults = async () => {
    const jobs = entries.map((x) => supabase.from('tournament_group_teams').update({
      wwcd: Number(val(x, 'wwcd')) || 0, place_pts: Number(val(x, 'place_pts')) || 0, kill_pts: Number(val(x, 'kill_pts')) || 0,
    }).eq('id', x.id))
    return (await Promise.all(jobs)).find((r) => r.error)?.error
  }

  // mark the top N teams (by the results typed) as qualified, everyone else as not qualified
  const applyQualified = async (n) => {
    const withResults = entries.map(withRes)
    if (!withResults.some((x) => totalOf(x) > 0)) return null // no results yet: keep manual ticks
    const order = rank(withResults).map((x) => x.id)
    const jobs = entries.map((x) => supabase.from('tournament_group_teams').update({ qualified: order.indexOf(x.id) < n }).eq('id', x.id))
    return (await Promise.all(jobs)).find((r) => r.error)?.error
  }

  const toggleQualified = async (x) => {
    const r = await supabase.from('tournament_group_teams').update({ qualified: !x.qualified }).eq('id', x.id)
    if (r.error) return setErr(r.error.message)
    onChanged()
  }

  const move = async (x, toGroupId) => {
    if (!toGroupId || toGroupId === g.id) return
    const target = groups.find((y) => y.id === toGroupId)
    const targetCount = allEntries.filter((y) => y.group_id === toGroupId).length
    if (target.slot_start + targetCount > MAX_SLOT) return setErr(`${target.name} is full (slots run up to ${MAX_SLOT}).`)
    const r = await supabase.from('tournament_group_teams').update({ group_id: toGroupId, slot: target.slot_start + targetCount }).eq('id', x.id)
    if (r.error) return setErr(r.error.message)
    await renumber(entries.filter((y) => y.id !== x.id), g.slot_start)
    onChanged()
  }

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Group name"><input className="input" value={f.name} onChange={set('name')} /></Field>
        <Field label="Date"><input className="input" type="date" value={f.match_date} onChange={set('match_date')} /></Field>
        <Field label="Match time"><input className="input" type="time" value={f.match_time} onChange={set('match_time')} /></Field>
        <Field label="Note (optional)"><input className="input" value={f.match_note} onChange={set('match_note')} placeholder="Back to back 3 matches" /></Field>
        <Field label="Qualify"><input className="input" type="number" min="0" value={f.qualify} onChange={set('qualify')} /></Field>
        <Field label="Slots from"><input className="input" type="number" min={MIN_SLOT} max={MAX_SLOT} value={f.slot_start} onChange={set('slot_start')} /></Field>
      </div>
      <div className="mt-2 text-[11px] text-slate-500">
        {entries.length} teams · slots {f.slot_start}–{last}{last > MAX_SLOT ? ' (too many for slot 25!)' : ''} · {qualifiedCount} of {Number(f.qualify) || 0} qualified marked
      </div>

      <div className="mt-2 divide-y divide-ink-700/60 rounded-lg border border-ink-700">
        <div className="flex items-center gap-3 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <span className="w-8">Slot</span><span className="min-w-0 flex-1">Team</span><span className="w-14 text-center">WWCD</span><span className="w-16 text-center">Place pts</span><span className="w-16 text-center">Kill pts</span><span className="w-12 text-center">Total</span><span>Qual.</span><span className="w-28 text-right">Move to</span>
        </div>
        {entries.map((x, i) => {
          const t = teamById[x.team_id]
          return (
            <div key={x.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
              <span className="w-8 font-semibold text-red-400">{Number(f.slot_start) + i}</span>
              <span className={`min-w-0 flex-1 truncate ${t?.is_ours ? 'font-semibold text-white' : ''}`}>{t?.name || '—'}</span>
              <input className="input !w-14 !px-1 !py-0.5 text-center text-xs" type="number" min="0" value={val(x, 'wwcd')} onChange={(e) => setVal(x, 'wwcd', e.target.value)} />
              <input className="input !w-16 !px-1 !py-0.5 text-center text-xs" type="number" min="0" value={val(x, 'place_pts')} onChange={(e) => setVal(x, 'place_pts', e.target.value)} />
              <input className="input !w-16 !px-1 !py-0.5 text-center text-xs" type="number" min="0" value={val(x, 'kill_pts')} onChange={(e) => setVal(x, 'kill_pts', e.target.value)} />
              <span className="w-12 text-center font-semibold text-white">{totalOf(withRes(x))}</span>
              <input type="checkbox" checked={!!x.qualified} onChange={() => toggleQualified(x)} className="h-4 w-4 accent-[rgb(var(--accent))]" title="Qualified for the next round" />
              <select className="input !w-28 !py-0.5 text-xs" value={g.id} onChange={(e) => move(x, e.target.value)} title="Move to another group">
                {groups.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
          )
        })}
        {!entries.length && <div className="px-3 py-3 text-center text-xs text-slate-500">No teams in this group.</div>}
      </div>
      <ErrorBox>{err}</ErrorBox>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <span className="mr-auto self-center text-[11px] text-slate-500">Saving results marks the top {Number(f.qualify) || 0} teams as qualified automatically.</span>
        <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={save}><Save size={14} /> {busy ? 'Saving…' : 'Save group & results'}</button>
      </div>
    </div>
  )
}

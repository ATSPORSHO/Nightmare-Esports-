import { useState } from 'react'
import { Shuffle, Trash2, Plus, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { ErrorBox, Field, Modal, Notice, Spinner } from '../../components/ui'

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

/** Admin tool: add teams -> random draw into groups -> edit each group's date, time, qualifiers and slot range. */
export default function TournamentGroups({ tournament, onClose }) {
  const tid = tournament.id
  const teams = useData(() => supabase.from('tournament_teams').select('*').eq('tournament_id', tid).order('name'), [tid])
  const groups = useData(() => supabase.from('tournament_groups').select('*').eq('tournament_id', tid).order('sort'), [tid])
  const [names, setNames] = useState('')
  const [draw, setDraw] = useState({ groups: 2, qualify: 8, slot_start: 2 })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const T = teams.data || []
  const G = groups.data || []
  const reload = () => { teams.reload(); groups.reload() }
  const fail = (e) => { setErr(e?.message || String(e)); setBusy(false) }

  const addTeams = async () => {
    const list = [...new Set(names.split('\n').map((x) => x.trim()).filter(Boolean))]
    if (!list.length) return
    setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.from('tournament_teams').insert(list.map((name) => ({ tournament_id: tid, name })))
    setBusy(false)
    if (error) return setErr(error.message)
    setNames(''); reload()
  }

  const removeTeam = async (t) => {
    await supabase.from('tournament_teams').delete().eq('id', t.id)
    reload()
  }
  const toggleOurs = async (t) => {
    await supabase.from('tournament_teams').update({ is_ours: !t.is_ours }).eq('id', t.id)
    reload()
  }

  /** random draw: shuffle all teams and deal them into N groups, slots numbered from each group's start slot */
  const runDraw = async () => {
    setErr(''); setMsg('')
    const n = T.length
    const g = Math.max(1, Math.min(Number(draw.groups) || 1, n))
    const start = Number(draw.slot_start)
    if (!n) return setErr('Add some teams first.')
    if (start < MIN_SLOT || start > MAX_SLOT) return setErr(`Slots start between ${MIN_SLOT} and ${MAX_SLOT}.`)
    const size = Math.ceil(n / g)
    if (start + size - 1 > MAX_SLOT) return setErr(`${size} teams per group starting at slot ${start} would pass slot ${MAX_SLOT}. Use more groups or an earlier start slot.`)
    if (G.length && !window.confirm('This replaces the current groups with a new random draw. Continue?')) return

    setBusy(true)
    const del = await supabase.from('tournament_groups').delete().eq('tournament_id', tid)
    if (del.error) return fail(del.error)
    const ins = await supabase.from('tournament_groups').insert(
      Array.from({ length: g }, (_, i) => ({
        tournament_id: tid, name: `Group ${LETTERS[i] || i + 1}`, qualify: Number(draw.qualify) || 0, slot_start: start, sort: i + 1,
      })),
    ).select('id, sort')
    if (ins.error) return fail(ins.error)
    const gs = [...ins.data].sort((a, b) => a.sort - b.sort)

    const mixed = shuffle(T)
    const base = Math.floor(n / g); const extra = n % g
    let k = 0
    const rows = []
    gs.forEach((grp, i) => {
      const count = base + (i < extra ? 1 : 0)
      for (let s = 0; s < count; s++) {
        const t = mixed[k++]
        rows.push({ id: t.id, tournament_id: tid, name: t.name, is_ours: t.is_ours, group_id: grp.id, slot: start + s })
      }
    })
    const up = await supabase.from('tournament_teams').upsert(rows)
    setBusy(false)
    if (up.error) return setErr(up.error.message)
    setMsg(`Drawn: ${n} teams into ${g} groups.`)
    reload()
  }

  return (
    <Modal title={`Teams & groups — ${tournament.title}`} onClose={onClose} wide>
      <div className="space-y-5">
        {/* 1. teams */}
        <section>
          <div className="label">1. Add the participating teams (one name per line)</div>
          <textarea className="input min-h-[90px]" value={names} onChange={(e) => setNames(e.target.value)} placeholder={'INF ESPORTS\nNM ESPORTS\nT6 ESPORTS'} />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">{T.length} teams added</span>
            <button type="button" className="btn-primary btn-sm" disabled={busy || !names.trim()} onClick={addTeams}><Plus size={14} /> Add teams</button>
          </div>
          {teams.loading ? <Spinner /> : T.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {T.map((t) => (
                <span key={t.id} className={`flex items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1.5 text-xs ${t.is_ours ? 'border-accent bg-accent/15 text-white' : 'border-ink-600 text-slate-300'}`}>
                  <button type="button" title="Mark as our team (highlighted)" onClick={() => toggleOurs(t)}>{t.is_ours ? '★' : '☆'}</button>
                  {t.name}
                  <button type="button" onClick={() => removeTeam(t)} className="text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 2. draw */}
        <section>
          <div className="label">2. Random draw</div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Number of groups"><input className="input" type="number" min="1" value={draw.groups} onChange={(e) => setDraw({ ...draw, groups: e.target.value })} /></Field>
            <Field label="Teams qualifying per group"><input className="input" type="number" min="0" value={draw.qualify} onChange={(e) => setDraw({ ...draw, qualify: e.target.value })} /></Field>
            <Field label={`Slot list starts at (${MIN_SLOT}–${MAX_SLOT})`}><input className="input" type="number" min={MIN_SLOT} max={MAX_SLOT} value={draw.slot_start} onChange={(e) => setDraw({ ...draw, slot_start: e.target.value })} /></Field>
            <div className="flex items-end"><button type="button" className="btn-primary w-full" disabled={busy || !T.length} onClick={runDraw}><Shuffle size={15} /> Draw groups</button></div>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Slots count up from the start slot, e.g. 18 teams starting at 3 use slots 3–20. You can change each group's start slot below.</p>
        </section>

        <ErrorBox>{err}</ErrorBox>
        <Notice>{msg}</Notice>

        {/* 3. groups */}
        <section>
          <div className="label">3. Groups — set date, time, qualifiers and slot range</div>
          {groups.loading ? <Spinner /> : !G.length ? (
            <div className="rounded-lg border border-ink-700 p-4 text-center text-sm text-slate-500">No groups yet. Add teams and press “Draw groups”.</div>
          ) : (
            <div className="space-y-4">
              {G.map((g) => (
                <GroupEditor key={g.id} g={g} groups={G} teams={T.filter((t) => t.group_id === g.id).sort((a, b) => (a.slot || 0) - (b.slot || 0))} allTeams={T} onChanged={reload} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}

function GroupEditor({ g, groups, teams, allTeams, onChanged }) {
  const [f, setF] = useState({
    name: g.name, match_date: g.match_date || '', match_time: String(g.match_time || '').slice(0, 5),
    match_note: g.match_note || '', qualify: g.qualify, slot_start: g.slot_start,
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const last = Number(f.slot_start) + teams.length - 1

  const renumber = async (list, start) => {
    const jobs = list.map((t, i) => supabase.from('tournament_teams').update({ slot: start + i }).eq('id', t.id))
    return (await Promise.all(jobs)).find((r) => r.error)?.error
  }

  const save = async () => {
    setErr('')
    const start = Number(f.slot_start)
    if (start < MIN_SLOT || start > MAX_SLOT) return setErr(`Start slot must be between ${MIN_SLOT} and ${MAX_SLOT}.`)
    if (last > MAX_SLOT) return setErr(`${teams.length} teams starting at slot ${start} would pass slot ${MAX_SLOT}.`)
    setBusy(true)
    const { error } = await supabase.from('tournament_groups').update({
      name: f.name, match_date: f.match_date || null, match_time: f.match_time || null, match_note: f.match_note || null,
      qualify: Number(f.qualify) || 0, slot_start: start,
    }).eq('id', g.id)
    if (error) { setBusy(false); return setErr(error.message) }
    const e2 = await renumber(teams, start)
    setBusy(false)
    if (e2) return setErr(e2.message)
    onChanged()
  }

  const move = async (team, toGroupId) => {
    if (!toGroupId || toGroupId === g.id) return
    const target = groups.find((x) => x.id === toGroupId)
    const targetTeams = allTeams.filter((t) => t.group_id === toGroupId).sort((a, b) => (a.slot || 0) - (b.slot || 0))
    if (target.slot_start + targetTeams.length > MAX_SLOT) return setErr(`${target.name} is full (slots run up to ${MAX_SLOT}).`)
    const r = await supabase.from('tournament_teams').update({ group_id: toGroupId, slot: target.slot_start + targetTeams.length }).eq('id', team.id)
    if (r.error) return setErr(r.error.message)
    await renumber(teams.filter((t) => t.id !== team.id), g.slot_start)
    onChanged()
  }

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
      <div className="grid gap-2 sm:grid-cols-6">
        <Field label="Group name"><input className="input" value={f.name} onChange={set('name')} /></Field>
        <Field label="Date"><input className="input" type="date" value={f.match_date} onChange={set('match_date')} /></Field>
        <Field label="Match time"><input className="input" type="time" value={f.match_time} onChange={set('match_time')} /></Field>
        <Field label="Note (optional)"><input className="input" value={f.match_note} onChange={set('match_note')} placeholder="Back to back 3 matches" /></Field>
        <Field label="Qualify"><input className="input" type="number" min="0" value={f.qualify} onChange={set('qualify')} /></Field>
        <Field label="Slots from"><input className="input" type="number" min={MIN_SLOT} max={MAX_SLOT} value={f.slot_start} onChange={set('slot_start')} /></Field>
      </div>
      <div className="mt-2 text-[11px] text-slate-500">{teams.length} teams · slots {f.slot_start}–{last}{last > MAX_SLOT ? ' (too many for slot 25!)' : ''}</div>

      <div className="mt-2 divide-y divide-ink-700/60 rounded-lg border border-ink-700">
        {teams.map((t, i) => (
          <div key={t.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
            <span className="w-8 font-semibold text-red-400">{Number(f.slot_start) + i}</span>
            <span className={`flex-1 ${t.is_ours ? 'font-semibold text-white' : ''}`}>{t.name}</span>
            <select className="input !w-auto !py-0.5 text-xs" value={g.id} onChange={(e) => move(t, e.target.value)} title="Move to another group">
              {groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        ))}
        {!teams.length && <div className="px-3 py-3 text-center text-xs text-slate-500">No teams in this group.</div>}
      </div>
      <ErrorBox>{err}</ErrorBox>
      <div className="mt-2 text-right"><button type="button" className="btn-primary btn-sm" disabled={busy} onClick={save}><Save size={14} /> {busy ? 'Saving…' : 'Save group'}</button></div>
    </div>
  )
}

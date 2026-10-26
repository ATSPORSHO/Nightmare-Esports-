import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Flag, Users, FileText, ListOrdered, ClipboardList } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { todayStr } from '../../lib/format'
import { Card, ErrorBox, Field, Modal, Spinner } from '../../components/ui'
import ImageField from '../../components/ImageField'
import TournamentGroups from './TournamentGroups'
import TournamentResults from './TournamentResults'
import RegistrationsAdmin from './RegistrationsAdmin'

export default function TournamentsAdmin() {
  const { data, loading, error, reload } = useData(() => supabase.from('tournaments').select('*').order('start_date', { ascending: false }))
  const [editing, setEditing] = useState(null)
  const [ending, setEnding] = useState(null)
  const [grouping, setGrouping] = useState(null)
  const [scoring, setScoring] = useState(null)
  const [regs, setRegs] = useState(null)
  const today = todayStr()

  const state = (t) => (t.ended ? 'ended' : !t.active ? 'hidden' : t.end_date && t.end_date < today ? 'ended' : t.start_date > today ? 'upcoming' : 'live')
  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return
    await supabase.from('tournaments').delete().eq('id', t.id)
    reload()
  }
  const toggle = async (t) => { await supabase.from('tournaments').update({ active: !t.active }).eq('id', t.id); reload() }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">Tournaments organized by you. They show on the home page as <b>Live</b> or <b>Upcoming</b> by their dates. When one finishes, press <b>End</b>: it leaves Active tournaments and is added to Successful events automatically.</p>
        <button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add tournament</button>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading ? <Spinner /> : (
          <ul className="divide-y divide-ink-700/60">
            {(data || []).map((t) => {
              const st = state(t)
              return (
                <li key={t.id} className={`flex flex-wrap items-center gap-3 py-3 ${st === 'ended' || st === 'hidden' ? 'opacity-50' : ''}`}>
                  {t.logo_url ? <img src={t.logo_url} alt="" className="h-12 w-12 rounded object-contain" /> : <span className="h-12 w-12 rounded bg-ink-800" />}
                  <div className="min-w-[180px] flex-1">
                    <div className="font-medium text-white">{t.title}{t.scope === 'international' && <span className="ml-2 rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-300">International</span>}</div>
                    <div className="text-xs text-slate-500">{t.start_date}{t.end_date ? ` → ${t.end_date}` : ''}{t.prize_pool ? ` · ${t.prize_pool}` : ''}</div>
                  </div>
                  <span className={st === 'live' ? 'badge-green' : st === 'upcoming' ? 'badge-amber' : 'badge-accent'}>{st}</span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400">
                    <input type="checkbox" checked={t.active} onChange={() => toggle(t)} className="h-4 w-4 accent-[rgb(var(--accent))]" /> show
                  </label>
                  <Link to={`/tournament/${t.id}/report`} className="btn-ghost btn-sm" title="A4 slot list report, one group per page"><FileText size={13} /> A4 report</Link>
 <button className="btn-ghost btn-sm" title="Enter results match by match" onClick={() => setScoring(t)}><ListOrdered size={13} /> Results</button>
 {(t.reg_enabled || t.reg_start || t.reg_end) && <button className="btn-ghost btn-sm" title="Teams that registered" onClick={() => setRegs(t)}><ClipboardList size={13} /> Registrations</button>}
                  <button className="btn-ghost btn-sm" title="Add teams and draw groups" onClick={() => setGrouping(t)}><Users size={13} /> Teams &amp; groups</button>
                  {!t.ended && <button className="btn-ghost btn-sm text-amber-300" title="End tournament and add it to Successful events" onClick={() => setEnding(t)}><Flag size={13} /> End</button>}
                  <button className="btn-ghost btn-sm" onClick={() => setEditing(t)}><Pencil size={13} /></button>
                  <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(t)}><Trash2 size={13} /></button>
                </li>
              )
            })}
            {!data?.length && <li className="py-6 text-center text-slate-500">No tournaments yet.</li>}
          </ul>
        )}
      </Card>
      {regs && <RegistrationsAdmin tournament={regs} onClose={() => setRegs(null)} />}
      {scoring && <TournamentResults tournament={scoring} onClose={() => setScoring(null)} />}
      {grouping && <TournamentGroups tournament={grouping} onClose={() => setGrouping(null)} />}
      {ending && <EndForm t={ending} onClose={() => setEnding(null)} onDone={() => { setEnding(null); reload() }} />}
      {editing && <Form row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </div>
  )
}

function Form({ row, onClose, onSaved }) {
  const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
  const [f, setF] = useState({ reg_enabled: false, reg_start_l: toLocal(row.reg_start), reg_end_l: toLocal(row.reg_end), title: '', logo_url: null, prize_pool: '', start_date: todayStr(), end_date: '', teams: '', description: '', link_url: '', active: true, ...row, roadmap: Array.isArray(row.roadmap) ? row.roadmap : [] })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const payload = {
      title: f.title, logo_url: f.logo_url || null, prize_pool: f.prize_pool || null, start_date: f.start_date,
      end_date: f.end_date || null, teams: f.teams === '' || f.teams == null ? null : Number(f.teams),
      description: f.description || null, link_url: f.link_url || null, active: !!f.active,
      ...((f.reg_enabled || f.reg_start_l || f.reg_end_l || 'reg_enabled' in row) ? { reg_enabled: !!f.reg_enabled, reg_start: f.reg_start_l ? new Date(f.reg_start_l).toISOString() : null, reg_end: f.reg_end_l ? new Date(f.reg_end_l).toISOString() : null } : {}),
      ...(f.scope === 'international' || 'scope' in row ? { scope: f.scope || 'regional' } : {}),
    }
    const roadmap = (f.roadmap || []).filter((x) => (x.title || '').trim()).map((x) => ({ title: x.title.trim(), date: (x.date || '').trim(), note: (x.note || '').trim() }))
    const q = supabase.from('tournaments')
    const res = row.id ? await q.update(payload).eq('id', row.id).select('id').single() : await q.insert(payload).select('id').single()
    if (res.error) { setBusy(false); return setErr(res.error.message) }
    // the roadmap is saved on its own so a missing column gives a clear message
    const rm = await supabase.from('tournaments').update({ roadmap }).eq('id', res.data.id).select('roadmap').single()
    setBusy(false)
    if (rm.error) return setErr(/roadmap/.test(rm.error.message) ? 'The tournament was saved, but the roadmap column is missing in the database. Run supabase/roadmap.sql once in Supabase (SQL Editor), then press Save again.' : rm.error.message)
    if (roadmap.length && !Array.isArray(rm.data?.roadmap)) return setErr('The roadmap column has the wrong type in the database. Run supabase/roadmap.sql once in Supabase (SQL Editor), then press Save again.')
    onSaved()
  }

  return (
    <Modal title={row.id ? 'Edit tournament' : 'Add tournament'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Tournament name"><input className="input" required value={f.title} onChange={set('title')} placeholder="Nightmare Underdog Battle Season 2" /></Field>
        <Field label="Tournament type" hint="International: you can add a country flag next to each team name. (Run supabase/international.sql once.)">
          <div className="flex overflow-hidden rounded-lg border border-ink-600">
            {[['regional', 'Regional'], ['international', 'International']].map(([k, l]) => (
              <button type="button" key={k} onClick={() => setF({ ...f, scope: k })} className={`flex-1 px-4 py-2 text-sm font-semibold ${(f.scope || 'regional') === k ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-700'}`}>{l}</button>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts"><input className="input" type="date" required value={f.start_date} onChange={set('start_date')} /></Field>
          <Field label="Ends (optional)"><input className="input" type="date" value={f.end_date || ''} onChange={set('end_date')} /></Field>
          <Field label="Prize pool"><input className="input" value={f.prize_pool || ''} onChange={set('prize_pool')} placeholder="৳50,000" /></Field>
          <Field label="Teams (optional)"><input className="input" type="number" min="0" value={f.teams ?? ''} onChange={set('teams')} /></Field>
        </div>
        <Field label="Short description (optional)"><input className="input" value={f.description || ''} onChange={set('description')} /></Field>
        <Field label="Registration / watch link (optional)"><input className="input" value={f.link_url || ''} onChange={set('link_url')} placeholder="https://" /></Field>
        <ImageField label="Tournament logo" folder="tournament" value={f.logo_url} onChange={(v) => setF({ ...f, logo_url: v })} />
        <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
          <div className="label">Team registration (run supabase/registration.sql once)</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Registration opens (countdown shows until then)"><input className="input" type="datetime-local" value={f.reg_start_l} onChange={set('reg_start_l')} /></Field>
            <Field label="Registration closes"><input className="input" type="datetime-local" value={f.reg_end_l} onChange={set('reg_end_l')} /></Field>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.reg_enabled} onChange={(e) => setF({ ...f, reg_enabled: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--accent))]" /> Activate registration (teams can register between the two times)</label>
          <p className="mt-1 text-[11px] text-slate-500">Before the opening time visitors see a countdown. While registration is open they see a Register button. After it closes (or when you untick the box) the Groups &amp; slots button appears on the home page. Leave all empty for no registration.</p>
        </div>
        <div>
          <div className="label">Roadmap (stages of the tournament, shown to visitors)</div>
          <div className="space-y-2">
            {(f.roadmap || []).map((st, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_auto] items-center gap-2 sm:grid-cols-[1fr_130px_1fr_auto]">
                <input className="input" placeholder="Stage, e.g. Qualifiers" value={st.title || ''} onChange={(e) => setF({ ...f, roadmap: f.roadmap.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} />
                <input className="input" placeholder="Date, e.g. 5–7 Dec" value={st.date || ''} onChange={(e) => setF({ ...f, roadmap: f.roadmap.map((x, k) => (k === i ? { ...x, date: e.target.value } : x)) })} />
                <input className="input col-span-2 sm:col-span-1" placeholder="Note (optional), e.g. 64 teams → 32" value={st.note || ''} onChange={(e) => setF({ ...f, roadmap: f.roadmap.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)) })} />
                <button type="button" className="btn-ghost btn-sm text-red-300" onClick={() => setF({ ...f, roadmap: f.roadmap.filter((_, k) => k !== i) })}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => setF({ ...f, roadmap: [...(f.roadmap || []), { title: '', date: '', note: '' }] })}><Plus size={13} /> Add stage</button>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--accent))]" /> Show on the home page</label>
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

/** End a tournament: it moves into "Successful events" on the home page. */
function EndForm({ t, onClose, onDone }) {
  const [f, setF] = useState({
    date: t.end_date && t.end_date <= todayStr() ? t.end_date : todayStr(),
    result: 'Completed', prize: t.prize_pool || '', description: t.description || '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const ev = await supabase.from('events').insert({
      title: t.title, event_date: f.date, kind: 'Organized', placement: f.result || null,
      prize: f.prize || null, description: f.description || null, image_url: t.logo_url || null, featured: false,
    })
    if (ev.error) { setBusy(false); return setErr(ev.error.message) }
    const up = await supabase.from('tournaments').update({ ended: true, active: false, end_date: f.date }).eq('id', t.id)
    setBusy(false)
    if (up.error) return setErr(`Added to Successful events, but could not close the tournament: ${up.error.message}. Did you run the tournament-end SQL?`)
    onDone()
  }

  return (
    <Modal title={`End "${t.title}"`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-400">The tournament will leave <b>Active tournaments</b> and appear in <b>Successful events</b> on the home page.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ended on"><input className="input" type="date" required value={f.date} onChange={set('date')} /></Field>
          <Field label="Result / note"><input className="input" value={f.result} onChange={set('result')} placeholder="Completed, Champions: Team X…" /></Field>
          <Field label="Prize pool"><input className="input" value={f.prize} onChange={set('prize')} /></Field>
        </div>
        <Field label="Short description (optional)"><input className="input" value={f.description} onChange={set('description')} /></Field>
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'End tournament'}</button>
        </div>
      </form>
    </Modal>
  )
}

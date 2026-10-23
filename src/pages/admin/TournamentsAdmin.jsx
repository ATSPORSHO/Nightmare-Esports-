import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { todayStr } from '../../lib/format'
import { Card, ErrorBox, Field, Modal, Spinner } from '../../components/ui'
import ImageField from '../../components/ImageField'

export default function TournamentsAdmin() {
  const { data, loading, error, reload } = useData(() => supabase.from('tournaments').select('*').order('start_date', { ascending: false }))
  const [editing, setEditing] = useState(null)
  const today = todayStr()

  const state = (t) => (!t.active ? 'hidden' : t.end_date && t.end_date < today ? 'ended' : t.start_date > today ? 'upcoming' : 'live')
  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return
    await supabase.from('tournaments').delete().eq('id', t.id)
    reload()
  }
  const toggle = async (t) => { await supabase.from('tournaments').update({ active: !t.active }).eq('id', t.id); reload() }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">Tournaments organized by you. They show on the home page as <b>Live</b> or <b>Upcoming</b> by their dates, and disappear after the end date.</p>
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
                    <div className="font-medium text-white">{t.title}</div>
                    <div className="text-xs text-slate-500">{t.start_date}{t.end_date ? ` → ${t.end_date}` : ''}{t.prize_pool ? ` · ${t.prize_pool}` : ''}</div>
                  </div>
                  <span className={st === 'live' ? 'badge-green' : st === 'upcoming' ? 'badge-amber' : 'badge-accent'}>{st}</span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400">
                    <input type="checkbox" checked={t.active} onChange={() => toggle(t)} className="h-4 w-4 accent-[rgb(var(--accent))]" /> show
                  </label>
                  <button className="btn-ghost btn-sm" onClick={() => setEditing(t)}><Pencil size={13} /></button>
                  <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(t)}><Trash2 size={13} /></button>
                </li>
              )
            })}
            {!data?.length && <li className="py-6 text-center text-slate-500">No tournaments yet.</li>}
          </ul>
        )}
      </Card>
      {editing && <Form row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </div>
  )
}

function Form({ row, onClose, onSaved }) {
  const [f, setF] = useState({ title: '', logo_url: null, prize_pool: '', start_date: todayStr(), end_date: '', teams: '', description: '', link_url: '', active: true, ...row })
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
    }
    const q = supabase.from('tournaments')
    const { error } = row.id ? await q.update(payload).eq('id', row.id) : await q.insert(payload)
    setBusy(false)
    if (error) setErr(error.message); else onSaved()
  }

  return (
    <Modal title={row.id ? 'Edit tournament' : 'Add tournament'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Tournament name"><input className="input" required value={f.title} onChange={set('title')} placeholder="Nightmare Underdog Battle Season 2" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts"><input className="input" type="date" required value={f.start_date} onChange={set('start_date')} /></Field>
          <Field label="Ends (optional)"><input className="input" type="date" value={f.end_date || ''} onChange={set('end_date')} /></Field>
          <Field label="Prize pool"><input className="input" value={f.prize_pool || ''} onChange={set('prize_pool')} placeholder="৳50,000" /></Field>
          <Field label="Teams (optional)"><input className="input" type="number" min="0" value={f.teams ?? ''} onChange={set('teams')} /></Field>
        </div>
        <Field label="Short description (optional)"><input className="input" value={f.description || ''} onChange={set('description')} /></Field>
        <Field label="Registration / watch link (optional)"><input className="input" value={f.link_url || ''} onChange={set('link_url')} placeholder="https://" /></Field>
        <ImageField label="Tournament logo" folder="tournament" value={f.logo_url} onChange={(v) => setF({ ...f, logo_url: v })} />
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

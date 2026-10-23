import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { todayStr } from '../../lib/format'
import { Card, ErrorBox, Field, Modal, Spinner } from '../../components/ui'
import ImageField from '../../components/ImageField'

export default function EventsAdmin() {
  const { data, loading, error, reload } = useData(() => supabase.from('events').select('*').order('event_date', { ascending: false }))
  const [editing, setEditing] = useState(null)

  const remove = async (e) => {
    if (!window.confirm(`Delete "${e.title}"?`)) return
    await supabase.from('events').delete().eq('id', e.id)
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">Successful events shown on the home page. Add, edit or remove them any time.</p>
        <button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add event</button>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading ? <Spinner /> : (
          <ul className="divide-y divide-ink-700/60">
            {(data || []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                {e.image_url ? <img src={e.image_url} alt="" className="h-10 w-10 rounded object-contain" /> : <span className="h-10 w-10 rounded bg-ink-800" />}
                <div className="min-w-[180px] flex-1">
                  <div className="font-medium text-white">{e.title}</div>
                  <div className="text-xs text-slate-500">{e.event_date} · {[e.kind, e.placement, e.prize].filter(Boolean).join(' · ')}</div>
                </div>
                <button className="btn-ghost btn-sm" onClick={() => setEditing(e)}><Pencil size={13} /></button>
                <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(e)}><Trash2 size={13} /></button>
              </li>
            ))}
            {!data?.length && <li className="py-6 text-center text-slate-500">No events yet.</li>}
          </ul>
        )}
      </Card>
      {editing && <Form row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </div>
  )
}

function Form({ row, onClose, onSaved }) {
  const [f, setF] = useState({ title: '', event_date: todayStr(), kind: 'Participated', placement: '', prize: '', description: '', image_url: null, featured: false, ...row })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const payload = {
      title: f.title, event_date: f.event_date, kind: f.kind || null, placement: f.placement || null, prize: f.prize || null,
      description: f.description || null, image_url: f.image_url || null, featured: !!f.featured,
    }
    const q = supabase.from('events')
    const { error } = row.id ? await q.update(payload).eq('id', row.id) : await q.insert(payload)
    setBusy(false)
    if (error) setErr(error.message); else onSaved()
  }

  return (
    <Modal title={row.id ? 'Edit event' : 'Add event'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Event name"><input className="input" required value={f.title} onChange={set('title')} placeholder="PUBG MOBILE Silent Stars Showdown Season 1" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date"><input className="input" type="date" required value={f.event_date} onChange={set('event_date')} /></Field>
          <Field label="Type">
            <select className="input" value={f.kind || ''} onChange={set('kind')}>
              <option>Participated</option><option>Organized</option><option>Managed</option>
            </select>
          </Field>
          <Field label="Result"><input className="input" value={f.placement || ''} onChange={set('placement')} placeholder="Champions, Finalist, 3rd Runner-up" /></Field>
          <Field label="Prize pool (optional)"><input className="input" value={f.prize || ''} onChange={set('prize')} /></Field>
        </div>
        <Field label="Short description (optional)"><input className="input" value={f.description || ''} onChange={set('description')} /></Field>
        <ImageField label="Event image / logo" folder="event" value={f.image_url} onChange={(v) => setF({ ...f, image_url: v })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.featured} onChange={(e) => setF({ ...f, featured: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--accent))]" /> Show first as a large featured tournament</label>
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

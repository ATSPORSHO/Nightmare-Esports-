import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { DAYS } from '../../lib/format'
import { Card, ErrorBox, Field, Modal, Spinner } from '../../components/ui'

export default function SchedulesAdmin() {
  const { data, loading, error, reload } = useData(() => supabase.from('schedules').select('*').order('day_of_week').order('start_time'))
  const [editing, setEditing] = useState(null)

  const remove = async (s) => {
    if (!window.confirm(`Delete "${s.title}"?`)) return
    await supabase.from('schedules').delete().eq('id', s.id)
    reload()
  }
  const toggle = async (s) => {
    await supabase.from('schedules').update({ active: !s.active }).eq('id', s.id)
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">Your regular weekly schedule. It appears on the Training page and drives the automatic reminders.</p>
        <button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add schedule</button>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <Card className="overflow-x-auto">
        {loading ? <Spinner /> : (
          <table className="tbl">
            <thead><tr><th>Day</th><th>Time</th><th>Title</th><th>Duration</th><th>Notes</th><th>Active</th><th /></tr></thead>
            <tbody>
              {(data || []).map((s) => (
                <tr key={s.id} className={s.active ? '' : 'opacity-50'}>
                  <td>{DAYS[s.day_of_week]}</td><td>{String(s.start_time).slice(0, 5)}</td><td className="font-medium text-white">{s.title}</td>
                  <td>{s.duration_min} min</td><td className="max-w-[240px] truncate">{s.notes}</td>
                  <td><input type="checkbox" checked={s.active} onChange={() => toggle(s)} className="h-4 w-4 accent-[rgb(var(--accent))]" /></td>
                  <td className="text-right">
                    <button className="btn-ghost btn-sm mr-1" onClick={() => setEditing(s)}><Pencil size={13} /></button>
                    <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(s)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={7} className="py-6 text-center text-slate-500">No schedule yet.</td></tr>}
            </tbody>
          </table>
        )}
      </Card>
      {editing && <Form row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </div>
  )
}

function Form({ row, onClose, onSaved }) {
  const [f, setF] = useState({ title: '', day_of_week: 1, start_time: '20:00', duration_min: 120, notes: '', active: true, ...row, start_time: String(row.start_time || '20:00').slice(0, 5) })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const payload = {
      title: f.title, day_of_week: Number(f.day_of_week), start_time: f.start_time,
      duration_min: Number(f.duration_min) || 60, notes: f.notes || null, active: f.active,
    }
    const q = supabase.from('schedules')
    const { error } = row.id ? await q.update(payload).eq('id', row.id) : await q.insert(payload)
    setBusy(false)
    if (error) setErr(error.message)
    else onSaved()
  }

  return (
    <Modal title={row.id ? 'Edit schedule' : 'Add schedule'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Title"><input className="input" required value={f.title} onChange={set('title')} placeholder="TDM Practice" /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Day">
            <select className="input" value={f.day_of_week} onChange={set('day_of_week')}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
          </Field>
          <Field label="Start time"><input className="input" type="time" required value={f.start_time} onChange={set('start_time')} /></Field>
          <Field label="Duration (min)"><input className="input" type="number" min="15" step="15" value={f.duration_min} onChange={set('duration_min')} /></Field>
        </div>
        <Field label="Notes"><input className="input" value={f.notes || ''} onChange={set('notes')} /></Field>
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

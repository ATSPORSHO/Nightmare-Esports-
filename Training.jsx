import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, Upload, CalendarClock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useLineup } from '../context/LineupContext'
import LineupSelect from '../components/LineupSelect'
import { DAYS, num, todayStr } from '../lib/format'
import { Card, ErrorBox, Field, Modal, PageHeader, Spinner } from '../components/ui'

export default function Training() {
  const { isAdmin } = useAuth()
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(null)
  const sessions = useData(() => supabase.from('training_sessions').select('*').order('held_on', { ascending: false }))
  const schedule = useData(() => supabase.from('schedules').select('*').eq('active', true).order('day_of_week').order('start_time'))

  useEffect(() => {
    if (isAdmin && params.get('new')) { setEditing({}); setParams({}, { replace: true }) }
  }, [params, isAdmin, setParams])

  const remove = async (s) => {
    if (!window.confirm('Delete this session?')) return
    await supabase.from('training_sessions').delete().eq('id', s.id)
    sessions.reload()
  }

  return (
    <div>
      <PageHeader
        title="Training"
        subtitle="Regular schedule and completed sessions."
        actions={
          <>
            <Link to="/submit/training" className="btn-ghost"><Upload size={16} /> Add training screenshot</Link>
            {isAdmin && <button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add session</button>}
          </>
        }
      />

      <Card title="Regular weekly schedule" icon={CalendarClock} className="mb-4">
        {schedule.loading ? <Spinner /> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(schedule.data || []).map((s) => (
              <div key={s.id} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-red-300">{DAYS[s.day_of_week]}</div>
                <div className="font-semibold text-white">{s.title}</div>
                <div className="text-sm text-slate-300">{String(s.start_time).slice(0, 5)} · {s.duration_min} min</div>
                {s.notes && <div className="mt-1 text-xs text-slate-500">{s.notes}</div>}
              </div>
            ))}
            {!schedule.data?.length && <div className="text-sm text-slate-500">No schedule set yet.</div>}
          </div>
        )}
        {isAdmin && <Link to="/admin?tab=schedules" className="mt-3 inline-block text-xs text-red-300 hover:text-white">Edit schedule in Admin Panel →</Link>}
      </Card>

      <ErrorBox>{sessions.error}</ErrorBox>
      <Card title="Sessions" className="overflow-x-auto">
        {sessions.loading ? <Spinner /> : (
          <table className="tbl">
            <thead><tr><th>Date</th><th>Session</th><th>Attendees</th><th>Expected</th><th className="text-right">Cost ({settings.currency})</th><th>Notes</th>{isAdmin && <th />}</tr></thead>
            <tbody>
              {(sessions.data || []).map((s) => (
                <tr key={s.id}>
                  <td>{s.held_on}</td><td className="font-medium text-white">{s.name}</td><td>{s.attendees}</td><td>{s.total_players}</td>
                  <td className="text-right">{num(s.cost)}</td><td className="max-w-[220px] truncate">{s.notes}</td>
                  {isAdmin && (
                    <td className="text-right">
                      <button className="btn-ghost btn-sm mr-1" onClick={() => setEditing(s)}><Pencil size={13} /></button>
                      <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(s)}><Trash2 size={13} /></button>
                    </td>
                  )}
                </tr>
              ))}
              {!sessions.data?.length && <tr><td colSpan={7} className="py-6 text-center text-slate-500">No sessions yet.</td></tr>}
            </tbody>
          </table>
        )}
      </Card>

      {editing && <SessionForm row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); sessions.reload() }} />}
    </div>
  )
}

function SessionForm({ row, onClose, onSaved }) {
  const { activeLineups } = useLineup()
  const [f, setF] = useState({ lineup_id: row.id ? (row.lineup_id || '') : (activeLineups[0]?.id || ''), held_on: todayStr(), name: '', attendees: 5, total_players: 5, cost: 0, notes: '', ...row })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const payload = {
      held_on: f.held_on, name: f.name, notes: f.notes || null, lineup_id: f.lineup_id || null,
      attendees: Number(f.attendees) || 0, total_players: Number(f.total_players) || 0, cost: Number(f.cost) || 0,
    }
    const q = supabase.from('training_sessions')
    const { error } = row.id ? await q.update(payload).eq('id', row.id) : await q.insert(payload)
    setBusy(false)
    if (error) setErr(error.message)
    else onSaved()
  }

  return (
    <Modal title={row.id ? 'Edit session' : 'Add training session'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date"><input className="input" type="date" required value={f.held_on} onChange={set('held_on')} /></Field>
          <Field label="Session name"><input className="input" required value={f.name} onChange={set('name')} placeholder="TDM Practice" /></Field>
          <Field label="Attendees"><input className="input" type="number" min="0" value={f.attendees} onChange={set('attendees')} /></Field>
          <Field label="Expected players"><input className="input" type="number" min="0" value={f.total_players} onChange={set('total_players')} /></Field>
          <Field label="Cost"><input className="input" type="number" min="0" step="any" value={f.cost} onChange={set('cost')} /></Field>
        </div>
        <Field label="Lineup"><LineupSelect value={f.lineup_id} allowShared sharedLabel="Organization (all lineups)" onChange={(v) => setF({ ...f, lineup_id: v })} /></Field>
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

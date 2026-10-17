import { useState } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useSettings } from '../../context/SettingsContext'
import { DAYS } from '../../lib/format'
import { Card, ErrorBox, Field, Notice } from '../../components/ui'

export default function RemindersAdmin() {
  const { settings, reload } = useSettings()
  const [f, setF] = useState({
    reminder_enabled: settings.reminder_enabled,
    reminder_hours_before: settings.reminder_hours_before,
    reminder_subject: settings.reminder_subject,
    reminder_message: settings.reminder_message,
  })
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setErr(''); setSaved(false)
    const { error } = await supabase.from('settings').update({ ...f, reminder_hours_before: Number(f.reminder_hours_before) || 2 }).eq('id', 1)
    if (error) return setErr(error.message)
    await reload()
    setSaved(true)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save}>
        <Card title="Automatic reminders (sent to every active player's Gmail)">
          <label className="mb-4 flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.reminder_enabled} onChange={set('reminder_enabled')} />
            Send a reminder automatically before every active item in Schedules
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Hours before the session"><input className="input" type="number" min="1" max="24" value={f.reminder_hours_before} onChange={set('reminder_hours_before')} /></Field>
            <Field label="E-mail subject" hint="Use {name}, {session}, {time}, {team}"><input className="input" value={f.reminder_subject} onChange={set('reminder_subject')} /></Field>
          </div>
          <div className="mt-4">
            <Field label="E-mail message" hint="A big “Add Training Screenshot” button is added below this text automatically. One tap signs the player in and opens the upload page.">
              <textarea className="input min-h-[90px]" value={f.reminder_message} onChange={set('reminder_message')} />
            </Field>
          </div>
          <ErrorBox>{err}</ErrorBox>
          {saved && <div className="mt-3"><Notice>Saved.</Notice></div>}
          <button className="btn-primary mt-4">Save reminder settings</button>
          <p className="mt-3 text-xs text-slate-500">Automatic sending needs the cron job from README step 7. “Send now” below works without it.</p>
        </Card>
      </form>
      <SendNow />
    </div>
  )
}

function SendNow() {
  const schedules = useData(() => supabase.from('schedules').select('*').eq('active', true).order('day_of_week').order('start_time'))
  const players = useData(() => supabase.from('profiles').select('id, full_name, ign, email, status').eq('role', 'player').order('created_at'))
  const [title, setTitle] = useState('Training')
  const [when, setWhen] = useState('')
  const [scheduleId, setScheduleId] = useState('')
  const [picked, setPicked] = useState(null) // null = all active players
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')

  const pickSchedule = (id) => {
    setScheduleId(id)
    const s = (schedules.data || []).find((x) => x.id === id)
    if (s) { setTitle(s.title); setWhen(String(s.start_time).slice(0, 5)) }
  }
  const togglePlayer = (id) => {
    const base = picked ?? (players.data || []).filter((p) => p.status === 'active').map((p) => p.id)
    setPicked(base.includes(id) ? base.filter((x) => x !== id) : [...base, id])
  }
  const isOn = (p) => (picked ? picked.includes(p.id) : p.status === 'active')

  const send = async () => {
    setBusy(true); setErr(''); setRes(null)
    const { data, error } = await supabase.functions.invoke('send-training-reminder', {
      body: { title, when, schedule_id: scheduleId || null, player_ids: picked },
    })
    setBusy(false)
    if (error) {
      try { setErr((await error.context.json()).error || error.message) } catch { setErr(error.message) }
      return
    }
    if (data?.error) return setErr(data.error)
    setRes(data)
  }

  return (
    <Card title="Send a reminder now">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Pick from schedule (optional)">
          <select className="input" value={scheduleId} onChange={(e) => pickSchedule(e.target.value)}>
            <option value="">— custom —</option>
            {(schedules.data || []).map((s) => <option key={s.id} value={s.id}>{DAYS[s.day_of_week]} {String(s.start_time).slice(0, 5)} · {s.title}</option>)}
          </select>
        </Field>
        <Field label="Session name"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Time shown in the e-mail"><input className="input" placeholder="20:00 tonight" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
      </div>

      <div className="mt-4">
        <span className="label">Send to</span>
        <div className="flex flex-wrap gap-2">
          {(players.data || []).map((p) => (
            <button key={p.id} type="button" onClick={() => togglePlayer(p.id)}
              className={`rounded-full border px-3 py-1 text-xs ${isOn(p) ? 'border-accent bg-accent/20 text-white' : 'border-ink-600 text-slate-500'}`}>
              {p.ign || p.full_name}
            </button>
          ))}
          {!players.data?.length && <span className="text-sm text-slate-500">Create player accounts first.</span>}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ErrorBox>{err}</ErrorBox>
        {res && (
          <Notice>
            Sent {res.sent} e-mail{res.sent === 1 ? '' : 's'}.
            {res.failures?.length > 0 && <div className="mt-1 text-xs text-amber-300">Failed: {res.failures.join(' · ')}</div>}
          </Notice>
        )}
        <button className="btn-primary" disabled={busy || !title} onClick={send}><Send size={16} /> {busy ? 'Sending…' : 'Send reminder'}</button>
      </div>
    </Card>
  )
}

import { useState } from 'react'
import { CalendarClock, Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { useSettings } from '../context/SettingsContext'
import { useLineup } from '../context/LineupContext'
import LineupSelect from './LineupSelect'
import { MAPS } from '../lib/constants'
import { Card, ErrorBox, Field, Modal, Spinner } from './ui'

const fmtDate = (d) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/**
 * Upcoming match schedule.
 *   editable = true  -> admin: add / edit / delete (Match Results page)
 *   editable = false -> read only list (dashboard)
 * Date and time are the TEAM's local time (the timezone set in Admin Panel -> Branding).
 */
export default function UpcomingMatches({ editable = false, limit = 5, bare = false, lineup = null }) {
  const { settings } = useSettings()
  const { activeLineups, lineupName } = useLineup()
  const multi = activeLineups.length > 1
  const [editing, setEditing] = useState(null)
  const [showPast, setShowPast] = useState(false)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: settings.timezone }).format(new Date())

  const { data, loading, error, reload } = useData(() =>
    supabase.from('match_schedule').select('*').order('match_date').order('match_time'))

  // on a lineup dashboard: that lineup's matches + matches shared by every lineup
  const all = (data || []).filter((m) => !lineup || !m.lineup_id || m.lineup_id === lineup.id)
  const upcoming = all.filter((m) => m.match_date >= today)
  const past = all.filter((m) => m.match_date < today).reverse()
  const rows = (showPast && editable ? [...past, ...upcoming] : upcoming).slice(0, editable ? 200 : limit)

  const remove = async (m) => {
    if (!window.confirm('Delete this scheduled match?')) return
    await supabase.from('match_schedule').delete().eq('id', m.id)
    reload()
  }

  const body = (
    <>
      <ErrorBox>{error}</ErrorBox>
      {loading ? <Spinner /> : (
        <ul className="divide-y divide-ink-700/50">
          {rows.map((m) => (
            <li key={m.id} className={`flex flex-wrap items-center gap-3 py-2.5 ${m.match_date < today ? 'opacity-50' : ''}`}>
              <div className="w-[84px] shrink-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-red-300">
                  {m.match_date === today ? 'Today' : fmtDate(m.match_date)}
                </div>
                <div className="font-display text-xl font-bold leading-tight text-white">{String(m.match_time).slice(0, 5)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{m.tournament}</div>
                <div className="truncate text-xs text-slate-400">
                  {[multi || m.lineup_id ? (m.lineup_id ? lineupName(m.lineup_id) : 'All lineups') : null, m.stage, m.map].filter(Boolean).join(' · ')}{m.notes ? ` — ${m.notes}` : ''}
                </div>
              </div>
              {editable && (
                <div className="flex gap-1">
                  <button className="btn-ghost btn-sm" onClick={() => setEditing(m)}><Pencil size={13} /></button>
                  <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(m)}><Trash2 size={13} /></button>
                </div>
              )}
            </li>
          ))}
          {!rows.length && <li className="py-4 text-center text-sm text-slate-500">No upcoming matches scheduled.</li>}
        </ul>
      )}
      {editing && (
        <ScheduleForm
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload() }}
          today={today}
        />
      )}
    </>
  )

  if (bare) return body

  return (
    <Card
      title="Upcoming Matches"
      icon={CalendarClock}
      className="mb-4"
    >
      {editable && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
            Show past
          </label>
          <button className="btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={14} /> Schedule match</button>
        </div>
      )}
      {body}
      {!editable && <div className="mt-2 text-[10px] text-slate-600">Times shown in {settings.timezone}</div>}
    </Card>
  )
}

function ScheduleForm({ row, onClose, onSaved, today }) {
  const { activeLineups } = useLineup()
  const [f, setF] = useState({
    lineup_id: activeLineups[0]?.id || '', match_date: today, match_time: '20:00', tournament: '', stage: '', map: '', notes: '', ...row,
    match_time: String(row.match_time || '20:00').slice(0, 5),
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const payload = {
      match_date: f.match_date, match_time: f.match_time, tournament: f.tournament,
      stage: f.stage || null, notes: f.notes || null, lineup_id: f.lineup_id || null,
    }
    const q = supabase.from('match_schedule')
    const { error } = row.id ? await q.update(payload).eq('id', row.id) : await q.insert(payload)
    setBusy(false)
    if (error) setErr(error.message)
    else onSaved()
  }

  return (
    <Modal title={row.id ? 'Edit scheduled match' : 'Schedule a match'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Lineup" hint="Which team plays this match.">
          <LineupSelect value={f.lineup_id} allowShared sharedLabel="All lineups" onChange={(v) => setF({ ...f, lineup_id: v })} />
        </Field>
        <Field label="Tournament / scrim"><input className="input" required value={f.tournament} onChange={set('tournament')} placeholder="PMPL SEA" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date"><input className="input" type="date" required value={f.match_date} onChange={set('match_date')} /></Field>
          <Field label="Time (team timezone)"><input className="input" type="time" required value={f.match_time} onChange={set('match_time')} /></Field>
          <Field label="Stage / round"><input className="input" value={f.stage || ''} onChange={set('stage')} placeholder="Week 2 Day 3" /></Field>
        </div>
        <Field label="Notes"><input className="input" value={f.notes || ''} onChange={set('notes')} placeholder="Be online 30 min before" /></Field>
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

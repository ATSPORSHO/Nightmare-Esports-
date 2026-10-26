import { useState } from 'react'
import { Check, X, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { ErrorBox, Modal, Spinner } from '../../components/ui'
import Flag from '../../components/Flag'

/** Admin: teams that registered. Approve = the team (and its players) is added to the tournament's teams. */
export default function RegistrationsAdmin({ tournament, onClose }) {
  const { data, loading, error, reload } = useData(() => supabase.from('treg_entries').select('*').eq('tournament_id', tournament.id).order('created_at'), [tournament.id])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const rows = data || []

  const approve = async (r) => {
    setBusy(r.id); setErr('')
    try {
      const team = await supabase.from('tournament_teams').insert({ tournament_id: tournament.id, name: r.team_name, tag: r.tag || null, ...(r.country ? { country: r.country } : {}) }).select('id').single()
      if (team.error) throw team.error
      const pl = (r.players || []).map((name, i) => ({ team_id: team.data.id, tournament_id: tournament.id, name, sort: i + 1 }))
      if (pl.length) { const p = await supabase.from('tournament_team_players').insert(pl); if (p.error) throw p.error }
      const u = await supabase.from('treg_entries').update({ status: 'approved' }).eq('id', r.id)
      if (u.error) throw u.error
      reload()
    } catch (e) { setErr(e.message || String(e)) }
    setBusy('')
  }
  const setStatus = async (r, status) => { await supabase.from('treg_entries').update({ status }).eq('id', r.id); reload() }
  const remove = async (r) => { if (window.confirm(`Delete the registration of ${r.team_name}?`)) { await supabase.from('treg_entries').delete().eq('id', r.id); reload() } }

  const badge = { pending: 'badge-amber', approved: 'badge-green', rejected: 'badge-accent' }
  return (
    <Modal title={`Registrations — ${tournament.title}`} onClose={onClose} wide>
      <ErrorBox>{error || err}</ErrorBox>
      {loading ? <Spinner /> : !rows.length ? (
        <div className="py-8 text-center text-sm text-slate-400">No registrations yet. (Run supabase/registration.sql once if you have not.)</div>
      ) : (
        <ul className="divide-y divide-ink-700/60">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-3 py-3">
              <div className="min-w-[220px] flex-1">
                <div className="flex items-center gap-2 font-semibold text-white"><Flag code={r.country} h="14px" />{r.team_name}{r.tag ? ` [${r.tag}]` : ''} <span className={badge[r.status] || 'badge-amber'}>{r.status}</span></div>
                <div className="text-xs text-slate-400">Contact: {r.contact} · {new Date(r.created_at).toLocaleString('en-GB')}</div>
                <div className="mt-1 text-xs text-slate-300">{(r.players || []).join(' · ')}</div>
              </div>
              <div className="flex items-center gap-1.5">
                {r.status !== 'approved' && <button className="btn-primary btn-sm" disabled={busy === r.id} onClick={() => approve(r)}><Check size={13} /> Approve</button>}
                {r.status === 'pending' && <button className="btn-ghost btn-sm text-amber-300" onClick={() => setStatus(r, 'rejected')}><X size={13} /> Reject</button>}
                <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(r)}><Trash2 size={13} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">Approving adds the team and its players to the tournament (Teams &amp; groups). Add the team logo there afterwards.</p>
    </Modal>
  )
}

import { useMemo, useState } from 'react'
import { Check, X, Download, ExternalLink, Ban } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { ErrorBox, Notice, Spinner } from '../../components/ui'
import Flag from '../../components/Flag'

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

/** Every registration ever received (pending, approved, rejected, cancelled) with the team leader details.
 *  Cancel = the code (e.g. #101) is given back and the next team that registers receives it again. */
export default function RegistrationsAll({ tournamentId = null }) {
  const { data, loading, error, reload } = useData(() => {
    let q = supabase.from('treg_entries').select('*').order('created_at', { ascending: false })
    if (tournamentId) q = q.eq('tournament_id', tournamentId)
    return q
  }, [tournamentId])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [tour, setTour] = useState('all')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')
  const rows = data || []

  const tours = useMemo(() => [...new Set(rows.map((r) => r.tournament_title).filter(Boolean))], [rows])
  const codeOf = (r) => r.reg_code ?? r.cancelled_code
  const list = rows.filter((r) => (status === 'all' || r.status === status) && (tour === 'all' || r.tournament_title === tour)
    && (!q.trim() || [codeOf(r), r.team_name, r.tag, r.leader_name, r.contact, ...(r.players || [])].join(' ').toLowerCase().includes(q.trim().toLowerCase().replace(/^#/, ''))))
  const count = (s) => rows.filter((r) => r.status === s).length

  const approve = async (r) => {
    setBusy(r.id); setErr(''); setMsg('')
    try {
      if (r.tournament_id) {
        const team = await supabase.from('tournament_teams').insert({ tournament_id: r.tournament_id, name: r.team_name, tag: r.tag || null, ...(r.country ? { country: r.country } : {}) }).select('id').single()
        if (team.error) throw team.error
        const pl = (r.players || []).map((name, i) => ({ team_id: team.data.id, tournament_id: r.tournament_id, name, sort: i + 1 }))
        if (pl.length) { const p = await supabase.from('tournament_team_players').insert(pl); if (p.error) throw p.error }
      }
      const u = await supabase.from('treg_entries').update({ status: 'approved' }).eq('id', r.id)
      if (u.error) throw u.error
      reload()
    } catch (e) { setErr(e.message || String(e)) }
    setBusy('')
  }
  const setSt = async (r, s) => { setErr(''); const u = await supabase.from('treg_entries').update({ status: s }).eq('id', r.id); if (u.error) setErr(u.error.message); reload() }

  /** cancel: the row stays as a record, but its code is released so the next team can get it */
  const cancel = async (r) => {
    if (!window.confirm(`Cancel the registration of ${r.team_name}?\n\nToken #${r.reg_code} will be free again and the next team that registers gets it.`)) return
    setBusy(r.id); setErr(''); setMsg('')
    try {
      let note = ''
      if (r.status === 'approved' && r.tournament_id) {
        // the team was added to the tournament: remove it again unless it is already in a group
        const t = await supabase.from('tournament_teams').select('id').eq('tournament_id', r.tournament_id).eq('name', r.team_name)
        const ids = (t.data || []).map((x) => x.id)
        if (ids.length) {
          const g = await supabase.from('tournament_group_teams').select('id').in('team_id', ids).limit(1)
          if ((g.data || []).length) note = ' The team is already in a group, so remove it yourself in Teams & groups.'
          else await supabase.from('tournament_teams').delete().in('id', ids)
        }
      }
      const u = await supabase.from('treg_entries').update({ status: 'cancelled', cancelled_code: r.reg_code, reg_code: null }).eq('id', r.id)
      if (u.error) throw u.error
      setMsg(`Registration cancelled. Token #${r.reg_code} can be used again.${note}`)
      reload()
    } catch (e) { setErr(/reg_code/.test(e.message || '') ? 'The database is not updated yet. Run supabase/fix-reg-code.sql once in Supabase (SQL Editor), then press Cancel again.' : (e.message || String(e))) }
    setBusy('')
  }

  const exportCsv = () => {
    const head = ['Code', 'Tournament', 'Team', 'Tag', 'Country', 'Team leader', 'Contact', 'Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6', 'Team logo (Drive)', 'Player photos (Drive)', 'Status', 'Submitted']
    const lines = [head, ...list.map((r) => [r.reg_code ?? (r.cancelled_code ? `cancelled (was ${r.cancelled_code})` : ''), r.tournament_title, r.team_name, r.tag, r.country, r.leader_name, r.contact, ...Array.from({ length: 6 }, (_, i) => (r.players || [])[i] || ''), r.logo_drive_url, r.drive_url, r.status, new Date(r.created_at).toLocaleString('en-GB')])]
    const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'registrations.csv'; a.click()
  }

  const badge = { pending: 'badge-amber', approved: 'badge-green', rejected: 'badge-accent', cancelled: 'badge-accent' }
  const link = (u, label) => (u ? <a href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-red-400 hover:text-red-300">{label} <ExternalLink size={11} /></a> : <span className="text-slate-600">{label}: —</span>)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1"><span className="label">Search (code, team, leader, contact, player)</span><input className="input" placeholder="e.g. 101" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label><span className="label">Status</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All ({rows.length})</option><option value="pending">Pending ({count('pending')})</option><option value="approved">Approved ({count('approved')})</option><option value="rejected">Rejected ({count('rejected')})</option><option value="cancelled">Cancelled ({count('cancelled')})</option>
          </select>
        </label>
        {!tournamentId && tours.length > 1 && (
          <label><span className="label">Tournament</span>
            <select className="input" value={tour} onChange={(e) => setTour(e.target.value)}><option value="all">All</option>{tours.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
        )}
        <button className="btn-ghost" onClick={exportCsv} disabled={!list.length}><Download size={14} /> Export CSV</button>
      </div>
      <ErrorBox>{error || err}</ErrorBox>
      {msg && <Notice>{msg}</Notice>}
      {loading ? <Spinner /> : !list.length ? (
        <div className="py-8 text-center text-sm text-slate-400">No registrations found. (Run supabase/registration.sql once if you have not.)</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-950 text-[11px] uppercase tracking-wider text-slate-400">
              <tr><th className="px-3 py-2 text-left">Token</th><th className="px-3 py-2 text-left">Team</th><th className="px-3 py-2 text-left">Team leader</th><th className="px-3 py-2 text-left">Players</th><th className="px-3 py-2 text-left">Drive files</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={`border-t border-ink-700/60 align-top ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2 font-display text-lg font-extrabold text-white">{r.reg_code ? `#${r.reg_code}` : <span className="text-xs font-normal text-slate-500">released{r.cancelled_code ? ` (was #${r.cancelled_code})` : ''}</span>}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1.5 font-semibold text-white"><Flag code={r.country} h="14px" />{r.team_name}{r.tag ? ` [${r.tag}]` : ''}</div><div className="text-[11px] text-slate-500">{r.tournament_title} · {new Date(r.created_at).toLocaleString('en-GB')}</div></td>
                  <td className="px-3 py-2 text-xs text-slate-300"><div className="font-semibold text-white">{r.leader_name || '—'}</div><div>{r.contact}</div></td>
                  <td className="px-3 py-2 text-xs text-slate-300">{(r.players || []).map((p, i) => <div key={i}>{i + 1}. {p}{i >= 4 ? ' (opt.)' : ''}</div>)}</td>
                  <td className="px-3 py-2 text-xs"><div>{link(r.logo_drive_url, 'Team logo')}</div><div className="mt-1">{link(r.drive_url, 'Player photos')}</div></td>
                  <td className="px-3 py-2 text-center"><span className={badge[r.status] || 'badge-amber'}>{r.status}</span></td>
                  <td className="px-3 py-2"><div className="flex flex-wrap justify-end gap-1.5">
                    {['pending', 'rejected'].includes(r.status) && <button className="btn-primary btn-sm" disabled={busy === r.id} onClick={() => approve(r)}><Check size={13} /> Approve</button>}
                    {r.status === 'pending' && <button className="btn-ghost btn-sm text-amber-300" title="Reject (the token stays reserved)" onClick={() => setSt(r, 'rejected')}><X size={13} /></button>}
                    {r.status === 'rejected' && <button className="btn-ghost btn-sm" onClick={() => setSt(r, 'pending')}>Reopen</button>}
                    {r.status !== 'cancelled' && <button className="btn-ghost btn-sm text-red-300" disabled={busy === r.id} title="Cancel the registration and free the token" onClick={() => cancel(r)}><Ban size={13} /> Cancel</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">All registrations stay saved here. <b>Cancel</b> gives the token number back: the next team that registers gets the lowest free number from 101. Approving adds the team and its players to the tournament (Teams &amp; groups).</p>
    </div>
  )
}

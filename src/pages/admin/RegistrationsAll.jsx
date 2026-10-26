import { useMemo, useState } from 'react'
import { Check, X, Download, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { ErrorBox, Spinner } from '../../components/ui'
import Flag from '../../components/Flag'

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

/** Every registration ever received (pending, approved or rejected) — nothing is deleted. Search by code, team or contact. */
export default function RegistrationsAll({ tournamentId = null }) {
  const { data, loading, error, reload } = useData(() => {
    let q = supabase.from('treg_entries').select('*').order('reg_code', { ascending: false })
    if (tournamentId) q = q.eq('tournament_id', tournamentId)
    return q
  }, [tournamentId])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [tour, setTour] = useState('all')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const rows = data || []

  const tours = useMemo(() => [...new Set(rows.map((r) => r.tournament_title).filter(Boolean))], [rows])
  const list = rows.filter((r) => (status === 'all' || r.status === status) && (tour === 'all' || r.tournament_title === tour)
    && (!q.trim() || [r.reg_code, r.team_name, r.tag, r.contact, ...(r.players || [])].join(' ').toLowerCase().includes(q.trim().toLowerCase().replace(/^#/, ''))))
  const count = (s) => rows.filter((r) => r.status === s).length

  const approve = async (r) => {
    setBusy(r.id); setErr('')
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
  const setSt = async (r, s) => { await supabase.from('treg_entries').update({ status: s }).eq('id', r.id); reload() }

  const exportCsv = () => {
    const head = ['Code', 'Tournament', 'Team', 'Tag', 'Country', 'Contact', 'Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6', 'Photos (Drive)', 'Status', 'Submitted']
    const lines = [head, ...list.map((r) => [r.reg_code, r.tournament_title, r.team_name, r.tag, r.country, r.contact, ...Array.from({ length: 6 }, (_, i) => (r.players || [])[i] || ''), r.drive_url, r.status, new Date(r.created_at).toLocaleString('en-GB')])]
    const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'registrations.csv'; a.click()
  }

  const badge = { pending: 'badge-amber', approved: 'badge-green', rejected: 'badge-accent' }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1"><span className="label">Search (code, team, contact, player)</span><input className="input" placeholder="e.g. 101" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label><span className="label">Status</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All ({rows.length})</option><option value="pending">Pending ({count('pending')})</option><option value="approved">Approved ({count('approved')})</option><option value="rejected">Rejected ({count('rejected')})</option>
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
      {loading ? <Spinner /> : !list.length ? (
        <div className="py-8 text-center text-sm text-slate-400">No registrations found. (Run supabase/registration.sql once if you have not.)</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-950 text-[11px] uppercase tracking-wider text-slate-400">
              <tr><th className="px-3 py-2 text-left">Code</th><th className="px-3 py-2 text-left">Team</th><th className="px-3 py-2 text-left">Players</th><th className="px-3 py-2 text-left">Contact</th><th className="px-3 py-2 text-left">Photos</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-ink-700/60 align-top">
                  <td className="px-3 py-2 font-display text-lg font-extrabold text-white">#{r.reg_code}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1.5 font-semibold text-white"><Flag code={r.country} h="14px" />{r.team_name}{r.tag ? ` [${r.tag}]` : ''}</div><div className="text-[11px] text-slate-500">{r.tournament_title} · {new Date(r.created_at).toLocaleString('en-GB')}</div></td>
                  <td className="px-3 py-2 text-xs text-slate-300">{(r.players || []).map((p, i) => <div key={i}>{i + 1}. {p}{i >= 4 ? ' (opt.)' : ''}</div>)}</td>
                  <td className="px-3 py-2 text-xs text-slate-300">{r.contact}</td>
                  <td className="px-3 py-2 text-xs">{r.drive_url ? <a href={r.drive_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-red-400 hover:text-red-300">Open <ExternalLink size={11} /></a> : '—'}</td>
                  <td className="px-3 py-2 text-center"><span className={badge[r.status] || 'badge-amber'}>{r.status}</span></td>
                  <td className="px-3 py-2"><div className="flex justify-end gap-1.5">
                    {r.status !== 'approved' && <button className="btn-primary btn-sm" disabled={busy === r.id} onClick={() => approve(r)}><Check size={13} /> Approve</button>}
                    {r.status === 'pending' && <button className="btn-ghost btn-sm text-amber-300" onClick={() => setSt(r, 'rejected')}><X size={13} /></button>}
                    {r.status === 'rejected' && <button className="btn-ghost btn-sm" onClick={() => setSt(r, 'pending')}>Reopen</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">All registrations stay saved here, approved or not. Approving adds the team and its players to the tournament (Teams &amp; groups); add the team logo there afterwards.</p>
    </div>
  )
}

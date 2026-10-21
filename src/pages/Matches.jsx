import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { useAuth } from '../context/AuthContext'
import { MAPS } from '../lib/constants'
import { todayStr } from '../lib/format'
import { Card, ErrorBox, Field, Modal, PageHeader, Spinner } from '../components/ui'
import UpcomingMatches from '../components/UpcomingMatches'
import { matchPoints, placementPoints } from '../lib/points'

const blank = () => ({ played_on: todayStr(), tournament: '', map: 'Erangel', placement: '', kills: 0, notes: '' })

export default function Matches() {
  const { isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(null) // null | {} (new) | match
  const { data, loading, error, reload } = useData(() => supabase.from('matches').select('*').order('played_on', { ascending: false }))
  const roster = useData(() => supabase.from('profiles').select('id, full_name, ign').eq('role', 'player').order('sort_order').order('created_at'))

  useEffect(() => {
    if (isAdmin && params.get('new')) { setEditing(blank()); setParams({}, { replace: true }) }
  }, [params, isAdmin, setParams])

  const remove = async (m) => {
    if (!window.confirm('Delete this match?')) return
    await supabase.from('matches').delete().eq('id', m.id)
    reload()
  }

  return (
    <div>
      <PageHeader
        title="Match Results"
        subtitle="Tournament and scrim results."
        actions={isAdmin && <button className="btn-primary" onClick={() => setEditing(blank())}><Plus size={16} /> Add match</button>}
      />
      <UpcomingMatches editable={isAdmin} />
      <ErrorBox>{error}</ErrorBox>
      <Card className="overflow-x-auto">
        {loading ? <Spinner /> : (
          <table className="tbl">
            <thead><tr><th>Date</th><th>Tournament</th><th>Map</th><th>Placement</th><th>Kills</th><th>Points</th><th>Notes</th>{isAdmin && <th />}</tr></thead>
            <tbody>
              {(data || []).map((m) => (
                <tr key={m.id}>
                  <td>{m.played_on}</td><td className="font-medium text-white">{m.tournament}</td><td>{m.map}</td>
                  <td>{m.placement ? `#${m.placement}` : '—'}</td><td>{m.kills}</td><td className="font-semibold text-white">{m.points}</td>
                  <td className="max-w-[240px] truncate">{m.notes}</td>
                  {isAdmin && (
                    <td className="text-right">
                      <button className="btn-ghost btn-sm mr-1" onClick={() => setEditing(m)}><Pencil size={13} /></button>
                      <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(m)}><Trash2 size={13} /></button>
                    </td>
                  )}
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={8} className="py-6 text-center text-slate-500">No matches yet.</td></tr>}
            </tbody>
          </table>
        )}
      </Card>
      {editing && <MatchForm match={editing} roster={roster.data || []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </div>
  )
}

function MatchForm({ match, roster, onClose, onSaved }) {
  const [f, setF] = useState({ ...match })
  const [stats, setStats] = useState({}) // player_id -> { kills, points }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => {
    if (!match.id) return
    supabase.from('match_player_stats').select('*').eq('match_id', match.id).then(({ data }) => {
      const s = {}
      ;(data || []).forEach((r) => { s[r.player_id] = { played: true, kills: r.kills, damage: r.damage, assists: r.assists, rating: r.rating ?? '', survival: r.survival_minutes } })
      setStats(s)
    })
  }, [match.id])

  // players' kills add up to the team's kills automatically (only players who played)
  const teamKills = (s) => Object.values(s).reduce((t, x) => t + (x.played ? Number(x.kills) || 0 : 0), 0)
  const setPlayer = (id, k, v) => {
    const next = { ...stats, [id]: { ...stats[id], [k]: v } }
    setStats(next)
    setF((cur) => ({ ...cur, kills: teamKills(next) }))
  }
  const togglePlayed = (id) => setPlayer(id, 'played', !stats[id]?.played)

  // points are calculated: placement points + 1 per kill
  const placePts = placementPoints(f.placement)
  const totalPts = matchPoints(f.placement, f.kills)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const row = {
      played_on: f.played_on, tournament: f.tournament, map: f.map, notes: f.notes || null,
      placement: f.placement === '' ? null : Number(f.placement), points: totalPts, kills: Number(f.kills) || 0,
    }
    let id = match.id
    let res
    if (id) res = await supabase.from('matches').update(row).eq('id', id)
    else { res = await supabase.from('matches').insert(row).select('id').single(); id = res.data?.id }
    if (res.error) { setErr(res.error.message); setBusy(false); return }

    // replace per-player stats
    await supabase.from('match_player_stats').delete().eq('match_id', id)
    const rows = Object.entries(stats)
      .filter(([, v]) => v.played)
      .map(([player_id, v]) => ({
        match_id: id, player_id, kills: Number(v.kills) || 0, points: Number(v.kills) || 0,
        damage: Number(v.damage) || 0, assists: Number(v.assists) || 0,
        rating: v.rating === '' || v.rating == null ? null : Number(v.rating),
        survival_minutes: Number(v.survival) || 0,
      }))
    if (rows.length) {
      const r2 = await supabase.from('match_player_stats').insert(rows)
      if (r2.error) { setErr(r2.error.message); setBusy(false); return }
    }
    onSaved()
  }

  return (
    <Modal title={match.id ? 'Edit match' : 'Add match'} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date"><input className="input" type="date" required value={f.played_on} onChange={set('played_on')} /></Field>
          <Field label="Tournament / Scrim"><input className="input" required value={f.tournament} onChange={set('tournament')} placeholder="PMPL SEA" /></Field>
          <Field label="Map">
            <select className="input" value={f.map || ''} onChange={set('map')}>{MAPS.map((m) => <option key={m}>{m}</option>)}</select>
          </Field>
          <Field label="Placement (1st, 2nd, ...)"><input className="input" type="number" min="1" max="100" value={f.placement ?? ''} onChange={set('placement')} /></Field>
          <Field label="Team kills"><input className="input" type="number" min="0" value={f.kills} onChange={set('kills')} /></Field>
          <Field label="Team points (automatic)">
            <div className="input flex items-center justify-between !bg-ink-800 font-display text-xl font-bold text-white">
              <span>{totalPts}</span>
              <span className="text-[11px] font-normal text-slate-400">{placePts} placement + {Number(f.kills) || 0} kills</span>
            </div>
          </Field>
        </div>
        <p className="text-[11px] text-slate-500">
          Points: 1st = 10 · 2nd = 6 · 3rd = 5 · 4th = 4 · 5th = 3 · 6th = 2 · 7th–8th = 1 · 9th–25th = 0 · plus 1 point per kill.
        </p>
        <Field label="Notes"><input className="input" value={f.notes || ''} onChange={set('notes')} /></Field>

        {roster.length > 0 && (
          <div>
            <div className="label">Who played? Tick the players, then enter their stats (kills add up to team kills)</div>
            <div className="overflow-x-auto rounded-lg border border-ink-700 p-2">
              <div className="grid min-w-[560px] grid-cols-[28px_1fr_70px_80px_70px_70px_90px] items-center gap-2 px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <span /><span>Player</span><span>Kills</span><span>Damage</span><span>Assists</span><span>Rating</span><span>Survival (min)</span>
              </div>
              {roster.map((p) => {
                const st = stats[p.id] || {}
                const on = !!st.played
                return (
                  <div key={p.id} className={`grid min-w-[560px] grid-cols-[28px_1fr_70px_80px_70px_70px_90px] items-center gap-2 px-1 py-0.5 text-sm ${on ? '' : 'opacity-60'}`}>
                    <input type="checkbox" checked={on} onChange={() => togglePlayed(p.id)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
                    <span className="truncate">{p.ign || p.full_name}</span>
                    <input className="input !py-1" type="number" min="0" disabled={!on} value={st.kills ?? ''} onChange={(e) => setPlayer(p.id, 'kills', e.target.value)} />
                    <input className="input !py-1" type="number" min="0" disabled={!on} value={st.damage ?? ''} onChange={(e) => setPlayer(p.id, 'damage', e.target.value)} />
                    <input className="input !py-1" type="number" min="0" disabled={!on} value={st.assists ?? ''} onChange={(e) => setPlayer(p.id, 'assists', e.target.value)} />
                    <input className="input !py-1" type="number" min="0" max="10" step="0.1" disabled={!on} value={st.rating ?? ''} onChange={(e) => setPlayer(p.id, 'rating', e.target.value)} />
                    <input className="input !py-1" type="number" min="0" step="0.1" disabled={!on} value={st.survival ?? ''} onChange={(e) => setPlayer(p.id, 'survival', e.target.value)} />
                  </div>
                )
              })}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Averages in reports use only the matches a player is ticked for.</p>
          </div>
        )}
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save match'}</button>
        </div>
      </form>
    </Modal>
  )
}

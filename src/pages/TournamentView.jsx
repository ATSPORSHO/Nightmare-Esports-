import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Trophy } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { Spinner } from '../components/ui'

const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '—')
const fmtTime = (t) => {
  if (!t) return '—'
  const [h, m] = String(t).split(':').map(Number)
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/** Public page: tournament name, one tab per group, date + match time, qualifiers and the slot list. */
export default function TournamentView() {
  const { id } = useParams()
  const { data, loading } = useData(async () => {
    const [t, g, tm] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).maybeSingle(),
      supabase.from('tournament_groups').select('*').eq('tournament_id', id).order('sort'),
      supabase.from('tournament_teams').select('*').eq('tournament_id', id).order('slot'),
    ])
    return { data: { t: t.data, groups: g.data || [], teams: tm.data || [] } }
  }, [id])
  const [pick, setPick] = useState(null)

  const group = useMemo(() => {
    if (!data) return null
    return data.groups.find((g) => g.id === pick) || data.groups[0] || null
  }, [data, pick])

  if (loading || !data) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!data.t) return <div className="py-24 text-center text-slate-400">Tournament not found. <Link to="/" className="text-red-400">Back to home</Link></div>

  const rows = group ? data.teams.filter((x) => x.group_id === group.id).sort((a, b) => (a.slot || 0) - (b.slot || 0)) : []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300"><ArrowLeft size={13} /> Back to home</Link>

      {data.groups.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {data.groups.map((g) => (
            <button key={g.id} onClick={() => setPick(g.id)} className={`btn btn-sm ${group?.id === g.id ? 'bg-accent text-white' : 'border border-ink-600 text-slate-300'}`}>{g.name}</button>
          ))}
        </div>
      )}

      {!group ? (
        <div className="card py-10 text-center text-sm text-slate-400">Groups have not been drawn yet.</div>
      ) : (
        <div className="dark-scope overflow-hidden rounded-2xl border border-red-900/60 bg-ink-950">
          <div className="h-1.5 bg-accent" />
          <div className="divide-y divide-ink-700">
            {[
              ['Tournament', data.t.title, true],
              ['Group', group.name, true],
              ['Date', fmtDate(group.match_date)],
              ['Time', `${fmtTime(group.match_time)}${group.match_note ? ` (${group.match_note.toUpperCase()})` : ''}`],
            ].map(([k, v, strong]) => (
              <div key={k} className="flex items-center justify-between gap-4 bg-ink-900 px-5 py-3.5 text-sm">
                <span className="text-slate-400">{k}</span>
                <span className={`text-right ${strong ? 'font-display font-extrabold uppercase tracking-wide text-white' : 'text-white'}`}>{v}</span>
              </div>
            ))}
          </div>
          {group.qualify > 0 && (
            <div className="border-y border-ink-700 bg-ink-950 px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#ff5a67]">
              Top {group.qualify} teams will qualify from this group
            </div>
          )}
          <div className="grid grid-cols-[70px_1fr] border-b border-ink-700 bg-ink-950 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>Slot</span><span>Team name</span>
          </div>
          {rows.map((t, i) => (
            <div key={t.id} className={`grid grid-cols-[70px_1fr] items-center px-5 py-3 text-sm uppercase ${t.is_ours ? 'bg-red-950/60 font-bold text-white' : i % 2 ? 'bg-ink-900 text-slate-200' : 'bg-ink-850 text-slate-200'}`}>
              <span className="font-bold text-[#ff5a67]">{t.slot}</span>
              <span className="flex items-center gap-2">
                {t.name}
                {i < group.qualify && <Trophy size={12} className="text-amber-300" title="Qualification spot" />}
              </span>
            </div>
          ))}
          {!rows.length && <div className="px-5 py-6 text-center text-sm text-slate-500">No teams in this group.</div>}
        </div>
      )}
    </div>
  )
}

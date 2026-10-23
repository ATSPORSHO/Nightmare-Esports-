import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { Spinner } from '../components/ui'
import { rank, totalOf } from '../lib/tournament'

const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '—')
const fmtTime = (t) => {
  if (!t) return '—'
  const [h, m] = String(t).split(':').map(Number)
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/** Public page: pick a round (past rounds stay visible); every group of that round is shown on one page. */
export default function TournamentView() {
  const { id } = useParams()
  const { data, loading } = useData(async () => {
    const [t, r, g, gt, tm] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).maybeSingle(),
      supabase.from('tournament_rounds').select('*').eq('tournament_id', id).order('sort'),
      supabase.from('tournament_groups').select('*').eq('tournament_id', id).order('sort'),
      supabase.from('tournament_group_teams').select('*').eq('tournament_id', id),
      supabase.from('tournament_teams').select('*').eq('tournament_id', id),
    ])
    return { data: { t: t.data, rounds: r.data || [], groups: g.data || [], gts: gt.data || [], teams: tm.data || [] } }
  }, [id])
  const [pick, setPick] = useState(null)

  if (loading || !data) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!data.t) return <div className="py-24 text-center text-slate-400">Tournament not found. <Link to="/" className="text-red-400">Back to home</Link></div>

  const { rounds, groups, gts, teams } = data
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]))
  const current = rounds.find((r) => r.id === pick) || rounds[rounds.length - 1] || null
  const shown = current ? groups.filter((g) => g.round_id === current.id) : []
  const rowsOf = (g) => gts.filter((x) => x.group_id === g.id).sort((a, b) => (a.slot || 0) - (b.slot || 0))
  const isLatest = current && rounds[rounds.length - 1]?.id === current.id
  const ended = current?.status === 'ended'
  const overall = ended ? rank(shown.flatMap((g) => rowsOf(g))) : []

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300"><ArrowLeft size={13} /> Back to home</Link>
      <h1 className="font-display text-2xl font-extrabold uppercase tracking-wide text-white sm:text-3xl">{data.t.title}</h1>

      {rounds.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rounds:</span>
          {rounds.map((r, i) => (
            <button key={r.id} onClick={() => setPick(r.id)} className={`btn btn-sm ${current?.id === r.id ? 'bg-accent text-white' : 'border border-ink-600 text-slate-300'}`}>
              {r.name}{i === rounds.length - 1 ? ' · current' : ''}
            </button>
          ))}
        </div>
      )}

      {ended && shown.length > 1 && (
        <div className="dark-scope mx-auto max-w-3xl overflow-hidden rounded-2xl border border-red-900/60 bg-ink-950">
          <div className="h-1.5 bg-accent" />
          <div className="bg-ink-900 px-5 py-3 text-center font-display text-sm font-extrabold uppercase tracking-wider text-white">{current.name} — overall leaderboard</div>
          <Board entries={overall} teamById={teamById} />
        </div>
      )}

      {!shown.length ? (
        <div className="card py-10 text-center text-sm text-slate-400">Groups have not been drawn yet.</div>
      ) : (
        <div className={`grid items-start gap-5 ${shown.length > 1 ? 'lg:grid-cols-2' : 'mx-auto max-w-3xl'}`}>
          {shown.map((group) => {
            const rows = rowsOf(group)
            return (
              <div key={group.id} className="dark-scope overflow-hidden rounded-2xl border border-red-900/60 bg-ink-950">
                <div className="h-1.5 bg-accent" />
                <div className="divide-y divide-ink-700">
                  {[
                    ['Tournament', data.t.title, true],
                    ['Round', current.name, true],
                    ['Group', group.name, true],
                    ['Date', fmtDate(group.match_date)],
                    ['Time', `${fmtTime(group.match_time)}${group.match_note ? ` (${group.match_note.toUpperCase()})` : ''}`],
                  ].map(([k, v, strong]) => (
                    <div key={k} className="flex items-center justify-between gap-4 bg-ink-900 px-5 py-3 text-sm">
                      <span className="text-slate-400">{k}</span>
                      <span className={`text-right ${strong ? 'font-display font-extrabold uppercase tracking-wide text-white' : 'text-white'}`}>{v}</span>
                    </div>
                  ))}
                </div>
                {group.qualify > 0 && (
                  <div className="border-y border-ink-700 bg-ink-950 px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#ff5a67]">
                    Top {group.qualify} teams {isLatest ? 'will qualify' : 'qualified'} from this group
                  </div>
                )}
                {ended ? (
                  <Board entries={rank(rows)} teamById={teamById} />
                ) : (
                  <>
                    <div className="grid grid-cols-[70px_1fr] border-b border-ink-700 bg-ink-950 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Slot</span><span>Team name</span>
                    </div>
                    {rows.map((x, i) => {
                      const t = teamById[x.team_id]
                      return (
                        <div key={x.id} className={`grid grid-cols-[70px_1fr] items-center px-5 py-2.5 text-sm uppercase ${t?.is_ours ? 'bg-red-950/60 font-bold text-white' : i % 2 ? 'bg-ink-900 text-slate-200' : 'bg-ink-850 text-slate-200'}`}>
                          <span className="font-bold text-[#ff5a67]">{x.slot}</span>
                          <span className="flex items-center justify-between gap-2">
                            {t?.name}
                            {x.qualified && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-emerald-300">QUALIFIED</span>}
                          </span>
                        </div>
                      )
                    })}
                  </>
                )}
                {!rows.length && <div className="px-5 py-6 text-center text-sm text-slate-500">No teams in this group.</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** results table: rank, team, WWCD, placement pts, kill pts, total */
function Board({ entries, teamById }) {
  const cols = 'grid-cols-[44px_1fr_46px_56px_56px_60px]'
  return (
    <>
      <div className={`grid ${cols} items-center gap-1 border-y border-ink-700 bg-ink-950 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400`}>
        <span>#</span><span>Team</span><span className="text-center">WWCD</span><span className="text-center">Place</span><span className="text-center">Kills</span><span className="text-center">Total</span>
      </div>
      {entries.map((x, i) => {
        const t = teamById[x.team_id]
        return (
          <div key={x.id} className={`grid ${cols} items-center gap-1 px-4 py-2.5 text-sm uppercase ${t?.is_ours ? 'bg-red-950/60 font-bold text-white' : i % 2 ? 'bg-ink-900 text-slate-200' : 'bg-ink-850 text-slate-200'}`}>
            <span className={`font-bold ${x.qualified ? 'text-emerald-300' : 'text-[#ff5a67]'}`}>{i + 1}</span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{t?.name}</span>
              {x.qualified && <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-emerald-300">QUALIFIED</span>}
            </span>
            <span className="text-center text-slate-400">{x.wwcd || 0}</span>
            <span className="text-center text-slate-400">{x.place_pts || 0}</span>
            <span className="text-center text-slate-400">{x.kill_pts || 0}</span>
            <span className="text-center font-bold text-white">{totalOf(x)}</span>
          </div>
        )
      })}
      {!entries.length && <div className="px-5 py-6 text-center text-sm text-slate-500">No teams.</div>}
    </>
  )
}

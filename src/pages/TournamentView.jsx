import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Flag from '../components/Flag'
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
    const ids = (tm.data || []).map((x) => x.id)
    const pl = ids.length ? await supabase.from('tournament_team_players').select('*').in('team_id', ids).order('sort') : { data: [] }
    return { data: { t: t.data, rounds: r.data || [], groups: g.data || [], gts: gt.data || [], teams: tm.data || [], players: pl.data || [] } }
  }, [id])
  const [pick, setPick] = useState(null)

  if (loading || !data) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!data.t) return <div className="py-24 text-center text-slate-400">Tournament not found. <Link to="/" className="text-red-400">Back to home</Link></div>

  const { rounds, groups, gts, teams, players } = data
  const roadmap = Array.isArray(data.t.roadmap) ? data.t.roadmap : []
  const withInfo = teams.filter((t) => t.tag || t.logo_url || players.some((p) => p.team_id === t.id))
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

      {roadmap.length > 0 && (
        <div className="card">
          <div className="mb-3 font-display text-sm font-extrabold uppercase tracking-wider text-white">Tournament roadmap</div>
          <ol className="flex gap-0 overflow-x-auto pb-1">
            {roadmap.map((st, i) => (
              <li key={i} className="relative min-w-[150px] flex-1 pr-3">
                <div className="flex items-center">
                  <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">{i + 1}</span>
                  {i < roadmap.length - 1 && <span className="h-0.5 flex-1 bg-ink-600" />}
                </div>
                <div className="mt-2 text-sm font-bold uppercase text-white">{st.title}</div>
                {st.date && <div className="text-xs text-red-400">{st.date}</div>}
                {st.note && <div className="mt-0.5 text-xs text-slate-400">{st.note}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}

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
                            <span className="flex items-center gap-2"><Flag code={t?.country} h="14px" />{t?.name}</span>
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

      {withInfo.length > 0 && (
        <div className="space-y-3">
          <div className="font-display text-sm font-extrabold uppercase tracking-wider text-white">Teams &amp; players</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.filter((t) => withInfo.includes(t)).sort((a, b) => a.name.localeCompare(b.name)).map((t) => {
              const ps = players.filter((p) => p.team_id === t.id)
              return (
                <div key={t.id} className="card">
                  <div className="flex items-center gap-3">
                    {t.logo_url ? <img src={t.logo_url} alt="" className="h-12 w-12 object-contain" /> : <span className="h-12 w-12 rounded bg-ink-800" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate font-bold uppercase text-white"><Flag code={t.country} h="14px" />{t.name}</div>
                      {t.tag && <div className="text-xs font-semibold text-red-400">[{t.tag}]{t.invited ? ' · invited' : ''}</div>}
                    </div>
                  </div>
                  {ps.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {ps.map((p) => (
                        <div key={p.id} className="w-16 text-center">
                          {p.photo_url ? <img src={p.photo_url} alt="" className="mx-auto h-14 w-14 rounded-full object-cover" /> : <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink-800 text-sm font-bold text-slate-400">{p.name.slice(0, 1)}</span>}
                          <div className="mt-1 truncate text-[11px] text-slate-300">{p.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** results table: rank, team, WWCD, placement pts, kill pts, total */
function Board({ entries, teamById }) {
  const cols = 'grid-cols-[44px_1fr_36px_46px_46px_46px_52px]'
  return (
    <>
      <div className={`grid ${cols} items-center gap-1 border-y border-ink-700 bg-ink-950 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400`}>
        <span>#</span><span>Team</span><span className="text-center">MP</span><span className="text-center">WWCD</span><span className="text-center">PP</span><span className="text-center">KP</span><span className="text-center">TP</span>
      </div>
      {entries.map((x, i) => {
        const t = teamById[x.team_id]
        return (
          <div key={x.id} className={`grid ${cols} items-center gap-1 px-4 py-2.5 text-sm uppercase ${t?.is_ours ? 'bg-red-950/60 font-bold text-white' : i % 2 ? 'bg-ink-900 text-slate-200' : 'bg-ink-850 text-slate-200'}`}>
            <span className={`font-bold ${x.qualified ? 'text-emerald-300' : 'text-[#ff5a67]'}`}>{i + 1}</span>
            <span className="flex min-w-0 items-center gap-2">
              <Flag code={t?.country} h="14px" /><span className="truncate">{t?.name}</span>
              {x.qualified && <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-emerald-300">QUALIFIED</span>}
            </span>
            <span className="text-center text-slate-400">{x.mp || 0}</span>
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

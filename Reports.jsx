import { useMemo, useState } from 'react'
import { Download, Printer, FileText, Table2, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { useSettings } from '../context/SettingsContext'
import { useLineup } from '../context/LineupContext'
import { addDays, download, num, todayStr, toCsv } from '../lib/format'
import { Card, PageHeader, Spinner } from '../components/ui'

const RED = 'text-[#ff3b4a]'
const ratio = (a, b) => (b ? (a / b).toFixed(2) : '—')
const pad2 = (n) => String(n).padStart(2, '0')
const sum = (a, k) => (a || []).reduce((t, x) => t + Number(x[k] || 0), 0)

export default function Reports() {
  const { settings } = useSettings()
  const [view, setView] = useState('team') // 'team' = one-page team report, 'detail' = full tables
  const [from, setFrom] = useState(addDays(todayStr(), -29))
  const [to, setTo] = useState(todayStr())
  const { activeLineups } = useLineup()
  const [lineupId, setLineupId] = useState('all') // 'all' = whole organization
  const single = activeLineups.length <= 1
  const lineupLabel = lineupId === 'all' ? (single ? 'Season Overview' : 'All lineups') : activeLineups.find((l) => l.id === lineupId)?.name || ''
  // tick the parts you want in the printed report
  const [show, setShow] = useState({
    snapshot: true, top: true, matches: true,
    summary: true, expenses: true, income: true,
    fsummary: true, fcat: true, fincome: true, fexpenses: true,
  })
  const toggle = (k) => setShow((x) => ({ ...x, [k]: !x[k] }))
  const PARTS = {
    team: [['snapshot', 'Performance snapshot'], ['top', 'Top players'], ['matches', 'Match results']],
    detail: [['summary', 'Summary'], ['matches', 'Matches'], ['expenses', 'Expenses'], ['income', 'Income']],
    finance: [['fsummary', 'Totals'], ['fcat', 'Category breakdown'], ['fincome', 'Income list'], ['fexpenses', 'Expense list']],
  }

  const { data, loading } = useData(async () => {
    const [matches, expenses, income, training, stats, roster] = await Promise.all([
      supabase.from('matches').select('*').gte('played_on', from).lte('played_on', to).order('played_on'),
      supabase.from('expenses').select('*').gte('spent_on', from).lte('spent_on', to).order('spent_on'),
      supabase.from('income').select('*').gte('received_on', from).lte('received_on', to).order('received_on'),
      supabase.from('training_sessions').select('*').gte('held_on', from).lte('held_on', to).order('held_on'),
      supabase.from('match_player_stats').select('match_id, player_id, kills, points, damage, assists, rating, survival_minutes'),
      supabase.from('profiles').select('id, ign, full_name'),
    ])
    // one lineup only? keep rows that belong to it (with a single lineup, rows without a lineup count as its own)
    const mine = (r) => lineupId === 'all' || r.lineup_id === lineupId || (single && !r.lineup_id)
    const ms = (matches.data || []).filter(mine)
    const ids = new Set(ms.map((x) => x.id))
    return {
      data: {
        matches: ms, expenses: (expenses.data || []).filter(mine), income: (income.data || []).filter(mine),
        training: (training.data || []).filter(mine),
        stats: (stats.data || []).filter((x) => ids.has(x.match_id)), roster: roster.data || [],
      },
    }
  }, [from, to, lineupId, single])

  // ---- numbers for the team report ------------------------------------------------
  const t = useMemo(() => {
    if (!data) return null
    const ids = new Set(data.matches.map((m) => m.id))
    const byPlayer = {}
    data.stats.filter((x) => ids.has(x.match_id)).forEach((x) => {
      const p = (byPlayer[x.player_id] ||= { kills: 0, games: 0, damage: 0, assists: 0, rating: 0, rated: 0, survival: 0 })
      p.kills += Number(x.kills) || 0
      p.damage += Number(x.damage) || 0
      p.assists += Number(x.assists) || 0
      p.survival += Number(x.survival_minutes) || 0
      if (x.rating != null) { p.rating += Number(x.rating); p.rated += 1 }
      p.games += 1
    })
    const per = (a, g) => (g ? a / g : 0)
    const all = Object.entries(byPlayer)
      .map(([id, v]) => {
        const r = data.roster.find((x) => x.id === id)
        return {
          id, ign: r?.ign || r?.full_name || 'Player', games: v.games, kills: v.kills,
          avg: per(v.kills, v.games), avgDamage: per(v.damage, v.games), avgAssists: per(v.assists, v.games),
          avgRating: per(v.rating, v.rated), avgSurvival: per(v.survival, v.games),
        }
      })
    // Ranking score (0-100): Kills 30% · Damage 25% · Survival 15% · Assists 15% · Rating 15%
    // Each per-match average is compared with the best player's average (rating is already out of 100).
    const mx = (k) => Math.max(...all.map((p) => p[k]), 0)
    const m = { avg: mx('avg'), avgDamage: mx('avgDamage'), avgSurvival: mx('avgSurvival'), avgAssists: mx('avgAssists') }
    const rel = (v, k) => (m[k] ? v / m[k] : 0)
    all.forEach((p) => {
      p.score = 100 * (0.30 * rel(p.avg, 'avg') + 0.25 * rel(p.avgDamage, 'avgDamage') + 0.15 * rel(p.avgSurvival, 'avgSurvival')
        + 0.15 * rel(p.avgAssists, 'avgAssists') + 0.15 * Math.min(p.avgRating / 100, 1))
    })
    const top = all.sort((a, b) => b.score - a.score || b.kills - a.kills).slice(0, 5)

    const n = data.matches.length
    const kills = sum(data.matches, 'kills')
    const points = sum(data.matches, 'points')
    const present = sum(data.training, 'attendees')
    const expected = sum(data.training, 'total_players')
    return {
      n, kills, points, top,
      sessions: data.training.length,
      killRatio: ratio(kills, n),
      pointRatio: ratio(points, n),
      attendance: expected ? `${Math.round((present / expected) * 100)}%` : '—',
      matchRows: [...data.matches].reverse(),
      best: [...data.matches].sort((a, b) => b.points - a.points || b.kills - a.kills || (a.placement || 99) - (b.placement || 99)).slice(0, 5),
    }
  }, [data])

  const fin = useMemo(() => {
    if (!data) return null
    const group = (rows, key) => {
      const g = {}
      rows.forEach((x) => { const k = x[key] || 'Other'; g[k] = (g[k] || 0) + Number(x.amount || 0) })
      return Object.entries(g).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
    }
    const inc = sum(data.income, 'amount')
    const exp = sum(data.expenses, 'amount')
    return { inc, exp, net: inc - exp, incBy: group(data.income, 'type'), expBy: group(data.expenses, 'category') }
  }, [data])

  const exportAll = () => {
    download(`matches_${from}_${to}.csv`, toCsv(data.matches))
    download(`expenses_${from}_${to}.csv`, toCsv(data.expenses))
    download(`income_${from}_${to}.csv`, toCsv(data.income))
    download(`training_${from}_${to}.csv`, toCsv(data.training))
    download(`top_players_${from}_${to}.csv`, toCsv(t.top.map((p, i) => ({ rank: i + 1, ign: p.ign, score: p.score.toFixed(1), matches: p.games, total_kills: p.kills, avg_kills: p.avg.toFixed(2), avg_damage: p.avgDamage.toFixed(0), avg_assists: p.avgAssists.toFixed(2), avg_rating: p.avgRating.toFixed(2), avg_survival_min: p.avgSurvival.toFixed(1) }))))
    download(`best_matches_${from}_${to}.csv`, toCsv(t.best))
  }

  const [first, ...rest] = (settings.team_name || 'Team').toUpperCase().split(' ')

  return (
    <div>
      <div className="no-print"><PageHeader
        title="Reports"
        subtitle="Pick a date range, choose a report style, then print or export."
        actions={
          <div className="no-print flex gap-2">
            <button className="btn-ghost" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button>
            <button className="btn-primary" disabled={!data} onClick={exportAll}><Download size={16} /> Export CSV</button>
          </div>
        }
      /></div>

      <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label><span className="label">From</span><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span className="label">To</span><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          {activeLineups.length > 0 && (
            <label><span className="label">Report for</span>
              <select className="input" value={lineupId} onChange={(e) => setLineupId(e.target.value)}>
                <option value="all">{single ? 'Whole team' : 'Whole organization (all lineups)'}</option>
                {activeLineups.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('team')} className={`btn btn-sm ${view === 'team' ? 'bg-accent text-white' : 'border border-ink-600 text-slate-300'}`}><FileText size={14} /> Team report</button>
          <button onClick={() => setView('detail')} className={`btn btn-sm ${view === 'detail' ? 'bg-accent text-white' : 'border border-ink-600 text-slate-300'}`}><Table2 size={14} /> Detailed report</button>
          <button onClick={() => setView('finance')} className={`btn btn-sm ${view === 'finance' ? 'bg-accent text-white' : 'border border-ink-600 text-slate-300'}`}><Wallet size={14} /> Financial report</button>
        </div>
      </div>

      <div className="no-print mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-3 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Include in print:</span>
        {PARTS[view].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-slate-200">
            <input type="checkbox" checked={!!show[k]} onChange={() => toggle(k)} className="h-4 w-4 accent-[rgb(var(--accent))]" /> {label}
          </label>
        ))}
      </div>

      {loading || !data || !t ? <Spinner /> : view === 'team' ? (
        /* ===================== ONE-PAGE TEAM PERFORMANCE REPORT ===================== */
        <div className="report-sheet team-sheet overflow-hidden rounded-xl border border-ink-600 bg-ink-950">
          <div className="h-2 bg-accent" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl font-bold tracking-wide text-white sm:text-5xl">
                  {first} {rest.length > 0 && <span className={RED}>{rest.join(' ')}</span>}
                </h2>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">Team Performance Report • {lineupLabel}</p>
              </div>
              <div className="min-w-[220px] rounded-lg border border-ink-600 bg-ink-900 p-4 text-xs">
                <div className="mb-3 font-semibold uppercase tracking-[0.18em] text-slate-400">Reporting period</div>
                <div className="mb-2 flex gap-2 text-slate-300"><span className="w-10 text-slate-500">From:</span><span className="flex-1 border-b border-ink-600 text-white">{from}</span></div>
                <div className="flex gap-2 text-slate-300"><span className="w-10 text-slate-500">To:</span><span className="flex-1 border-b border-ink-600 text-white">{to}</span></div>
              </div>
            </div>

            {show.snapshot && <div>
            <h3 className="mb-3 mt-8 text-xs font-bold uppercase tracking-[0.18em] text-white">Performance snapshot</h3>
            <div className="grid grid-cols-2 divide-x divide-y divide-ink-600 overflow-hidden rounded-lg border border-ink-600 bg-ink-900 sm:grid-cols-4 lg:grid-cols-7 lg:divide-y-0">
              {[
                ['Matches played', num(t.n)],
                ['Total kills', num(t.kills)],
                ['Total points', num(t.points)],
                ['Training sessions', num(t.sessions)],
                ['Avg. kill ratio', t.killRatio],
                ['Avg. point ratio', t.pointRatio],
                ['Training attendance', t.attendance],
              ].map(([label, value]) => (
                <div key={label} className="p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
                  <div className="mt-2 font-display text-3xl font-bold text-white">{value}</div>
                </div>
              ))}
            </div>

            </div>}
            {show.top && <div>
            <h3 className="mb-3 mt-8 text-xs font-bold uppercase tracking-[0.18em] text-white">Top player performance</h3>
            <div className="overflow-x-auto rounded-lg border border-ink-600 bg-ink-900 text-sm">
              <div className={`grid min-w-[840px] grid-cols-[48px_1fr_80px_90px_90px_100px_90px_90px_110px_80px] border-b-2 border-[#ff3b4a] bg-ink-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${RED}`}>
                <span>Rank</span><span>In-game name (IGN)</span><span>Matches</span><span>Total kills</span><span>Avg kills</span><span>Avg damage</span><span>Avg assists</span><span>Avg rating</span><span>Avg survival</span><span>Score</span>
              </div>
              {t.top.map((p, i) => (
                <div key={p.id} className="grid min-w-[840px] grid-cols-[48px_1fr_80px_90px_90px_100px_90px_90px_110px_80px] border-b border-ink-700 px-3 py-2.5 text-slate-200 last:border-0">
                  <span className="text-slate-400">{pad2(i + 1)}</span>
                  <span className="font-semibold text-white">{p.ign}</span>
                  <span>{p.games}</span>
                  <span className="font-semibold text-white">{num(p.kills)}</span>
                  <span>{p.avg.toFixed(2)}</span>
                  <span>{num(Math.round(p.avgDamage))}</span>
                  <span>{p.avgAssists.toFixed(2)}</span>
                  <span>{p.avgRating ? p.avgRating.toFixed(2) : '—'}</span>
                  <span>{p.avgSurvival ? `${p.avgSurvival.toFixed(1)} min` : '—'}</span>
                  <span className="font-semibold text-[#ff3b4a]">{p.score.toFixed(1)}</span>
                </div>
              ))}
              {!t.top.length && <div className="px-3 py-4 text-center text-slate-500">No player stats recorded in this period.</div>}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Ranked by score: Kills 30% · Damage 25% · Survival 15% · Assists 15% · Rating 15% (per-match averages, compared with the best player).</p>

            </div>}
            {show.matches && <div>
            <h3 className="mb-3 mt-8 text-xs font-bold uppercase tracking-[0.18em] text-white">Top 5 best matches</h3>
            <div className="overflow-x-auto rounded-lg border border-ink-600 bg-ink-900 text-sm">
              <div className={`grid min-w-[620px] grid-cols-[56px_110px_1fr_110px_100px_80px_80px] border-b-2 border-[#ff3b4a] bg-ink-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${RED}`}>
                <span>Rank</span><span>Date</span><span>Tournament</span><span>Map</span><span>Placement</span><span>Kills</span><span>Points</span>
              </div>
              {t.best.map((m, i) => (
                <div key={m.id} className="grid min-w-[620px] grid-cols-[56px_110px_1fr_110px_100px_80px_80px] border-b border-ink-700 px-3 py-2.5 text-slate-200 last:border-0">
                  <span className="text-slate-400">{pad2(i + 1)}</span>
                  <span className="text-slate-400">{m.played_on}</span>
                  <span className="truncate font-medium text-white">{m.tournament}</span>
                  <span>{m.map || '—'}</span>
                  <span>{m.placement ? `#${m.placement}` : '—'}</span>
                  <span>{m.kills}</span>
                  <span className="font-semibold text-white">{m.points}</span>
                </div>
              ))}
              {!t.matchRows.length && <div className="px-3 py-4 text-center text-slate-500">No matches recorded in this period.</div>}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Best matches are ranked by points (placement points + kills), out of {t.matchRows.length} played in this period.</p>
            </div>}
            <p className="mt-3 text-[10px] text-slate-500">
              Player averages count only the matches each player was ticked as playing. Attendance = players present ÷ players expected across training sessions. Generated {todayStr()} from recorded data.
            </p>
          </div>
          <div className="mx-6 flex flex-wrap justify-between gap-2 border-t border-ink-600 py-3 text-[10px] uppercase tracking-[0.15em] text-slate-500 sm:mx-8">
            <span>{(settings.team_name || '').toUpperCase()} / Team performance</span>
            <span>Internal team report</span>
          </div>
        </div>
      ) : view === 'finance' ? (
        /* ===================== FINANCIAL REPORT (income & expenses only) ===================== */
        <div className="report-sheet overflow-hidden rounded-xl border border-ink-600 bg-ink-950">
          <div className="h-2 bg-accent" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl font-bold tracking-wide text-white sm:text-5xl">
                  {first} {rest.length > 0 && <span className={RED}>{rest.join(' ')}</span>}
                </h2>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">Financial Report • {lineupId === 'all' ? 'Income & Expenses' : `${lineupLabel} — Income & Expenses`}</p>
              </div>
              <div className="min-w-[220px] rounded-lg border border-ink-600 bg-ink-900 p-4 text-xs">
                <div className="mb-3 font-semibold uppercase tracking-[0.18em] text-slate-400">Reporting period</div>
                <div className="mb-2 flex gap-2 text-slate-300"><span className="w-10 text-slate-500">From:</span><span className="flex-1 border-b border-ink-600 text-white">{from}</span></div>
                <div className="flex gap-2 text-slate-300"><span className="w-10 text-slate-500">To:</span><span className="flex-1 border-b border-ink-600 text-white">{to}</span></div>
              </div>
            </div>

            {show.fsummary && (
              <div>
                <h3 className="mb-3 mt-8 text-xs font-bold uppercase tracking-[0.18em] text-white">Financial summary ({settings.currency})</h3>
                <div className="grid grid-cols-2 divide-x divide-ink-600 overflow-hidden rounded-lg border border-ink-600 bg-ink-900 sm:grid-cols-4">
                  {[
                    ['Total income', num(fin.inc), 'text-white'],
                    ['Total expenses', num(fin.exp), 'text-white'],
                    ['Net balance', num(fin.net), fin.net < 0 ? 'text-red-400' : 'text-emerald-400'],
                    ['Transactions', num(data.income.length + data.expenses.length), 'text-white'],
                  ].map(([label, value, cls]) => (
                    <div key={label} className="p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
                      <div className={`mt-2 font-display text-3xl font-bold ${cls}`}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {show.fcat && (
              <div className="grid gap-6 sm:grid-cols-2">
                {[['Income by type', fin.incBy, fin.inc], ['Expenses by category', fin.expBy, fin.exp]].map(([title, rows, total]) => (
                  <div key={title}>
                    <h3 className="mb-3 mt-8 text-xs font-bold uppercase tracking-[0.18em] text-white">{title}</h3>
                    <div className="overflow-hidden rounded-lg border border-ink-600 bg-ink-900 text-sm">
                      <div className={`grid grid-cols-[1fr_110px_60px] border-b-2 border-[#ff3b4a] bg-ink-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${RED}`}>
                        <span>Category</span><span className="text-right">Amount</span><span className="text-right">%</span>
                      </div>
                      {rows.map((x) => (
                        <div key={x.name} className="grid grid-cols-[1fr_110px_60px] border-b border-ink-700 px-3 py-2 text-slate-200">
                          <span>{x.name}</span><span className="text-right">{num(x.total)}</span>
                          <span className="text-right text-slate-400">{total ? Math.round((x.total / total) * 100) : 0}%</span>
                        </div>
                      ))}
                      {!rows.length && <div className="px-3 py-4 text-center text-slate-500">None in this period.</div>}
                      <div className="grid grid-cols-[1fr_110px_60px] bg-ink-800 px-3 py-2 font-semibold text-white">
                        <span>Total</span><span className="text-right">{num(total)}</span><span />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {[['fincome', 'Income', data.income, 'received_on', 'type'], ['fexpenses', 'Expenses', data.expenses, 'spent_on', 'category']].map(([k, title, rows, dateKey, catKey]) => show[k] && (
              <div key={k}>
                <h3 className="mb-3 mt-8 text-xs font-bold uppercase tracking-[0.18em] text-white">{title} list</h3>
                <div className="overflow-x-auto rounded-lg border border-ink-600 bg-ink-900 text-sm">
                  <div className={`grid min-w-[520px] grid-cols-[110px_140px_1fr_110px] border-b-2 border-[#ff3b4a] bg-ink-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${RED}`}>
                    <span>Date</span><span>{catKey === 'type' ? 'Type' : 'Category'}</span><span>Description</span><span className="text-right">Amount</span>
                  </div>
                  {rows.map((x) => (
                    <div key={x.id} className="grid min-w-[520px] grid-cols-[110px_140px_1fr_110px] border-b border-ink-700 px-3 py-2 text-slate-200 last:border-0">
                      <span className="text-slate-400">{x[dateKey]}</span><span>{x[catKey] || '—'}</span>
                      <span className="truncate">{x.description || '—'}</span><span className="text-right font-semibold text-white">{num(x.amount)}</span>
                    </div>
                  ))}
                  {!rows.length && <div className="px-3 py-4 text-center text-slate-500">None in this period.</div>}
                </div>
              </div>
            ))}
            <p className="mt-4 text-[10px] text-slate-500">Amounts in {settings.currency}. Generated {todayStr()} from recorded data.</p>
          </div>
          <div className="mx-6 flex flex-wrap justify-between gap-2 border-t border-ink-600 py-3 text-[10px] uppercase tracking-[0.15em] text-slate-500 sm:mx-8">
            <span>{(settings.team_name || '').toUpperCase()} / Finance</span>
            <span>Internal financial report</span>
          </div>
        </div>
      ) : (
        /* ===================== DETAILED REPORT (previous version) ===================== */
        <div className="space-y-4">
          {show.summary && <Card>
            <h2 className="font-display text-2xl font-bold text-white">{settings.team_name} — Report</h2>
            <p className="mb-4 text-sm text-slate-400">{from} to {to}</p>
            <table className="tbl max-w-xl">
              <tbody>
                <tr><td>Matches played</td><td className="text-right font-semibold text-white">{data.matches.length}</td></tr>
                <tr><td>Total kills</td><td className="text-right font-semibold text-white">{num(sum(data.matches, 'kills'))}</td></tr>
                <tr><td>Total points</td><td className="text-right font-semibold text-white">{num(sum(data.matches, 'points'))}</td></tr>
                <tr><td>Training sessions</td><td className="text-right font-semibold text-white">{data.training.length}</td></tr>
                <tr><td>Income ({settings.currency})</td><td className="text-right font-semibold text-white">{num(sum(data.income, 'amount'))}</td></tr>
                <tr><td>Expenses ({settings.currency})</td><td className="text-right font-semibold text-white">{num(sum(data.expenses, 'amount'))}</td></tr>
                <tr><td>Net balance ({settings.currency})</td><td className="text-right font-semibold text-emerald-400">{num(sum(data.income, 'amount') - sum(data.expenses, 'amount'))}</td></tr>
              </tbody>
            </table>
          </Card>}

          {show.matches && <Card title="Matches" className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Tournament</th><th>Map</th><th>Place</th><th>Kills</th><th>Points</th></tr></thead>
              <tbody>
                {data.matches.map((m) => <tr key={m.id}><td>{m.played_on}</td><td>{m.tournament}</td><td>{m.map}</td><td>{m.placement}</td><td>{m.kills}</td><td>{m.points}</td></tr>)}
                {!data.matches.length && <tr><td colSpan={6} className="text-slate-500">None</td></tr>}
              </tbody>
            </table>
          </Card>}

          <div className="grid gap-4 lg:grid-cols-2">
            {show.expenses && <Card title="Expenses" className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {data.expenses.map((x) => <tr key={x.id}><td>{x.spent_on}</td><td>{x.category}</td><td>{x.description}</td><td className="text-right">{num(x.amount)}</td></tr>)}
                  {!data.expenses.length && <tr><td colSpan={4} className="text-slate-500">None</td></tr>}
                </tbody>
              </table>
            </Card>}
            {show.income && <Card title="Income" className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Type</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {data.income.map((x) => <tr key={x.id}><td>{x.received_on}</td><td>{x.type}</td><td>{x.description}</td><td className="text-right">{num(x.amount)}</td></tr>)}
                  {!data.income.length && <tr><td colSpan={4} className="text-slate-500">None</td></tr>}
                </tbody>
              </table>
            </Card>}
          </div>
        </div>
      )}
    </div>
  )
}

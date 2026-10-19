import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Swords, Crosshair, Trophy, Wallet, PiggyBank, TrendingUp, TrendingDown, PieChart as PieIcon, CalendarCheck, Users, Dumbbell, Receipt, Banknote, Activity, CheckCircle2, Quote, LineChart,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, AreaChart, Area } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { addDays, daysBetween, num, pctChange, timeAgo, todayStr } from '../lib/format'
import { Card, Avatar, Spinner, StatusBadge } from '../components/ui'
import { Donut, Legend, Ring } from '../components/charts'
import { Icon } from '../lib/icons'
import UpcomingMatches from '../components/UpcomingMatches'

const PRESETS = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
]

function rangeFor(key) {
  const end = todayStr()
  if (key === 'all') return { start: '0000-01-01', end }
  if (key === 'month') return { start: end.slice(0, 8) + '01', end }
  return { start: addDays(end, -(Number(key) - 1)), end }
}

/* ------------------------------------------------------------------ */
function useDashboardData(role, financeAllowed) {
  const [d, setD] = useState(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const member = role !== 'guest'
      const [matches, stats, roster, training, expenses, income, updates] = await Promise.all([
        supabase.from('matches').select('*').order('played_on', { ascending: false }),
        supabase.from('match_player_stats').select('match_id, player_id, kills, points'),
        member
          ? supabase.from('profiles').select('id, full_name, ign, player_role, status, avatar_url, monthly_salary').eq('role', 'player').order('created_at')
          : supabase.from('public_roster').select('*'),
        supabase.from('training_sessions')
          .select(member ? '*' : 'id, held_on, name, attendees, total_players')
          .order('held_on', { ascending: false }),
        financeAllowed ? supabase.from('expenses').select('*').order('spent_on', { ascending: false }) : Promise.resolve({ data: [] }),
        financeAllowed ? supabase.from('income').select('*').order('received_on', { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.from('updates').select('*').order('created_at', { ascending: false }).limit(5),
      ])
      if (!alive) return
      setD({
        matches: matches.data || [], stats: stats.data || [], roster: roster.data || [],
        training: training.data || [], expenses: expenses.data || [], income: income.data || [], updates: updates.data || [],
      })
    })()
    return () => { alive = false }
  }, [role, financeAllowed])
  return d
}

/* ------------------------------------------------------------------ */
function StatCard({ icon: IconC, label, value, change, color }) {
  return (
    <div className="card flex items-center gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: color + '2a', color }}>
        <IconC size={24} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="font-display text-3xl font-bold leading-tight text-white">{value}</div>
        {change != null && (
          <div className={`flex items-center gap-1 text-[11px] ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(change)}% <span className="text-slate-500">vs previous period</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
export default function Dashboard() {
  const { role, isMember } = useAuth()
  const { settings } = useSettings()
  const financeAllowed = isMember || settings.guest_show_finance
  const data = useDashboardData(role, financeAllowed)
  const [preset, setPreset] = useState('30')
  const [actions, setActions] = useState([])

  useEffect(() => {
    if (!isMember) { setActions([]); return }
    supabase.from('quick_actions').select('*').eq('enabled', true).order('sort')
      .then(({ data }) => setActions((data || []).filter((a) => a.roles.includes(role))))
  }, [isMember, role])

  const { start, end } = rangeFor(preset)
  const len = preset === 'all' ? null : daysBetween(start, end) + 1
  const prevEnd = len ? addDays(start, -1) : null
  const prevStart = len ? addDays(prevEnd, -(len - 1)) : null

  const m = useMemo(() => {
    if (!data) return null
    const inR = (s, a = start, b = end) => s >= a && s <= b
    const matches = data.matches.filter((x) => inR(x.played_on))
    const prevMatches = len ? data.matches.filter((x) => inR(x.played_on, prevStart, prevEnd)) : []
    const sum = (arr, k) => arr.reduce((t, x) => t + Number(x[k] || 0), 0)

    const expenses = data.expenses.filter((x) => inR(x.spent_on))
    const income = data.income.filter((x) => inR(x.received_on))
    const prevExp = len ? data.expenses.filter((x) => inR(x.spent_on, prevStart, prevEnd)) : []
    const prevInc = len ? data.income.filter((x) => inR(x.received_on, prevStart, prevEnd)) : []

    const byCat = {}
    expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount) })
    const breakdown = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

    // last 5 weeks of points, ending at range end
    const weeks = [0, 1, 2, 3, 4].map((i) => {
      const wEnd = addDays(end, -7 * (4 - i))
      const wStart = addDays(wEnd, -6)
      return { name: `Week ${i + 1}`, points: sum(data.matches.filter((x) => inR(x.played_on, wStart, wEnd)), 'points') }
    })

    // top players
    const inRangeIds = new Set(matches.map((x) => x.id))
    const agg = {}
    data.stats.filter((s) => inRangeIds.has(s.match_id)).forEach((s) => {
      agg[s.player_id] ||= { kills: 0, points: 0 }
      agg[s.player_id].kills += s.kills
      agg[s.player_id].points += s.points
    })
    const top = Object.entries(agg)
      .map(([id, v]) => ({ ...v, p: data.roster.find((r) => r.id === id) }))
      .filter((x) => x.p)
      .sort((a, b) => b.points - a.points).slice(0, 5)

    // training
    const sessions = data.training.filter((x) => inR(x.held_on))
    const present = sum(sessions, 'attendees')
    const expected = sum(sessions, 'total_players')
    const rate = expected ? Math.round((present / expected) * 100) : 0
    const avgPresent = sessions.length ? Math.round(present / sessions.length) : 0
    const avgExpected = sessions.length ? Math.round(expected / sessions.length) : 0

    // cumulative net balance trend
    const events = [
      ...income.map((x) => ({ d: x.received_on, v: Number(x.amount) })),
      ...expenses.map((x) => ({ d: x.spent_on, v: -Number(x.amount) })),
    ].sort((a, b) => a.d.localeCompare(b.d))
    let run = 0
    const trend = events.map((e) => ({ d: e.d.slice(5), net: (run += e.v) }))

    return {
      matches, sessions, expenses, income, breakdown, weeks, top, rate, avgPresent, avgExpected, trend,
      kills: sum(matches, 'kills'), points: sum(matches, 'points'),
      totalIncome: sum(income, 'amount'), totalExpense: sum(expenses, 'amount'),
      change: len ? {
        matches: pctChange(matches.length, prevMatches.length),
        kills: pctChange(sum(matches, 'kills'), sum(prevMatches, 'kills')),
        points: pctChange(sum(matches, 'points'), sum(prevMatches, 'points')),
        income: pctChange(sum(income, 'amount'), sum(prevInc, 'amount')),
        net: pctChange(sum(income, 'amount') - sum(expenses, 'amount'), sum(prevInc, 'amount') - sum(prevExp, 'amount')),
      } : {},
    }
  }, [data, start, end, len, prevStart, prevEnd])

  if (role === 'guest' && !settings.guest_enabled) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <h1 className="mb-2 font-display text-3xl font-bold text-white">Members only</h1>
        <p className="mb-4 text-slate-400">Guest access is switched off. Please log in with the account your admin created.</p>
        <Link to="/login" className="btn-primary">Go to login</Link>
      </div>
    )
  }
  if (!m) return <div className="flex justify-center py-24"><Spinner /></div>

  const cur = settings.currency
  const net = m.totalIncome - m.totalExpense
  const rosterTotalSalary = data.roster.reduce((t, r) => t + Number(r.monthly_salary || 0), 0)

  return (
    <div>
      {/* title + date range */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">{settings.dashboard_subtitle}</p>
        </div>
        <select className="input !w-auto" value={preset} onChange={(e) => setPreset(e.target.value)}>
          {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          {/* stat cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
            <StatCard icon={Swords} color="#6d8bff" label="Total Matches" value={num(m.matches.length)} change={m.change.matches} />
            <StatCard icon={Crosshair} color="#38bdf8" label="Total Kills" value={num(m.kills)} change={m.change.kills} />
            <StatCard icon={Trophy} color="#f5a524" label="Total Points" value={num(m.points)} change={m.change.points} />
            {financeAllowed && <StatCard icon={Wallet} color="#8b7bff" label={`Total Income (${cur})`} value={num(m.totalIncome)} change={m.change.income} />}
            {financeAllowed && <StatCard icon={PiggyBank} color="#f472b6" label={`Net Balance (${cur})`} value={num(net)} change={m.change.net} />}
          </div>

          {/* charts row */}
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1.2fr_1fr]">
            <Card title="Team Performance (Total Points)" icon={Trophy}>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.weeks} margin={{ top: 18, right: 4, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7c5cff" /><stop offset="100%" stopColor="#4326d9" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1b2558" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,.04)' }} contentStyle={{ background: '#0a1030', border: '1px solid #27336f', borderRadius: 8 }} />
                    <Bar dataKey="points" fill="url(#bar)" radius={[3, 3, 0, 0]} maxBarSize={34}>
                      <LabelList dataKey="points" position="top" fill="#cbd5e1" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {financeAllowed ? (
              <Card title="Expense Breakdown" icon={PieIcon}>
                <div className="flex items-center gap-3">
                  <Donut items={m.breakdown} center={num(m.totalExpense)} sub={cur} size={150} />
                  <Legend items={m.breakdown} total={m.totalExpense} />
                </div>
              </Card>
            ) : (
              <Card title="Recent Matches" icon={Swords} link={isMember ? '/matches' : undefined}>
                <RecentMatches matches={m.matches} />
              </Card>
            )}

            <Card title="Training Attendance Rate" icon={CalendarCheck}>
              <div className="flex items-center gap-4">
                <Ring value={m.rate} />
                <div className="text-sm font-semibold text-white">Attendance Rate</div>
              </div>
              <div className="mt-4 grid grid-cols-3 divide-x divide-ink-700 text-center">
                <div><div className="font-display text-xl font-bold text-white">{m.sessions.length}</div><div className="text-[11px] text-slate-400">Sessions</div></div>
                <div><div className="font-display text-xl font-bold text-white">{m.avgPresent}</div><div className="text-[11px] text-slate-400">Avg present</div></div>
                <div><div className="font-display text-xl font-bold text-white">{Math.max(0, m.avgExpected - m.avgPresent)}</div><div className="text-[11px] text-slate-400">Avg absent</div></div>
              </div>
            </Card>
          </div>

          {/* tables row 1 */}
          <div className={`grid gap-4 ${financeAllowed ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
            <Card title="Top Players by Total Points" icon={Trophy} link={isMember ? '/players' : undefined} className="min-w-0 overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>#</th><th>Player Name</th><th>IGN</th><th>Kills</th><th>Total Points</th></tr></thead>
                <tbody>
                  {m.top.map((t, i) => (
                    <tr key={t.p.id}>
                      <td>{i + 1}</td>
                      <td><span className="flex items-center gap-2"><Avatar name={t.p.full_name} url={t.p.avatar_url} size={24} />{t.p.full_name}</span></td>
                      <td>{t.p.ign}</td><td>{t.kills}</td><td className="font-semibold text-white">{t.points}</td>
                    </tr>
                  ))}
                  {!m.top.length && <tr><td colSpan={5} className="text-center text-slate-500">No player stats in this period</td></tr>}
                </tbody>
              </table>
            </Card>

            {financeAllowed && (
              <Card title="Recent Expenses" icon={Receipt} link={isMember ? '/finance' : undefined} className="min-w-0 overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="text-right">Amount ({cur})</th></tr></thead>
                  <tbody>
                    {m.expenses.slice(0, 5).map((e) => (
                      <tr key={e.id}><td>{e.spent_on}</td><td>{e.category}</td><td>{e.description}</td><td className="text-right">{num(e.amount)}</td></tr>
                    ))}
                    {!m.expenses.length && <tr><td colSpan={4} className="text-center text-slate-500">No expenses</td></tr>}
                  </tbody>
                </table>
              </Card>
            )}

            {financeAllowed && (
              <Card title="Recent Income" icon={Banknote} link={isMember ? '/finance' : undefined} className="min-w-0 overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Date</th><th>Type</th><th>Description</th><th className="text-right">Amount ({cur})</th></tr></thead>
                  <tbody>
                    {m.income.slice(0, 5).map((e) => (
                      <tr key={e.id}><td>{e.received_on}</td><td>{e.type}</td><td>{e.description}</td><td className="text-right">{num(e.amount)}</td></tr>
                    ))}
                    {!m.income.length && <tr><td colSpan={4} className="text-center text-slate-500">No income</td></tr>}
                  </tbody>
                </table>
              </Card>
            )}
          </div>

          {/* tables row 2 */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Player Roster" icon={Users} link={isMember ? '/players' : undefined} className="min-w-0 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr><th>#</th><th>Player</th><th>IGN</th><th>Role</th><th>Status</th>{isMember && <th className="text-right">Salary ({cur})</th>}</tr>
                </thead>
                <tbody>
                  {data.roster.slice(0, 5).map((p, i) => (
                    <tr key={p.id}>
                      <td>{i + 1}</td>
                      <td><span className="flex items-center gap-2"><Avatar name={p.full_name} url={p.avatar_url} size={24} />{p.full_name}</span></td>
                      <td>{p.ign}</td><td>{p.player_role}</td><td><StatusBadge status={p.status} /></td>
                      {isMember && <td className="text-right">{num(p.monthly_salary)}</td>}
                    </tr>
                  ))}
                  {!data.roster.length && <tr><td colSpan={6} className="text-center text-slate-500">No players yet</td></tr>}
                </tbody>
              </table>
            </Card>

            <Card title="Training Summary" icon={Dumbbell} link={isMember ? '/training' : undefined} className="min-w-0 overflow-x-auto">
              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-ink-700 py-2"><div className="text-[10px] text-slate-400">Sessions</div><div className="font-display text-xl font-bold text-white">{m.sessions.length}</div></div>
                <div className="rounded-lg border border-ink-700 py-2"><div className="text-[10px] text-slate-400">Avg attendance</div><div className="font-display text-xl font-bold text-white">{m.avgPresent}</div></div>
                <div className="rounded-lg border border-ink-700 py-2"><div className="text-[10px] text-slate-400">Rate</div><div className="font-display text-xl font-bold text-emerald-400">{m.rate}%</div></div>
              </div>
              <table className="tbl">
                <thead><tr><th>Date</th><th>Session</th><th>Attendees</th>{isMember && <th className="text-right">Cost ({cur})</th>}</tr></thead>
                <tbody>
                  {m.sessions.slice(0, 5).map((s) => (
                    <tr key={s.id}><td>{s.held_on}</td><td>{s.name}</td><td>{s.attendees}</td>{isMember && <td className="text-right">{num(s.cost)}</td>}</tr>
                  ))}
                  {!m.sessions.length && <tr><td colSpan={4} className="text-center text-slate-500">No sessions in this period</td></tr>}
                </tbody>
              </table>
            </Card>

            {financeAllowed ? (
              <Card title="Financial Overview" icon={LineChart} className="min-w-0">
                <div className="flex items-center gap-3">
                  <Donut items={m.breakdown} size={96} inner={0.6} />
                  <Legend items={m.breakdown.slice(0, 6)} total={m.totalExpense} />
                </div>
                <div className="my-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-ink-700 py-1.5"><div className="text-[10px] text-slate-400">Income</div><div className="text-sm font-bold text-white">{num(m.totalIncome)}</div></div>
                  <div className="rounded-lg border border-ink-700 py-1.5"><div className="text-[10px] text-slate-400">Expenses</div><div className="text-sm font-bold text-white">{num(m.totalExpense)}</div></div>
                  <div className="rounded-lg border border-ink-700 py-1.5"><div className="text-[10px] text-slate-400">Net</div><div className="text-sm font-bold text-emerald-400">{num(net)}</div></div>
                </div>
                <div className="h-[80px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={m.trend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.5} /><stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="d" hide />
                      <Tooltip contentStyle={{ background: '#0a1030', border: '1px solid #27336f', borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="net" stroke="#8b7bff" strokeWidth={2} fill="url(#area)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {isMember && <div className="mt-1 text-[11px] text-slate-500">Monthly salary commitment: {num(rosterTotalSalary)} {cur}</div>}
              </Card>
            ) : (
              <Card title="Latest Updates" icon={Activity}><Updates items={data.updates} /></Card>
            )}
          </div>
        </div>

        {/* right column */}
        <div className="space-y-4">
          <Card title="Upcoming Matches" icon={CalendarCheck} link={isMember ? '/matches' : undefined}>
            <UpcomingMatches bare limit={4} />
          </Card>

          {financeAllowed && (
            <Card title="Recent Matches" icon={Swords} link={isMember ? '/matches' : undefined}>
              <RecentMatches matches={data.matches} />
            </Card>
          )}

          {actions.length > 0 && (
            <Card title="Quick Actions" icon={ZapIcon}>
              <div className="space-y-2.5">
                {actions.map((a) => (
                  <Link
                    key={a.id}
                    to={a.target}
                    style={{ background: a.color }}
                    className="flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
                  >
                    <Icon name={a.icon} size={20} />
                    <span className="flex-1">{a.label}</span>
                    <span>→</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {financeAllowed && <Card title="Latest Updates" icon={Activity}><Updates items={data.updates} /></Card>}

          {settings.quote_text && (
            <div className="card flex items-center gap-3 border-accent/40 bg-gradient-to-br from-accent/20 to-ink-900">
              {settings.logo_url ? <img src={settings.logo_url} alt="" className="h-14 w-14 object-contain" /> : <Quote className="text-accent" />}
              <div>
                <div className="text-sm font-medium text-white">{settings.quote_text}</div>
                {settings.quote_author && <div className="mt-1 text-xs text-violet-300">– {settings.quote_author}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ZapIcon(props) { return <Icon name="Zap" {...props} /> }

function RecentMatches({ matches }) {
  return (
    <div className="space-y-1">
      {matches.slice(0, 5).map((x) => (
        <div key={x.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-ink-700/50 py-2 text-[12px] first:border-0">
          <span className="text-slate-400">{x.played_on.slice(5)}</span>
          <div className="min-w-0">
            <div className="truncate font-medium text-white">{x.tournament || 'Match'}</div>
            <div className="text-slate-500">{x.map}</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-white">{x.placement ? `#${x.placement}` : '—'}</div>
            <div className="text-slate-500">{x.points} pts</div>
          </div>
        </div>
      ))}
      {!matches.length && <div className="py-4 text-center text-sm text-slate-500">No matches yet</div>}
    </div>
  )
}

function Updates({ items }) {
  if (!items.length) return <div className="py-3 text-center text-sm text-slate-500">No updates yet</div>
  return (
    <ul className="space-y-3">
      {items.map((u) => (
        <li key={u.id} className="flex items-start gap-3">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2 text-[13px] font-medium text-white">
              <span>{u.message}</span><span className="shrink-0 text-[10px] font-normal text-slate-500">{timeAgo(u.created_at)}</span>
            </div>
            {u.detail && <div className="truncate text-[11px] text-slate-500">{u.detail}</div>}
          </div>
        </li>
      ))}
    </ul>
  )
}

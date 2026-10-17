import { useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { useSettings } from '../context/SettingsContext'
import { addDays, download, num, todayStr, toCsv } from '../lib/format'
import { Card, PageHeader, Spinner } from '../components/ui'

export default function Reports() {
  const { settings } = useSettings()
  const [from, setFrom] = useState(addDays(todayStr(), -29))
  const [to, setTo] = useState(todayStr())

  const { data, loading } = useData(async () => {
    const [matches, expenses, income, training] = await Promise.all([
      supabase.from('matches').select('*').gte('played_on', from).lte('played_on', to).order('played_on'),
      supabase.from('expenses').select('*').gte('spent_on', from).lte('spent_on', to).order('spent_on'),
      supabase.from('income').select('*').gte('received_on', from).lte('received_on', to).order('received_on'),
      supabase.from('training_sessions').select('*').gte('held_on', from).lte('held_on', to).order('held_on'),
    ])
    return { data: { matches: matches.data || [], expenses: expenses.data || [], income: income.data || [], training: training.data || [] } }
  }, [from, to])

  const sum = (a, k) => (a || []).reduce((t, x) => t + Number(x[k] || 0), 0)
  const exportAll = () => {
    download(`matches_${from}_${to}.csv`, toCsv(data.matches))
    download(`expenses_${from}_${to}.csv`, toCsv(data.expenses))
    download(`income_${from}_${to}.csv`, toCsv(data.income))
    download(`training_${from}_${to}.csv`, toCsv(data.training))
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Pick a date range, then print or export."
        actions={
          <div className="no-print flex gap-2">
            <button className="btn-ghost" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button>
            <button className="btn-primary" disabled={!data} onClick={exportAll}><Download size={16} /> Export CSV</button>
          </div>
        }
      />
      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <label><span className="label">From</span><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span className="label">To</span><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>

      {loading || !data ? <Spinner /> : (
        <div className="space-y-4">
          <Card>
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
          </Card>

          <Card title="Matches" className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Tournament</th><th>Map</th><th>Place</th><th>Kills</th><th>Points</th></tr></thead>
              <tbody>
                {data.matches.map((m) => <tr key={m.id}><td>{m.played_on}</td><td>{m.tournament}</td><td>{m.map}</td><td>{m.placement}</td><td>{m.kills}</td><td>{m.points}</td></tr>)}
                {!data.matches.length && <tr><td colSpan={6} className="text-slate-500">None</td></tr>}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Expenses" className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {data.expenses.map((x) => <tr key={x.id}><td>{x.spent_on}</td><td>{x.category}</td><td>{x.description}</td><td className="text-right">{num(x.amount)}</td></tr>)}
                  {!data.expenses.length && <tr><td colSpan={4} className="text-slate-500">None</td></tr>}
                </tbody>
              </table>
            </Card>
            <Card title="Income" className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Type</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {data.income.map((x) => <tr key={x.id}><td>{x.received_on}</td><td>{x.type}</td><td>{x.description}</td><td className="text-right">{num(x.amount)}</td></tr>)}
                  {!data.income.length && <tr><td colSpan={4} className="text-slate-500">None</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

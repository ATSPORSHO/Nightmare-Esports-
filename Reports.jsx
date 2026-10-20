import { useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { useSettings } from '../context/SettingsContext'
import { addDays, download, num, todayStr, toCsv } from '../lib/format'
import { Card, PageHeader, Spinner } from '../components/ui'

export default function Reports() {
  const { settings } = useSettings()
  const [from, setFrom] = useState(addDays(todayStr(), -29))
  const [to, setTo] = useState(todayStr())
  const [reportType, setReportType] = useState('team_performance')

  const { data, loading } = useData(async () => {
    const [matches, expenses, income, training, stats, profiles] = await Promise.all([
      supabase.from('matches').select('*').gte('played_on', from).lte('played_on', to).order('played_on', { ascending: false }),
      supabase.from('expenses').select('*').gte('spent_on', from).lte('spent_on', to).order('spent_on', { ascending: false }),
      supabase.from('income').select('*').gte('received_on', from).lte('received_on', to).order('received_on', { ascending: false }),
      supabase.from('training_sessions').select('*').gte('held_on', from).lte('held_on', to).order('held_on', { ascending: false }),
      supabase.from('match_player_stats').select('*'),
      supabase.from('profiles').select('id, ign, full_name'),
    ])

    return {
      data: {
        matches: matches.data || [],
        expenses: expenses.data || [],
        income: income.data || [],
        training: training.data || [],
        stats: stats.data || [],
        profiles: profiles.data || [],
      }
    }
  }, [from, to])

  const sum = (a, k) => (a || []).reduce((t, x) => t + Number(x[k] || 0), 0)

  const topPlayers = (() => {
    if (!data) return []

    const agg = {}

    data.stats.forEach((s) => {
      const player = data.profiles.find((p) => p.id === s.player_id)
      if (!player) return

      if (!agg[s.player_id]) {
        agg[s.player_id] = {
          ign: player.ign || player.full_name || 'Unknown',
          kills: 0,
          points: 0,
        }
      }

      agg[s.player_id].kills += Number(s.kills || 0)
      agg[s.player_id].points += Number(s.points || 0)
    })

    return Object.entries(agg)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.kills - a.kills || b.points - a.points)
      .slice(0, 5)
  })()

  const totalMatches = data?.matches?.length || 0
  const totalPoints = sum(data?.matches, 'points')
  const averagePointsPerMatch = totalMatches ? totalPoints / totalMatches : 0

  const attendanceRate = (() => {
    if (!data?.training?.length) return 0
    const totalAttendees = data.training.reduce((t, x) => t + Number(x.attendees || 0), 0)
    const totalPlayers = data.training.reduce((t, x) => t + Number(x.total_players || 0), 0)
    if (!totalPlayers) return 0
    return (totalAttendees / totalPlayers) * 100
  })()

  const bestMatches = [...(data?.matches || [])]
    .sort((a, b) => Number(b.points || 0) - Number(a.points || 0))
    .slice(0, 5)

  const exportAll = () => {
    if (!data) return
    download(`matches_${from}_${to}.csv`, toCsv(data.matches))
    download(`expenses_${from}_${to}.csv`, toCsv(data.expenses))
    download(`income_${from}_${to}.csv`, toCsv(data.income))
    download(`training_${from}_${to}.csv`, toCsv(data.training))
  }

  const generateReportPdf = () => {
    if (!data) return

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFillColor(90, 0, 0)
    doc.rect(0, 0, pageWidth, 26, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(settings.team_name || 'Nightmare Esports Organization', 14, 17)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Report Period: ${from} to ${to}`, 14, 36)

    const summaryRows = [
      ['Matches Played', String(totalMatches)],
      ['Total Points', String(num(totalPoints))],
      ['Average Points / Match', String(num(averagePointsPerMatch))],
      ['Training Attendance Rate', `${num(attendanceRate)}%`],
      ['Income', `${num(sum(data.income, 'amount'))} ${settings.currency}`],
      ['Expenses', `${num(sum(data.expenses, 'amount'))} ${settings.currency}`],
      ['Net Balance', `${num(sum(data.income, 'amount') - sum(data.expenses, 'amount'))} ${settings.currency}`],
    ]

    autoTable(doc, {
      startY: 42,
      head: [['Metric', 'Value']],
      body: summaryRows,
      theme: 'grid',
      headStyles: { fillColor: [120, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { cellPadding: 3, fontSize: 9 },
    })

    const topPlayerRows = topPlayers.map((p, i) => [String(i + 1), p.ign, String(p.kills), String(p.points)])
    const topY = doc.lastAutoTable.finalY + 12

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Overall Top Players', 14, topY)

    autoTable(doc, {
      startY: topY + 5,
      head: [['#', 'IGN', 'Kills', 'Points']],
      body: topPlayerRows,
      theme: 'grid',
      headStyles: { fillColor: [70, 70, 70], textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    })

    const bestY = doc.lastAutoTable.finalY + 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Best 5 Matches', 14, bestY)

    const matchRows = bestMatches.map((m, i) => [
      String(i + 1),
      m.played_on,
      m.tournament || 'Match',
      m.map || '—',
      String(m.points),
    ])

    autoTable(doc, {
      startY: bestY + 5,
      head: [['#', 'Date', 'Tournament', 'Map', 'Points']],
      body: matchRows,
      theme: 'grid',
      headStyles: { fillColor: [70, 70, 70], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    })

    const trainingY = doc.lastAutoTable.finalY + 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Training Attendance', 14, trainingY)

    const trainingRows = (data.training || []).map((s) => {
      const rate = Number(s.total_players || 0)
        ? (Number(s.attendees || 0) / Number(s.total_players || 0)) * 100
        : 0
      return [s.name, s.held_on, String(s.attendees), String(s.total_players), `${num(rate)}%`]
    })

    autoTable(doc, {
      startY: trainingY + 5,
      head: [['Session', 'Date', 'Attendees', 'Total', 'Rate']],
      body: trainingRows,
      theme: 'grid',
      headStyles: { fillColor: [70, 70, 70], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    })

    const avgY = doc.lastAutoTable.finalY + 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Average Team Performance', 14, avgY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Total Points: ${num(totalPoints)}`, 14, avgY + 8)
    doc.text(`Matches Played: ${totalMatches}`, 14, avgY + 14)
    doc.text(`Average Points / Match: ${num(averagePointsPerMatch)}`, 14, avgY + 20)
    doc.text('Example: 4 matches × 20 total points = 5 points average', 14, avgY + 28)

    doc.save(`${settings.team_name || 'Nightmare_Esports'}_Professional_Report.pdf`)
  }

  const performanceCards = (
    <>
      <Card>
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.28em] text-red-300">Report Summary</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-white">
            {settings.team_name}
          </h2>
        </div>

        <table className="tbl max-w-xl">
          <tbody>
            <tr><td>Team Name</td><td className="text-right font-semibold text-white">{settings.team_name}</td></tr>
            <tr><td>From</td><td className="text-right font-semibold text-white">{from}</td></tr>
            <tr><td>To</td><td className="text-right font-semibold text-white">{to}</td></tr>
            <tr><td>Matches Played</td><td className="text-right font-semibold text-white">{totalMatches}</td></tr>
            <tr><td>Total Points</td><td className="text-right font-semibold text-white">{num(totalPoints)}</td></tr>
            <tr><td>Average Points / Match</td><td className="text-right font-semibold text-white">{num(averagePointsPerMatch)}</td></tr>
            <tr><td>Training Attendance Rate</td><td className="text-right font-semibold text-emerald-400">{num(attendanceRate)}%</td></tr>
          </tbody>
        </table>
      </Card>

      <Card title="Overall Top Players" className="overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>#</th><th>IGN</th><th>Kills</th><th>Points</th></tr></thead>
          <tbody>
            {topPlayers.map((player, i) => (
              <tr key={player.id}>
                <td>{i + 1}</td>
                <td>{player.ign}</td>
                <td>{player.kills}</td>
                <td className="font-semibold text-white">{player.points}</td>
              </tr>
            ))}
            {!topPlayers.length && <tr><td colSpan={4} className="text-slate-500">No player data</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Best 5 Matches" className="overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>#</th><th>Date</th><th>Tournament</th><th>Map</th><th>Points</th></tr></thead>
          <tbody>
            {bestMatches.map((match, i) => (
              <tr key={match.id}>
                <td>{i + 1}</td>
                <td>{match.played_on}</td>
                <td>{match.tournament || 'Match'}</td>
                <td>{match.map || '—'}</td>
                <td className="font-semibold text-white">{match.points}</td>
              </tr>
            ))}
            {!bestMatches.length && <tr><td colSpan={5} className="text-slate-500">No matches</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Training Attendance Rate" className="overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Session Name</th><th>Date</th><th>Attendees</th><th>Total Players</th><th>Rate</th></tr></thead>
          <tbody>
            {(data?.training || []).map((session) => {
              const rate = Number(session.total_players || 0)
                ? (Number(session.attendees || 0) / Number(session.total_players || 0)) * 100
                : 0

              return (
                <tr key={session.id}>
                  <td>{session.name}</td>
                  <td>{session.held_on}</td>
                  <td>{session.attendees}</td>
                  <td>{session.total_players}</td>
                  <td>{num(rate)}%</td>
                </tr>
              )
            })}
            {!data?.training?.length && <tr><td colSpan={5} className="text-slate-500">No training sessions</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Average Team Performance by Points" className="overflow-x-auto">
        <div className="rounded-xl border border-red-700/30 bg-red-900/10 p-4">
          <p className="text-sm text-slate-300">Total points in selected range:</p>
          <h3 className="mt-2 text-3xl font-black text-white">{num(totalPoints)}</h3>
          <p className="mt-2 text-sm text-slate-300">
            Matches played: {totalMatches}<br />
            Average points per match: <span className="font-bold text-red-300">{num(averagePointsPerMatch)}</span>
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-red-200/80">
            Example: 4 matches × 20 total points = 5 points average
          </p>
        </div>
      </Card>
    </>
  )

  const withExpenses = (
    <>
      {performanceCards}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Expenses" className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {(data?.expenses || []).map((x) => (
                <tr key={x.id}>
                  <td>{x.spent_on}</td>
                  <td>{x.category}</td>
                  <td>{x.description}</td>
                  <td className="text-right">{num(x.amount)}</td>
                </tr>
              ))}
              {!data?.expenses?.length && <tr><td colSpan={4} className="text-slate-500">None</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card title="Income" className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Type</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {(data?.income || []).map((x) => (
                <tr key={x.id}>
                  <td>{x.received_on}</td>
                  <td>{x.type}</td>
                  <td>{x.description}</td>
                  <td className="text-right">{num(x.amount)}</td>
                </tr>
              ))}
              {!data?.income?.length && <tr><td colSpan={4} className="text-slate-500">None</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      <Card>
        <table className="tbl max-w-xl">
          <tbody>
            <tr><td>Income ({settings.currency})</td><td className="text-right font-semibold text-white">{num(sum(data?.income, 'amount'))}</td></tr>
            <tr><td>Expenses ({settings.currency})</td><td className="text-right font-semibold text-white">{num(sum(data?.expenses, 'amount'))}</td></tr>
            <tr><td>Net Balance ({settings.currency})</td><td className="text-right font-semibold text-emerald-400">{num(sum(data?.income, 'amount') - sum(data?.expenses, 'amount'))}</td></tr>
          </tbody>
        </table>
      </Card>
    </>
  )

  const fullOrg = (
    <>
      {withExpenses}
      <Card title="Matches" className="overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Date</th><th>Tournament</th><th>Map</th><th>Place</th><th>Kills</th><th>Points</th></tr></thead>
          <tbody>
            {(data?.matches || []).map((m) => (
              <tr key={m.id}>
                <td>{m.played_on}</td>
                <td>{m.tournament}</td>
                <td>{m.map}</td>
                <td>{m.placement}</td>
                <td>{m.kills}</td>
                <td>{m.points}</td>
              </tr>
            ))}
            {!data?.matches?.length && <tr><td colSpan={6} className="text-slate-500">None</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  )

  const renderReportContent = () => {
    if (loading || !data) return <Spinner />

    if (reportType === 'team_performance') return <div className="space-y-4">{performanceCards}</div>
    if (reportType === 'team_expenses') return <div className="space-y-4">{withExpenses}</div>
    return <div className="space-y-4">{fullOrg}</div>
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Create performance reports by date range and report type."
        actions={
          <div className="no-print flex gap-2">
            <button className="btn-ghost" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button>
            <button className="btn-primary" disabled={!data} onClick={generateReportPdf}><Download size={16} /> Generate PDF</button>
            <button className="btn-ghost" disabled={!data} onClick={exportAll}><Download size={16} /> Export CSV</button>
          </div>
        }
      />

      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <label>
          <span className="label">Report Type</span>
          <select className="input !w-auto min-w-[260px]" value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="team_performance">Team Performance Only</option>
            <option value="team_expenses">Team Performance + Expenses</option>
            <option value="full_organization">Full Organization Report</option>
          </select>
        </label>

        <label><span className="label">From</span><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span className="label">To</span><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>

      {renderReportContent()}
    </div>
  )
}
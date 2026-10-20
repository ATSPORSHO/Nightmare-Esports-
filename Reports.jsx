<label>
  <span className="label">Report Type</span>
  <select className="input !w-auto min-w-[260px]" value={reportType} onChange={(e) => setReportType(e.target.value)}>
    <option value="team_performance">Team Performance Only</option>
    <option value="team_expenses">Team Performance + Expenses</option>
    <option value="full_organization">Full Organization Report</option>
  </select>
</label>

const renderReportContent = () => {
  if (!data) return <Spinner />

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
            {data.training.map((session) => {
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
            {!data.training.length && <tr><td colSpan={5} className="text-slate-500">No training sessions</td></tr>}
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
              {data.expenses.map((x) => (
                <tr key={x.id}>
                  <td>{x.spent_on}</td>
                  <td>{x.category}</td>
                  <td>{x.description}</td>
                  <td className="text-right">{num(x.amount)}</td>
                </tr>
              ))}
              {!data.expenses.length && <tr><td colSpan={4} className="text-slate-500">None</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card title="Income" className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Type</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {data.income.map((x) => (
                <tr key={x.id}>
                  <td>{x.received_on}</td>
                  <td>{x.type}</td>
                  <td>{x.description}</td>
                  <td className="text-right">{num(x.amount)}</td>
                </tr>
              ))}
              {!data.income.length && <tr><td colSpan={4} className="text-slate-500">None</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      <Card>
        <table className="tbl max-w-xl">
          <tbody>
            <tr><td>Income ({settings.currency})</td><td className="text-right font-semibold text-white">{num(sum(data.income, 'amount'))}</td></tr>
            <tr><td>Expenses ({settings.currency})</td><td className="text-right font-semibold text-white">{num(sum(data.expenses, 'amount'))}</td></tr>
            <tr><td>Net Balance ({settings.currency})</td><td className="text-right font-semibold text-emerald-400">{num(sum(data.income, 'amount') - sum(data.expenses, 'amount'))}</td></tr>
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
            {data.matches.map((m) => (
              <tr key={m.id}>
                <td>{m.played_on}</td>
                <td>{m.tournament}</td>
                <td>{m.map}</td>
                <td>{m.placement}</td>
                <td>{m.kills}</td>
                <td>{m.points}</td>
              </tr>
            ))}
            {!data.matches.length && <tr><td colSpan={6} className="text-slate-500">None</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  )

  if (reportType === 'team_performance') return <div className="space-y-4">{performanceCards}</div>
  if (reportType === 'team_expenses') return <div className="space-y-4">{withExpenses}</div>
  return <div className="space-y-4">{fullOrg}</div>
}
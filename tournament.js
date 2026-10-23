/** total = placement points + kill points */
export const totalOf = (e) => (Number(e.place_pts) || 0) + (Number(e.kill_pts) || 0)

/** leaderboard order: total, then kill points, then chicken dinners, then placement points */
export function rank(entries) {
  return [...entries].sort((a, b) =>
    totalOf(b) - totalOf(a) || (Number(b.kill_pts) || 0) - (Number(a.kill_pts) || 0) ||
    (Number(b.wwcd) || 0) - (Number(a.wwcd) || 0) || (Number(b.place_pts) || 0) - (Number(a.place_pts) || 0))
}

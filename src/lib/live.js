import { placementPoints } from './points'

/**
 * Live scorecard maths. state.teams = [{ id, name, tag, logo, country, kills, placement (null = still alive), adj }]
 * Automatic mode: a team that is still alive already counts the placement points it is guaranteed (= number of teams alive),
 * so the points move every time a team is eliminated. Manual mode: placement points only once you type a placement.
 */
export function computeRows(state, mode, view = 'match') {
  const teams = state?.teams || []
  const overall = view === 'overall'
  const alive = teams.filter((t) => t.placement == null || t.placement === '').length
  const rows = teams.map((t) => {
    const isAlive = t.placement == null || t.placement === ''
    // the winner of the match = placement #1, or the only team left alive -> counts as a WWCD (chicken dinner)
    const winner = Number(t.placement) === 1 || (isAlive && teams.length > 1 && alive === 1)
    const mpp = isAlive ? (mode === 'auto' ? placementPoints(alive) : 0) : placementPoints(t.placement)
    const mkills = Number(t.kills) || 0
    const mtp = mpp + mkills + (Number(t.adj) || 0)
    const b = t.base || {}                       // totals of the matches already uploaded (kept when you reset for the next match)
    const bpp = Number(b.pp) || 0, bk = Number(b.kills) || 0
    return {
      ...t, alive: isAlive, winner,
      pp: overall ? mpp + bpp : mpp, kills: overall ? mkills + bk : mkills, tp: overall ? mtp + bpp + bk : mtp,
      mpp, mkills, mtp, wwcd: (Number(b.wwcd) || 0) + (winner ? 1 : 0),
    }
  })
  // this match: alive teams stay above eliminated ones (later one out first). Full tournament: purely by total points.
  if (overall) rows.sort((a, b) => b.tp - a.tp || b.kills - a.kills || String(a.name).localeCompare(String(b.name)))
  else rows.sort((a, b) => Number(b.alive) - Number(a.alive) || (a.alive ? 0 : (a.placement || 99) - (b.placement || 99)) || b.tp - a.tp || b.kills - a.kills || String(a.name).localeCompare(String(b.name)))
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

export const LIVE_THEMES = {
  green: { name: 'Green', line: '#12b98c', block: '#08755c' },
  blue: { name: 'Blue', line: '#2d66dc', block: '#0f3f9e' },
  red: { name: 'Red', line: '#e23b3b', block: '#a31212' },
}

/** Player kills are kept apart from team kills (they never change the live scoreboard): `kills` = this match, `total` = earlier matches of this broadcast. */
export const playerTotal = (p) => (Number(p.total) || 0) + (Number(p.kills) || 0)

/** MVP list: every named player, most kills first. */
export function mvpList(state) {
  const out = []
  ;(state?.teams || []).forEach((t) => (t.players || []).forEach((p) => { if (p.name) out.push({ key: `${t.id}:${p.key}`, name: p.name, photo: p.photo || '', team: t, kills: Number(p.kills) || 0, total: playerTotal(p) }) }))
  out.sort((a, b) => b.total - a.total || b.kills - a.kills || a.name.localeCompare(b.name))
  return out.map((p, i) => ({ ...p, rank: i + 1 }))
}

/** WWCD video colour themes: the supplied video is blue, the other themes shift its hue (white text stays white). */
export const WWCD_THEMES = {
  blue: { name: 'Blue (original)', filter: 'none' },
  green: { name: 'Green', filter: 'hue-rotate(-95deg)' },
  red: { name: 'Red', filter: 'hue-rotate(125deg) saturate(1.1)' },
  purple: { name: 'Purple', filter: 'hue-rotate(50deg)' },
  gold: { name: 'Gold', filter: 'hue-rotate(170deg) brightness(1.1)' },
}

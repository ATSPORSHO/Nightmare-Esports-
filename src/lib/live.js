import { placementPoints } from './points'

/**
 * Live scorecard maths. state.teams = [{ id, name, tag, logo, country, kills, placement (null = still alive), adj }]
 * Automatic mode: a team that is still alive already counts the placement points it is guaranteed (= number of teams alive),
 * so the points move every time a team is eliminated. Manual mode: placement points only once you type a placement.
 */
export function computeRows(state, mode) {
  const teams = state?.teams || []
  const alive = teams.filter((t) => t.placement == null || t.placement === '').length
  const rows = teams.map((t) => {
    const isAlive = t.placement == null || t.placement === ''
    const pp = isAlive ? (mode === 'auto' ? placementPoints(alive) : 0) : placementPoints(t.placement)
    const kills = Number(t.kills) || 0
    return { ...t, alive: isAlive, pp, kills, tp: pp + kills + (Number(t.adj) || 0) }
  })
  // alive teams always stay above eliminated ones; eliminated teams sit below, the later one out (better placement) first
  rows.sort((a, b) => Number(b.alive) - Number(a.alive) || (a.alive ? 0 : (a.placement || 99) - (b.placement || 99)) || b.tp - a.tp || b.kills - a.kills || String(a.name).localeCompare(String(b.name)))
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

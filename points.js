/**
 * Team scoring rules (edit here if the tournament rules change):
 *   1st = 10, 2nd = 6, 3rd = 5, 4th = 4, 5th = 3, 6th = 2, 7th-8th = 1, 9th-25th = 0
 *   + 1 point for every kill
 */
export function placementPoints(placement) {
  const p = Number(placement)
  if (!p || p < 1) return 0
  if (p === 1) return 10
  if (p === 2) return 6
  if (p === 3) return 5
  if (p === 4) return 4
  if (p === 5) return 3
  if (p === 6) return 2
  if (p <= 8) return 1
  return 0
}

export const POINTS_PER_KILL = 1

export const matchPoints = (placement, kills) => placementPoints(placement) + (Number(kills) || 0) * POINTS_PER_KILL

import { supabase } from './supabase'

/** Move a player up (-1) or down (+1) on the roster board. Renumbers everyone so the order is saved cleanly. */
export async function movePlayer(list, index, dir) {
  const j = index + dir
  if (j < 0 || j >= list.length) return null
  const next = [...list]
  ;[next[index], next[j]] = [next[j], next[index]]
  const jobs = next
    .map((p, k) => ({ id: p.id, sort_order: k + 1, old: p.sort_order }))
    .filter((x) => x.sort_order !== x.old)
    .map((x) => supabase.from('profiles').update({ sort_order: x.sort_order }).eq('id', x.id))
  const res = await Promise.all(jobs)
  return res.find((r) => r.error)?.error || null
}

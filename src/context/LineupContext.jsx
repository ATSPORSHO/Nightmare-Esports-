import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const Ctx = createContext(null)
export const useLineup = () => useContext(Ctx)

/**
 * Lineups = Nightmare Esports, Nightmare Official, ... (managed in Admin Panel -> Lineups).
 * `current` is the lineup being viewed (null = the whole organization).
 */
export function LineupProvider({ children }) {
  const { role } = useAuth()
  const [lineups, setLineups] = useState([])
  const [slug, setSlugState] = useState(() => {
    try { return localStorage.getItem('lineup') || 'all' } catch { return 'all' }
  })

  const reload = useCallback(async () => {
    const { data } = await supabase.from('lineups').select('*').order('sort').order('name')
    setLineups(data || [])
  }, [])
  useEffect(() => { reload() }, [reload, role])

  const setSlug = (s) => {
    setSlugState(s)
    try { localStorage.setItem('lineup', s) } catch { /* ignore */ }
  }

  const activeLineups = useMemo(() => lineups.filter((l) => l.active), [lineups])
  const current = useMemo(() => activeLineups.find((l) => l.slug === slug) || null, [activeLineups, slug])
  const byId = useMemo(() => Object.fromEntries(lineups.map((l) => [l.id, l])), [lineups])

  /** keep only rows of the lineup being viewed. includeShared keeps rows that have no lineup (shared). */
  const filterRows = (rows, { includeShared = false } = {}) =>
    !current ? rows : rows.filter((r) => r.lineup_id === current.id || (includeShared && !r.lineup_id))

  const lineupName = (id) => (id ? byId[id]?.name || '—' : 'Organization')

  return (
    <Ctx.Provider value={{ lineups, activeLineups, current, slug: current?.slug || 'all', setSlug, filterRows, lineupName, reload }}>
      {children}
    </Ctx.Provider>
  )
}

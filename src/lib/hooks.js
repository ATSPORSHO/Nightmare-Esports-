import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tiny data-loading hook.
 *   const { data, loading, error, reload } = useData(() => supabase.from('x').select('*'), [dep])
 * The loader must return a supabase response ({ data, error }).
 */
export function useData(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const { data, error } = await loaderRef.current()
      setState({ data: data ?? null, loading: false, error: error?.message ?? null })
    } catch (e) {
      setState({ data: null, loading: false, error: e.message })
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run() }, deps)

  return { ...state, reload: run }
}

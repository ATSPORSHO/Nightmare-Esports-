import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

/**
 * role is one of:  'admin' | 'player' | 'guest'
 *   guest  = nobody logged in (dashboard view only)
 *   player = account created by the admin (view everything, submit screenshots)
 *   admin  = full control
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) { setProfile(null); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadProfile = useCallback(async (uid) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (session?.user?.id) loadProfile(session.user.id)
  }, [session?.user?.id, loadProfile])

  const role = session && profile ? profile.role : 'guest'

  const value = {
    session,
    profile,
    role,
    isAdmin: role === 'admin',
    isMember: role !== 'guest',
    loading,
    refreshProfile: () => session?.user?.id && loadProfile(session.user.id),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

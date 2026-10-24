import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { SettingsProvider, useSettings } from './context/SettingsContext'
import { configured } from './lib/supabase'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import TournamentView from './pages/TournamentView'
import TournamentReport from './pages/TournamentReport'
import { LineupProvider } from './context/LineupContext'
import Players from './pages/Players'
import Matches from './pages/Matches'
import Finance from './pages/Finance'
import Training from './pages/Training'
import Reports from './pages/Reports'
import Submit from './pages/Submit'
import Profile from './pages/Profile'
import Login from './pages/Login'
import Admin from './pages/Admin'
import { Spinner } from './components/ui'

function Guard({ roles, children }) {
  const { role, loading } = useAuth()
  const { settings } = useSettings()
  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (!roles.includes(role)) return <Navigate to={role === 'guest' && !settings.guest_enabled ? '/login' : role === 'guest' ? '/login' : '/'} replace />
  return children
}

/**
 * The one-click reminder e-mail opens  <site>/?next=submit/training#access_token=...
 * The Supabase client signs the player in from the hash; then we forward them to the upload page.
 */
function NextRedirect() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next')
    if (!next || loading) return
    window.history.replaceState({}, '', window.location.pathname)
    navigate(session ? '/' + next.replace(/^\//, '') : '/login', { replace: true })
  }, [loading, session, navigate])
  return null
}

function SetupNeeded() {
  return (
    <div className="mx-auto mt-24 max-w-xl rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-amber-100">
      <h1 className="mb-2 font-display text-2xl font-bold">Almost there — connect Supabase</h1>
      <p className="text-sm leading-relaxed">
        Create a <code>.env.local</code> file (see <code>.env.example</code>) with <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_ANON_KEY</code>, then restart <code>npm run dev</code>. When deploying with GitHub Pages, add the
        same two values as repository secrets. Full steps are in README.md.
      </p>
    </div>
  )
}

export default function App() {
  if (!configured) return <SetupNeeded />
  return (
    <ThemeProvider>
    <HashRouter>
      <AuthProvider>
        <SettingsProvider>
          <LineupProvider>
          <NextRedirect />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="tournament/:id" element={<TournamentView />} />
              <Route path="tournament/:id/report" element={<Guard roles={['admin']}><TournamentReport /></Guard>} />
              <Route path="lineup/:slug" element={<Dashboard />} />
              <Route path="dashboard" element={<Navigate to="/" replace />} />
              <Route path="players" element={<Guard roles={['admin', 'management', 'player']}><Players /></Guard>} />
              <Route path="matches" element={<Guard roles={['admin', 'management', 'player']}><Matches /></Guard>} />
              <Route path="finance" element={<Guard roles={['admin', 'management', 'player']}><Finance /></Guard>} />
              <Route path="training" element={<Guard roles={['admin', 'management', 'player']}><Training /></Guard>} />
              <Route path="reports" element={<Guard roles={['admin', 'management', 'player']}><Reports /></Guard>} />
              <Route path="submit/:kind" element={<Guard roles={['admin', 'player']}><Submit /></Guard>} />
              <Route path="profile" element={<Guard roles={['admin', 'management', 'player']}><Profile /></Guard>} />
              <Route path="admin" element={<Guard roles={['admin']}><Admin /></Guard>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          </LineupProvider>
        </SettingsProvider>
      </AuthProvider>
    </HashRouter>
    </ThemeProvider>
  )
}

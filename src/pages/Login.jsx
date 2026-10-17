import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { ErrorBox } from '../components/ui'

export default function Login() {
  const { signIn, session, loading } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    if (error) setError(error.message)
    else navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-ink-600 bg-ink-900/90 p-7 shadow-2xl">
        <div className="mb-6 text-center">
          {settings.logo_url
            ? <img src={settings.logo_url} alt="" className="mx-auto mb-3 h-16 w-16 object-contain" />
            : <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-accent/30 font-display text-3xl font-bold text-white">{settings.team_name[0]}</div>}
          <h1 className="font-display text-3xl font-bold italic text-white">{settings.team_name}</h1>
          <p className="text-sm text-slate-400">{settings.app_title} · {settings.app_subtitle}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <ErrorBox>{error}</ErrorBox>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Accounts are created by your team admin. Forgot your password? Ask the admin to reset it.
        </p>
        {settings.guest_enabled && (
          <p className="mt-3 text-center text-sm">
            <Link to="/" className="text-violet-300 hover:text-white">Continue as guest (dashboard only) →</Link>
          </p>
        )}
      </form>
    </div>
  )
}

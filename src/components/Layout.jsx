import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Trophy, Wallet, Dumbbell, BarChart3, Settings, LogIn, LogOut, Bell, Menu, X, Clock, ShieldCheck, UserCircle, ChevronDown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { supabase } from '../lib/supabase'
import { Avatar } from './ui'

const MEMBER_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/matches', label: 'Match Results', icon: Trophy },
  { to: '/finance', label: 'Finance', icon: Wallet },
  { to: '/training', label: 'Training', icon: Dumbbell },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
]

export default function Layout() {
  const { role, isAdmin, profile, signOut } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [now, setNow] = useState(new Date())
  const [newSubs, setNewSubs] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // bell: number of unreviewed screenshot submissions (admin only)
  useEffect(() => {
    if (!isAdmin) { setNewSubs(0); return }
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'new')
      .then(({ count }) => setNewSubs(count || 0))
  }, [isAdmin])

  const nav = role === 'guest' ? [MEMBER_NAV[0]] : [...MEMBER_NAV, isAdmin
    ? { to: '/admin', label: 'Admin Panel', icon: Settings }
    : { to: '/profile', label: 'My Profile', icon: UserCircle }]

  const fmtDate = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, day: 'numeric', month: 'short', year: 'numeric' }).format(now)
  const fmtTime = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)

  const logout = async () => { await signOut(); navigate('/') }

  return (
    <div className="min-h-screen">
      {/* ---------- header ---------- */}
      <header
        className="relative border-b border-ink-700/80 bg-ink-900/90"
        style={settings.banner_url ? {
          backgroundImage: `linear-gradient(90deg, rgba(7,4,5,.95) 0%, rgba(7,4,5,.55) 50%, rgba(7,4,5,.95) 100%), url(${settings.banner_url})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
        } : undefined}
      >
        <div className="flex h-[72px] items-center gap-3 px-4">
          <button className="rounded p-2 text-slate-300 hover:bg-ink-700 lg:hidden" onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link to="/" className="flex items-center gap-3">
            {settings.logo_url
              ? <img src={settings.logo_url} alt="" className="h-11 w-11 rounded-lg object-contain" />
              : <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/30 font-display text-xl font-bold text-white">{settings.team_name[0]}</span>}
            <span className="font-display text-lg font-extrabold uppercase tracking-[0.14em] text-white">{settings.team_name}</span>
          </Link>
          <div className="mx-4 hidden border-l border-ink-600 pl-4 md:block">
            <div className="font-display text-sm font-bold uppercase leading-tight tracking-[0.08em] text-white">{settings.app_title}</div>
            <div className="mt-0.5 text-[11px] tracking-wide text-slate-400">{settings.app_subtitle}</div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-ink-600 bg-ink-900/70 px-3 py-1.5 text-[11px] text-slate-300 sm:flex">
              <Clock size={14} className="text-accent" />
              <div>
                <div className="text-slate-500">Current time</div>
                <div className="font-medium text-white">{fmtDate} | {fmtTime}</div>
              </div>
            </div>

            {isAdmin && (
              <Link to="/admin?tab=submissions" className="relative rounded-lg border border-ink-600 p-2 text-slate-300 hover:bg-ink-700" title="New submissions">
                <Bell size={18} />
                {newSubs > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{newSubs}</span>}
              </Link>
            )}

            {role === 'guest' ? (
              <Link to="/login" className="btn-primary"><LogIn size={16} /> Log in</Link>
            ) : (
              <div className="relative">
                <button onClick={() => setMenu(!menu)} className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-900/70 px-2.5 py-1.5 hover:bg-ink-800">
                  <Avatar name={profile?.ign || profile?.full_name} url={profile?.avatar_url} size={32} />
                  <div className="hidden text-left sm:block">
                    <div className="text-sm font-semibold leading-tight text-white">{profile?.ign || profile?.full_name || 'Account'}</div>
                    <div className="text-[11px] capitalize text-slate-400">{role === 'admin' ? 'Administrator' : 'Player'}</div>
                  </div>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
                {menu && (
                  <div className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-lg border border-ink-600 bg-ink-900 shadow-xl" onMouseLeave={() => setMenu(false)}>
                    <Link to={isAdmin ? '/admin' : '/profile'} onClick={() => setMenu(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-ink-700">
                      {isAdmin ? <ShieldCheck size={15} /> : <UserCircle size={15} />} {isAdmin ? 'Admin Panel' : 'My Profile'}
                    </Link>
                    <button onClick={logout} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-ink-700">
                      <LogOut size={15} /> Log out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* ---------- sidebar ---------- */}
        <aside
          className={`${open ? 'block' : 'hidden'} fixed inset-x-0 top-[72px] z-30 border-b border-ink-700 bg-ink-900 p-3 lg:static lg:block lg:min-h-[calc(100vh-72px)] lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r lg:bg-ink-900/60`}
        >
          <nav className="flex flex-col gap-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'text-slate-300 hover:bg-ink-700/70'
                  }`
                }
              >
                <n.icon size={18} /> {n.label}
              </NavLink>
            ))}
            {role === 'guest' && (
              <Link to="/login" onClick={() => setOpen(false)} className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-ink-700/70">
                <LogIn size={18} /> Team login
              </Link>
            )}
          </nav>
          <div className="mt-10 hidden px-3 text-[11px] text-slate-500 lg:block">
            <div className="text-slate-400">{settings.team_name}</div>
            <div>© {now.getFullYear()}. {settings.footer_text}</div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

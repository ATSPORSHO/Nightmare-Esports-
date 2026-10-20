import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trophy, Users, Swords, Crosshair, Medal, ArrowRight, LogIn, Settings, Flame } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useLineup } from '../context/LineupContext'
import { num } from '../lib/format'
import { Avatar, Spinner } from '../components/ui'

const fmtDate = (d) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default function Home() {
  const { role, isAdmin } = useAuth()
  const { settings } = useSettings()
  const { activeLineups, lineupName, setSlug } = useLineup()
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const member = role !== 'guest'
      const [events, matches, roster] = await Promise.all([
        supabase.from('events').select('*').order('event_date', { ascending: false }),
        supabase.from('matches').select('id, lineup_id, kills, points'),
        member
          ? supabase.from('profiles').select('id, full_name, ign, player_role, status, avatar_url, lineup_id').eq('role', 'player').order('created_at')
          : supabase.from('public_roster').select('*'),
      ])
      if (!alive) return
      setD({ events: events.data || [], matches: matches.data || [], roster: roster.data || [] })
    })()
    return () => { alive = false }
  }, [role])

  const stats = useMemo(() => {
    if (!d) return null
    const sum = (a, k) => a.reduce((t, x) => t + Number(x[k] || 0), 0)
    const perLineup = activeLineups.map((l) => {
      const ms = d.matches.filter((m) => m.lineup_id === l.id)
      const players = d.roster.filter((p) => p.lineup_id === l.id)
      return { l, players, active: players.filter((p) => p.status === 'active').length, matches: ms.length, kills: sum(ms, 'kills'), points: sum(ms, 'points') }
    })
    const events = [...d.events].sort((a, b) => Number(b.featured) - Number(a.featured) || b.event_date.localeCompare(a.event_date))
    return {
      perLineup, events,
      players: d.roster.filter((p) => p.status === 'active').length,
      matches: d.matches.length, kills: sum(d.matches, 'kills'), points: sum(d.matches, 'points'),
      maxPoints: Math.max(1, ...perLineup.map((x) => x.points)),
    }
  }, [d, activeLineups])

  const openLineup = (slug) => { setSlug(slug); navigate('/dashboard') }

  const hero = settings.banner_url
    ? `linear-gradient(180deg, rgba(7,4,5,.55), rgba(7,4,5,.95)), url(${settings.banner_url})`
    : 'radial-gradient(900px 380px at 50% -20%, rgba(200,16,46,.45), transparent 70%), linear-gradient(180deg, #14080a, #070405)'

  if (!stats) return <div className="flex justify-center py-24"><Spinner /></div>

  const events = showAll ? stats.events : stats.events.slice(0, 6)

  return (
    <div className="space-y-8">
      {/* ---------- hero ---------- */}
      <section
        className="relative overflow-hidden rounded-2xl border border-red-900/60 px-6 py-12 text-center shadow-[0_0_60px_-20px_rgba(200,16,46,.6)] sm:py-16"
        style={{ backgroundImage: hero, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {settings.logo_url && <img src={settings.logo_url} alt="" className="mx-auto mb-4 h-24 w-24 object-contain drop-shadow-[0_0_18px_rgba(200,16,46,.7)]" />}
        <h1 className="font-display text-4xl font-bold uppercase tracking-[0.12em] text-white sm:text-6xl">
          {settings.org_name}
        </h1>
        {settings.org_tagline && <p className="mt-3 font-display text-lg uppercase tracking-[0.35em] text-red-400">{settings.org_tagline}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button className="btn-primary px-6 py-3" onClick={() => { setSlug('all'); navigate('/dashboard') }}>
            Organization dashboard <ArrowRight size={16} />
          </button>
          {role === 'guest' && <Link to="/login" className="btn-ghost px-6 py-3"><LogIn size={16} /> Team login</Link>}
        </div>
      </section>

      {/* ---------- organization overview ---------- */}
      <section>
        <h2 className="mb-3 font-display text-2xl font-bold uppercase tracking-wide text-white">Organization overview</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            [Flame, 'Active lineups', activeLineups.length],
            [Users, 'Active players', stats.players],
            [Swords, 'Matches played', stats.matches],
            [Crosshair, 'Total kills', stats.kills],
            [Trophy, 'Total points', stats.points],
          ].map(([Ic, label, val]) => (
            <div key={label} className="card flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/20 text-red-400"><Ic size={22} /></span>
              <div>
                <div className="text-xs text-slate-400">{label}</div>
                <div className="font-display text-3xl font-bold leading-tight text-white">{num(val)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- active lineups ---------- */}
      <section>
        <h2 className="mb-3 font-display text-2xl font-bold uppercase tracking-wide text-white">Active lineups</h2>
        {!stats.perLineup.length ? (
          <div className="card text-center text-sm text-slate-400">
            {role === 'guest' ? 'Log in to see the team lineups.' : 'No lineups yet. Add them in Admin Panel → Lineups.'}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {stats.perLineup.map(({ l, players, active, matches, points }) => (
              <div key={l.id} className="card relative overflow-hidden border-red-900/60 bg-gradient-to-br from-red-950/50 to-ink-900">
                <div className="flex items-center gap-4">
                  {l.logo_url
                    ? <img src={l.logo_url} alt="" className="h-16 w-16 rounded-lg object-contain" />
                    : <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-accent/30 font-display text-3xl font-bold text-white">{l.name[0]}</span>}
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-white">{l.name}</h3>
                    {l.tagline && <p className="text-sm text-slate-400">{l.tagline}</p>}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 divide-x divide-ink-700 text-center">
                  <div><div className="font-display text-2xl font-bold text-white">{active}</div><div className="text-[11px] text-slate-400">Active players</div></div>
                  <div><div className="font-display text-2xl font-bold text-white">{matches}</div><div className="text-[11px] text-slate-400">Matches</div></div>
                  <div><div className="font-display text-2xl font-bold text-white">{num(points)}</div><div className="text-[11px] text-slate-400">Points</div></div>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded bg-ink-700">
                  <div className="h-full rounded bg-accent" style={{ width: `${Math.round((points / stats.maxPoints) * 100)}%` }} />
                </div>

                {players.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {players.slice(0, 6).map((p) => (
                      <span key={p.id} className="flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-850 py-0.5 pl-0.5 pr-2.5 text-xs text-slate-200">
                        <Avatar name={p.ign || p.full_name} url={p.avatar_url} size={20} /> {p.ign || p.full_name}
                      </span>
                    ))}
                  </div>
                )}

                <button className="btn-primary mt-5 w-full" onClick={() => openLineup(l.slug)}>
                  Open {l.name} dashboard <ArrowRight size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- successful events ---------- */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">Successful events</h2>
          {isAdmin && <Link to="/admin?tab=events" className="btn-ghost btn-sm"><Settings size={13} /> Manage events</Link>}
        </div>
        {!events.length ? (
          <div className="card text-center text-sm text-slate-400">
            {isAdmin ? 'No events yet. Add your achievements in Admin Panel → Events.' : 'Achievements will appear here.'}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <article key={e.id} className="card overflow-hidden !p-0">
                  {e.image_url && <img src={e.image_url} alt="" className="h-40 w-full object-cover" />}
                  <div className="p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {e.placement && <span className="badge-accent"><Medal size={11} className="mr-1 inline" />{e.placement}</span>}
                      {e.featured && <span className="badge-amber">Featured</span>}
                      <span className="text-[11px] text-slate-500">{fmtDate(e.event_date)}</span>
                    </div>
                    <h3 className="font-display text-xl font-bold leading-tight text-white">{e.title}</h3>
                    <div className="mt-1 text-xs text-red-300">{lineupName(e.lineup_id)}{e.prize ? ` · ${e.prize}` : ''}</div>
                    {e.description && <p className="mt-2 text-sm text-slate-400">{e.description}</p>}
                  </div>
                </article>
              ))}
            </div>
            {stats.events.length > 6 && (
              <div className="mt-4 text-center">
                <button className="btn-ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${stats.events.length} events`}</button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ---------- about ---------- */}
      {settings.org_about && (
        <section className="card">
          <h2 className="mb-2 font-display text-2xl font-bold uppercase tracking-wide text-white">About {settings.org_name}</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{settings.org_about}</p>
        </section>
      )}
    </div>
  )
}

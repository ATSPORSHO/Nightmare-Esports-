import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trophy, Users, Medal, ArrowRight, LogIn, Settings, ShieldCheck, Flame } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useLineup } from '../context/LineupContext'
import { num } from '../lib/format'
import { Spinner } from '../components/ui'

const fmtDate = (d) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })

// red / dark tile colours for the player pictures
const TILE = [
  'bg-gradient-to-br from-red-600 to-red-900',
  'bg-gradient-to-br from-rose-500 to-red-900',
  'bg-gradient-to-br from-red-700 to-ink-800',
  'bg-gradient-to-br from-red-500 to-rose-900',
  'bg-gradient-to-br from-rose-700 to-ink-800',
]

const fmtDay = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function SectionTitle({ children, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-3 font-display text-base font-extrabold uppercase tracking-[0.1em] text-white">
        <span className="h-5 w-1 rounded bg-accent" />{children}
      </h2>
      {action}
    </div>
  )
}

export default function Home() {
  const { role, isAdmin } = useAuth()
  const { settings } = useSettings()
  const { activeLineups } = useLineup()
  const navigate = useNavigate()
  // guests only get the public home page when the dashboard is switched off
  const dashOpen = role !== 'guest' || settings.guest_enabled
  const [d, setD] = useState(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const member = role !== 'guest'
      const [events, matches, roster, tournaments] = await Promise.all([
        supabase.from('events').select('*').order('event_date', { ascending: false }),
        supabase.from('matches').select('id, lineup_id, kills, points, placement'),
        member
          ? supabase.from('profiles').select('id, full_name, ign, player_role, status, avatar_url, lineup_id').eq('role', 'player').order('sort_order').order('created_at')
          : supabase.from('public_roster').select('*').order('sort_order'),
        supabase.from('tournaments').select('*').eq('active', true).order('start_date'),
      ])
      if (!alive) return
      setD({ tournaments: tournaments.data || [], events: events.data || [], matches: matches.data || [], roster: roster.data || [] })
    })()
    return () => { alive = false }
  }, [role])

  const todayTeam = new Intl.DateTimeFormat('en-CA', { timeZone: settings.timezone }).format(new Date())
  const stats = useMemo(() => {
    if (!d) return null
    const sum = (a, k) => a.reduce((t, x) => t + Number(x[k] || 0), 0)
    const single = activeLineups.length <= 1
    // with only one lineup, anything without a lineup belongs to it
    const belongs = (row, l) => row.lineup_id === l.id || (single && !row.lineup_id)
    const perLineup = activeLineups.map((l) => ({
      l,
      players: d.roster.filter((p) => belongs(p, l) && p.status !== 'inactive'),
    }))
    const wins = d.matches.filter((m) => Number(m.placement) === 1).length
    return {
      perLineup,
      active: d.tournaments
        .filter((t) => !t.end_date || t.end_date >= todayTeam)
        .map((t) => ({ t, live: t.start_date <= todayTeam })),
      events: [...d.events].sort((a, b) => Number(b.featured) - Number(a.featured) || b.event_date.localeCompare(a.event_date)),
      players: d.roster.filter((p) => p.status === 'active').length,
      matches: d.matches.length, kills: sum(d.matches, 'kills'), points: sum(d.matches, 'points'),
      winRate: d.matches.length ? Math.round((wins / d.matches.length) * 100) : 0,
    }
  }, [d, activeLineups, todayTeam])

  const orgName = (settings.org_name || 'Nightmare Esports Organization').toUpperCase()
  const [first, ...rest] = orgName.split(' ')
  const heroBg = settings.banner_url
    ? `linear-gradient(90deg, rgba(7,4,5,.92) 0%, rgba(7,4,5,.55) 55%, rgba(7,4,5,.85) 100%), url(${settings.banner_url})`
    : 'radial-gradient(700px 320px at 75% 20%, rgba(200,16,46,.45), transparent 70%), radial-gradient(500px 300px at 10% 110%, rgba(200,16,46,.2), transparent 70%), linear-gradient(180deg, #14080a, #070405)'

  if (!stats) return <div className="flex justify-center py-24"><Spinner /></div>

  const featured = stats.events.filter((e) => e.featured)
  const others = stats.events.filter((e) => !e.featured)
  const events = showAll ? others : others.slice(0, 4)
  const year = (e) => new Date(e.event_date + 'T00:00:00Z').getUTCFullYear()

  return (
    <div className="space-y-5">
      {/* ---------- hero ---------- */}
      <section
        className="dark-scope relative overflow-hidden rounded-2xl border border-red-900/60 px-6 py-10 shadow-[0_0_60px_-25px_rgba(200,16,46,.7)] sm:px-10 sm:py-14"
        style={{ backgroundImage: heroBg, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="flex flex-wrap items-center gap-8">
          {settings.logo_url && <img src={settings.logo_url} alt="" className="h-28 w-28 shrink-0 object-contain drop-shadow-[0_0_22px_rgba(200,16,46,.7)] sm:h-36 sm:w-36" />}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.4em] text-red-500">Welcome to —</div>
            <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-none tracking-wide text-white sm:text-7xl">{first}</h1>
            <div className="mt-2 font-display text-lg font-extrabold uppercase tracking-[0.35em] text-[#ff3b4a] sm:text-2xl">{rest.join(' ')}</div>
            {settings.org_tagline && <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300">{settings.org_tagline}</p>}

            <div className="mt-6 flex flex-wrap items-center gap-6">
              {[
                [Users, stats.perLineup.length, 'Active lineups'],
                [Trophy, stats.events.length, 'Tournaments / events'],
                [ShieldCheck, stats.players, 'Active players'],
              ].map(([Ic, val, label]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-red-700/70 bg-red-950/50 text-red-400"><Ic size={20} /></span>
                  <div>
                    <div className="font-display text-xl font-extrabold leading-none text-white">{num(val)}</div>
                    <div className="mt-1 text-[11px] text-slate-400">{label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              {dashOpen && stats.perLineup[0] && <button className="btn-primary px-5 py-2.5" onClick={() => navigate(`/lineup/${stats.perLineup[0].l.slug}`)}>View lineup dashboard <ArrowRight size={16} /></button>}
              {role === 'guest' && <Link to="/login" className="btn-ghost px-5 py-2.5"><LogIn size={16} /> Team login</Link>}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          {/* ---------- active lineups ---------- */}
          <section className="card border-red-900/50">
            <SectionTitle action={isAdmin && <Link to="/admin?tab=lineups" className="btn-ghost btn-sm"><Settings size={13} /> Manage lineups</Link>}>Active lineups</SectionTitle>
            {!stats.perLineup.length ? (
              <div className="py-6 text-center text-sm text-slate-400">
                {isAdmin ? 'No lineups yet. Run the organization SQL, or add one in Admin Panel → Lineups.' : 'Lineups will appear here.'}
              </div>
            ) : (
              <div className={`grid gap-4 ${stats.perLineup.length > 1 ? 'lg:grid-cols-2' : ''}`}>
                {stats.perLineup.map(({ l, players }) => (
                  <div key={l.id} className="relative overflow-hidden rounded-xl border border-red-900/60 bg-gradient-to-br from-red-950/50 via-ink-900 to-ink-950 p-4">
                    <div className="flex items-center gap-4">
                      {l.logo_url
                        ? <img src={l.logo_url} alt="" className="h-14 w-14 rounded-lg object-contain" />
                        : <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent/30 font-display text-2xl font-extrabold text-white">{l.name[0]}</span>}
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-white">{l.name}</h3>
                        <p className="text-xs uppercase tracking-wider text-slate-400">{l.tagline || 'PUBG MOBILE TEAM'}</p>
                      </div>
                    </div>
                    <div className="mt-12 grid grid-cols-2 gap-x-3 gap-y-12 sm:grid-cols-3 xl:grid-cols-5">
                      {players.slice(0, 5).map((p, i) => (
                        <div key={p.id} className="text-center">
                          {/* rounded tile; the player picture pops out above it */}
                          <div className={`dark-scope relative mx-auto aspect-square w-full max-w-[140px] rounded-[1.6rem] border border-red-500/20 shadow-lg shadow-black/40 ${TILE[i % TILE.length]}`}>
                            {p.avatar_url
                              ? <img src={p.avatar_url} alt="" className="absolute bottom-0 left-1/2 h-[125%] w-auto max-w-none -translate-x-1/2 object-contain object-bottom drop-shadow-[0_8px_10px_rgba(0,0,0,.55)]" />
                              : <span className="absolute inset-0 flex items-center justify-center font-display text-5xl font-extrabold text-white/70">{(p.ign || p.full_name || '?')[0].toUpperCase()}</span>}
                          </div>
                          <div className="mt-2 truncate text-sm font-semibold text-white">{p.ign || p.full_name}</div>
                          <div className="truncate text-[11px] text-slate-400">{p.player_role || ''}</div>
                        </div>
                      ))}
                      {!players.length && <div className="col-span-full py-3 text-center text-xs text-slate-500">No players in this lineup yet.</div>}
                    </div>
                    {dashOpen && <div className="mt-4 text-center">
                      <button className="btn-ghost btn-sm border-red-700/60 px-5" onClick={() => navigate(`/lineup/${l.slug}`)}>View lineup <ArrowRight size={13} /></button>
                    </div>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ---------- active tournaments (organized by us) ---------- */}
          <section className="card border-red-900/50">
            <SectionTitle action={isAdmin && <Link to="/admin?tab=tournaments" className="btn-ghost btn-sm"><Settings size={13} /> Manage tournaments</Link>}>Active tournaments</SectionTitle>
            {!stats.active.length ? (
              <div className="py-6 text-center text-sm text-slate-400">
                {isAdmin ? 'No active tournaments. Add one in Admin Panel → Tournaments.' : 'No tournaments are running right now.'}
              </div>
            ) : (
              <div className={`grid gap-4 ${stats.active.length > 1 ? 'lg:grid-cols-2' : ''}`}>
                {stats.active.map(({ t, live }) => (
                  <article key={t.id} className="relative overflow-hidden rounded-xl border border-red-900/60 bg-gradient-to-br from-red-950/50 via-ink-900 to-ink-950 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-red-900/60 bg-ink-950">
                        {t.logo_url ? <img src={t.logo_url} alt="" className="h-full w-full object-contain p-2" /> : <Trophy size={36} className="text-red-500/80" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`mb-1 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${live ? 'bg-red-600/90 text-white' : 'border border-amber-500/60 text-amber-300'}`}>
                          {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}{live ? 'Live now' : 'Upcoming'}
                        </span>
                        <h3 className="font-display text-base font-extrabold uppercase leading-tight tracking-wide text-white">{t.title}</h3>
                        {t.description && <p className="mt-1 text-[11px] text-slate-400">{t.description}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
                      {t.prize_pool && <div><div className="text-[10px] uppercase tracking-wider text-slate-400">Prize pool</div><div className="font-display text-lg font-extrabold text-amber-300">{t.prize_pool}</div></div>}
                      <div><div className="text-[10px] uppercase tracking-wider text-slate-400">{t.end_date ? 'Dates' : 'Starts'}</div><div className="text-sm font-semibold text-white">{fmtDay(t.start_date)}{t.end_date ? ` – ${fmtDay(t.end_date)}` : ''}</div></div>
                      {t.teams ? <div><div className="text-[10px] uppercase tracking-wider text-slate-400">Teams</div><div className="text-sm font-semibold text-white">{t.teams}</div></div> : null}
                      {t.link_url && <a href={t.link_url} target="_blank" rel="noreferrer" className="btn-primary btn-sm ml-auto">Details <ArrowRight size={13} /></a>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* ---------- successful events ---------- */}
          <section className="card border-red-900/50">
            <SectionTitle action={isAdmin && <Link to="/admin?tab=events" className="btn-ghost btn-sm"><Settings size={13} /> Manage events</Link>}>Successful events</SectionTitle>
            {!stats.events.length ? (
              <div className="py-6 text-center text-sm text-slate-400">
                {isAdmin ? 'No events yet. Add your achievements in Admin Panel → Events.' : 'Achievements will appear here.'}
              </div>
            ) : (
              <>
                {featured.length > 0 && (
                  <div className={`mb-4 grid gap-4 ${featured.length > 1 ? 'lg:grid-cols-2' : ''}`}>
                    {featured.map((e) => (
                      <article key={e.id} className="relative overflow-hidden rounded-xl border border-red-700/70 bg-gradient-to-br from-red-950/60 via-ink-900 to-ink-950 p-4 shadow-[0_0_30px_-15px_rgba(200,16,46,.8)]">
                        <div className="flex items-center gap-4">
                          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-red-900/60 bg-ink-950 sm:h-32 sm:w-32">
                            {e.image_url
                              ? <img src={e.image_url} alt="" className="h-full w-full object-contain p-2" />
                              : <Trophy size={44} className="text-red-500/80" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="rounded border border-amber-500/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">Featured</span>
                              {e.kind && <span className="rounded border border-red-700/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-300">{e.kind}</span>}
                            </div>
                            <h3 className="font-display text-lg font-extrabold uppercase leading-tight tracking-wide text-white">{e.title}</h3>
                            {e.placement && <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-[#ff5a67]"><Medal size={14} />{e.placement}</div>}
                            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                              {e.prize && <div><div className="text-[10px] uppercase tracking-wider text-slate-400">Prize pool</div><div className="font-display text-lg font-extrabold text-amber-300">{e.prize}</div></div>}
                              <div><div className="text-[10px] uppercase tracking-wider text-slate-400">Year</div><div className="font-display text-lg font-extrabold text-white">{year(e)}</div></div>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {events.map((e) => (
                    <article key={e.id} className="relative flex flex-col overflow-hidden rounded-xl border border-red-900/60 bg-gradient-to-b from-red-950/40 to-ink-950 p-3">
                      {e.kind && <span className="mb-2 w-fit rounded border border-red-700/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-300">{e.kind}</span>}
                      <h3 className="text-sm font-semibold leading-snug text-white">{e.title}</h3>
                      {e.description && <p className="mt-1 text-[11px] text-slate-400">{e.description}</p>}
                      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                        <div className="min-w-0">
                          {e.placement && <div className="flex items-center gap-1 text-xs font-semibold text-[#ff5a67]"><Medal size={12} />{e.placement}</div>}
                          {e.prize && <div className="text-[10px] text-amber-300">{e.prize}</div>}
                          <div className="mt-0.5 text-[10px] text-slate-500">{fmtDate(e.event_date)}</div>
                        </div>
                        {e.image_url && <img src={e.image_url} alt="" className="h-12 w-12 shrink-0 object-contain" />}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-900/50 bg-ink-950/60 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-red-700/70 text-red-400"><Trophy size={18} /></span>
                    <div><div className="text-sm font-semibold text-white">Total successful events</div><div className="text-[11px] text-slate-400">{stats.events.length} tournaments</div></div>
                  </div>
                  {others.length > 4 && <button className="btn-ghost btn-sm" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : 'View all'}</button>}
                </div>
              </>
            )}
          </section>
        </div>

        {/* ---------- right column ---------- */}
        <div className="min-w-0 space-y-5">
          <section className="card border-red-900/50">
            <SectionTitle>Organization overview</SectionTitle>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {settings.org_about || 'Add a short description of your organization in Admin Panel → Branding & Access.'}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                [Flame, stats.perLineup.length, 'Active lineups'],
                [Trophy, stats.events.length, 'Events'],
                [Users, stats.players, 'Players'],
              ].map(([Ic, val, label]) => (
                <div key={label} className="rounded-lg border border-red-900/50 bg-ink-950/60 p-3 text-center">
                  <Ic size={16} className="mx-auto mb-1 text-red-400" />
                  <div className="font-display text-xl font-extrabold text-white">{num(val)}</div>
                  <div className="text-[10px] text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          </section>

          {dashOpen && (
          <section className="card border-red-900/50">
            <SectionTitle action={stats.perLineup[0] && <Link to={`/lineup/${stats.perLineup[0].l.slug}`} className="text-xs font-semibold text-red-400 hover:text-red-300">View all →</Link>}>Team performance</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Total matches', num(stats.matches)],
                ['Total kills', num(stats.kills)],
                ['Total points', num(stats.points)],
                ['Win rate', `${stats.winRate}%`],
              ].map(([label, val]) => (
                <div key={label} className="rounded-lg border border-red-900/50 bg-ink-950/60 p-3">
                  <div className="text-[11px] text-slate-400">{label}</div>
                  <div className="mt-1 font-display text-2xl font-extrabold text-white">{val}</div>
                </div>
              ))}
            </div>
          </section>
          )}
        </div>
      </div>
    </div>
  )
}

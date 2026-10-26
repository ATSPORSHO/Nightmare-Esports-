import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import ImageField from '../components/ImageField'
import Flag from '../components/Flag'
import { ErrorBox, Spinner } from '../components/ui'
import { rank, totalOf } from '../lib/tournament'
import { placementPoints } from '../lib/points'
import bgGreen from '../assets/report/green.jpg'
import bgBlue from '../assets/report/blue.jpg'
import bgRed from '../assets/report/red.jpg'

const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '')
const fmtTime = (t) => {
  if (!t) return ''
  const [h, m] = String(t).split(':').map(Number)
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/** Your 3 designs. `bg` is the A4 background; the other colours style the white board, like your Grand Final result post. */
const THEMES = [
  { key: 'green', name: 'Green', bg: bgGreen, head: '#0a6b57', block: '#08755c', line: '#12b98c', fill: '#08755c' },
  { key: 'blue', name: 'Blue', bg: bgBlue, head: '#1d4a9a', block: '#0f3f9e', line: '#2d66dc', fill: '#0d3a94' },
  { key: 'red', name: 'Red', bg: bgRed, head: '#8c1111', block: '#a31212', line: '#e23b3b', fill: '#a31212' },
]
const FONT = "'Bebas Neue', Oswald, 'Arial Narrow', Impact, sans-serif"
const two = (n) => String(Number(n) || 0).padStart(2, '0')

/** Roast-chicken ("chicken dinner") icon for the CD column. */
function Chicken({ w = '4.8mm', light }) {
  return (
    <svg viewBox="0 0 64 40" style={{ width: w, height: `calc(${w} / 1.6)`, display: 'block', flexShrink: 0 }} fill={light ? '#fff' : '#111'}>
      <rect x="2" y="34" width="60" height="5" rx="2.5" />
      <path d="M8 33 C6 21 16 13 28 14 C40 15 49 23 49 33 Z" />
      <path d="M44 21 L55 9 a3.2 3.2 0 1 1 4.5 4.5 L48 25 Z" />
      <path d="M13 22 L6 15 a3 3 0 1 0 -4.2 4.2 L10 27 Z" />
    </svg>
  )
}

/** A4 report: one group per page, on your 3 designs. Open from Admin → Tournaments → "A4 report". */
export default function TournamentReport() {
  const { id } = useParams()
  const { data, loading, reload } = useData(async () => {
    const [t, r, g, gt, tm] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).maybeSingle(),
      supabase.from('tournament_rounds').select('*').eq('tournament_id', id).order('sort'),
      supabase.from('tournament_groups').select('*').eq('tournament_id', id).order('sort'),
      supabase.from('tournament_group_teams').select('*').eq('tournament_id', id),
      supabase.from('tournament_teams').select('*').eq('tournament_id', id),
    ])
    const tids = (tm.data || []).map((x) => x.id)
    const pl = tids.length ? await supabase.from('tournament_team_players').select('*').in('team_id', tids).order('sort') : { data: [] }
    const mt = await supabase.from('tournament_matches').select('id, group_id, number, created_at').eq('tournament_id', id)
    const mids = (mt.data || []).map((m) => m.id)
    const ps = mids.length ? await supabase.from('tmatch_player_stats').select('*').in('match_id', mids) : { data: [] }
    const mr = mids.length ? await supabase.from('tournament_match_results').select('match_id, team_id, placement, kills').in('match_id', mids) : { data: [] }
    return { data: { t: t.data, rounds: r.data || [], groups: g.data || [], gts: gt.data || [], teams: tm.data || [], players: pl.data || [], matches: mt.data || [], pstats: ps.data || [], mres: mr.data || [] } }
  }, [id])
  const [themeKey, setThemeKey] = useState(() => { try { return localStorage.getItem('reportTheme2') || 'blue' } catch { return 'blue' } })
  const [rid, setRid] = useState('all')
  const [overall, setOverall] = useState(false)
  const [h2hType, setH2hType] = useState('players') // head to head: 'players' | 'teams'
  const [h2hA, setH2hA] = useState('')
  const [h2hB, setH2hB] = useState('')
  const [view, setView] = useState('group') // results report: 'group' = one page per group, 'overall' = whole round together, 20 teams per page
  const [mode, setMode] = useState('fixture') // 'fixture' = slot list, 'results' = leaderboard
  const [style, setStyle] = useState(() => { try { return localStorage.getItem('reportStyle') || 'list' } catch { return 'list' } }) // 'list' | 'cards'
  const [saveErr, setSaveErr] = useState('')
  const [extra, setExtra] = useState(() => { try { return localStorage.getItem('reportExtra') || '' } catch { return '' } })

  if (loading || !data) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!data.t) return <div className="py-24 text-center text-slate-400">Tournament not found.</div>

  const { t, rounds, groups, gts, teams, players, matches, pstats, mres } = data
  const th = THEMES.find((x) => x.key === themeKey) || THEMES[1]
  const teamById = Object.fromEntries(teams.map((x) => [x.id, x]))
  const roundById = Object.fromEntries(rounds.map((r) => [r.id, r]))
  const pages = groups
    .filter((g) => rid === 'all' || g.round_id === rid)
    .sort((a, b) => (roundById[a.round_id]?.sort || 0) - (roundById[b.round_id]?.sort || 0) || a.sort - b.sort)
  const results = mode === 'results'
  const standings = mode === 'standings'
  const mvp = mode === 'mvp'
  const h2h = mode === 'h2h'
  const land = standings || mvp || h2h
  const cards = !results && style === 'cards'
  // pages of the A4 list/results report: one per group, or (results + overall) the whole round with 20 teams per page
  const sheetPages = (results && view === 'overall')
    ? rounds.filter((r) => rid === 'all' || r.id === rid).flatMap((r) => {
      const all = rank(gts.filter((x) => groups.some((g) => g.round_id === r.id && g.id === x.group_id)))
      const n = Math.max(1, Math.ceil(all.length / 20))
      return Array.from({ length: n }, (_, c) => ({ key: `${r.id}-ov-${c}`, g: { id: `${r.id}-ov-${c}`, name: `${r.name} · Overall${n > 1 ? ` (${c + 1}/${n})` : ''}`, round_id: r.id, qualify: Number(r.qualify_overall) || 0 }, rows: all.slice(c * 20, c * 20 + 20), offset: c * 20 }))
    })
    : pages.map((g) => ({ key: g.id, g, rows: gts.filter((x) => x.group_id === g.id), offset: 0 }))

  const pickTheme = (k) => { setThemeKey(k); try { localStorage.setItem('reportTheme2', k) } catch { /* ignore */ } }
  const saveField = async (col, url) => {
    setSaveErr('')
    const { error } = await supabase.from('tournaments').update({ [col]: url }).eq('id', id)
    if (error) {
      setSaveErr(/sponsor_url/.test(error.message)
        ? 'The sponsor column is missing in the database. Run this once in Supabase → SQL Editor: alter table public.tournaments add column if not exists sponsor_url text; select pg_notify(\'pgrst\',\'reload schema\');'
        : error.message)
      return
    }
    reload()
  }
  const saveLogo = (url) => saveField('logo_url', url)
  const saveSponsor = (url) => saveField('sponsor_url', url)
  const title = String(t.title || '').toUpperCase()
  const standPages = []
  if (standings) {
    const scopes = overall && rid !== 'all'
      ? [{ name: roundById[rid]?.name || 'Overall', rows: pages.flatMap((g) => gts.filter((x) => x.group_id === g.id)) }]
      : pages.map((g) => ({ name: g.name, round: roundById[g.round_id]?.name, rows: gts.filter((x) => x.group_id === g.id) }))
    scopes.forEach((sc) => {
      const ranked = rank(sc.rows)
      // rank change since the match before the latest one (up / down / same)
      const gset = new Set(sc.rows.map((x) => x.group_id))
      const gm = matches.filter((m) => gset.has(m.group_id))
      const lastOf = {}
      gm.forEach((m) => { if (!lastOf[m.group_id] || m.number > lastOf[m.group_id].number) lastOf[m.group_id] = m })
      const lastIds = new Set(Object.values(lastOf).map((m) => m.id))
      const hasPrev = Object.keys(lastOf).some((gid) => gm.filter((m) => m.group_id === gid).length >= 2)
      const delta = {}
      if (hasPrev) {
        const prevRows = sc.rows.map((x) => {
          const r = mres.find((y) => lastIds.has(y.match_id) && y.team_id === x.team_id && y.placement != null)
          if (!r) return x
          return { ...x, place_pts: (Number(x.place_pts) || 0) - placementPoints(r.placement), kill_pts: (Number(x.kill_pts) || 0) - (Number(r.kills) || 0), wwcd: (Number(x.wwcd) || 0) - (r.placement === 1 ? 1 : 0) }
        })
        const before = rank(prevRows).map((x) => x.team_id)
        ranked.forEach((x, i) => { delta[x.team_id] = before.indexOf(x.team_id) - i })
      }
      const played = Math.max(0, ...sc.rows.map((x) => Number(x.mp) || 0))
      const chunks = Math.max(1, Math.ceil(ranked.length / 8))
      for (let c = 0; c < chunks; c++) standPages.push({ key: `${sc.name}-${c}`, sc, ranked, slice: ranked.slice(c * 8, c * 8 + 8), offset: c * 8, played, c, chunks, delta })
    })
  }
  // ---- latest playing squad per team (the players ticked in its newest match)
  const matchById = Object.fromEntries(matches.map((m) => [m.id, m]))
  const lastSquad = (teamId) => {
    const rows = pstats.filter((x) => x.team_id === teamId && matchById[x.match_id])
    if (!rows.length) return []
    const newest = rows.map((x) => matchById[x.match_id]).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.number - a.number)[0]
    const ids = new Set(rows.filter((x) => x.match_id === newest.id).map((x) => x.player_id))
    return players.filter((p) => p.team_id === teamId && ids.has(p.id))
  }
  // ---- MVP list: players ranked by eliminations over the matches of the chosen round(s)
  const groupIds = new Set(pages.map((g) => g.id))
  const kills = {}
  pstats.forEach((x) => { if (groupIds.has(matchById[x.match_id]?.group_id)) { const a = (kills[x.player_id] ||= { k: 0, m: 0 }); a.k += Number(x.kills) || 0; a.m += 1 } })
  const mvpList = players.filter((p) => kills[p.id]).map((p) => ({ p, team: teamById[p.team_id], k: kills[p.id].k, m: kills[p.id].m }))
    .sort((a, b) => b.k - a.k || a.m - b.m || a.p.name.localeCompare(b.p.name))
  const mvpPages = []
  for (let i = 0; i < Math.min(10, mvpList.length); i += 5) mvpPages.push(mvpList.slice(i, i + 5))
  // ---- head to head (teams or players of your choice, over the matches of the chosen round(s))
  const inScope = (matchId) => groupIds.has(matchById[matchId]?.group_id)
  const teamStat = (tid) => {
    const rs = mres.filter((r) => r.team_id === tid && r.placement != null && inScope(r.match_id))
    const pp = rs.reduce((a, r) => a + placementPoints(r.placement), 0)
    const kp = rs.reduce((a, r) => a + (Number(r.kills) || 0), 0)
    const cdExtra = gts.filter((x) => x.team_id === tid && groupIds.has(x.group_id)).reduce((a, x) => a + (Number(x.cd_extra) || 0), 0)
    return { mp: rs.length, pp, kp, tp: pp + kp, cd: rs.filter((r) => r.placement === 1).length + cdExtra, best: rs.length ? Math.min(...rs.map((r) => r.placement)) : null, avg: rs.length ? rs.reduce((a, r) => a + r.placement, 0) / rs.length : null, rs }
  }
  const playerStat = (pid) => {
    const rows = pstats.filter((x) => x.player_id === pid && inScope(x.match_id))
    const k = rows.reduce((a, x) => a + (Number(x.kills) || 0), 0)
    const teamK = rows.reduce((a, x) => a + (Number(mres.find((r) => r.match_id === x.match_id && r.team_id === x.team_id)?.kills) || 0), 0)
    return { m: rows.length, k, best: rows.length ? Math.max(...rows.map((x) => Number(x.kills) || 0)) : 0, avg: rows.length ? k / rows.length : 0, contr: teamK > 0 ? Math.round((k / teamK) * 100) : 0 }
  }
  let h2hSides = null
  if (h2h && h2hA && h2hB && h2hA !== h2hB) {
    if (h2hType === 'teams') {
      const A = teamStat(h2hA), B = teamStat(h2hB)
      let aheadA = 0, aheadB = 0
      A.rs.forEach((ra) => { const rb = B.rs.find((r) => r.match_id === ra.match_id); if (rb) { if (ra.placement < rb.placement) aheadA += 1; else if (rb.placement < ra.placement) aheadB += 1 } })
      h2hSides = {
        a: { kind: 'team', team: teamById[h2hA] }, b: { kind: 'team', team: teamById[h2hB] },
        rows: [
          ['Total pts', A.tp, B.tp], ['Place pts', A.pp, B.pp], ['Elims', A.kp, B.kp], ['Chicken dinners', A.cd, B.cd],
          ['Matches', A.mp, B.mp, true], ['Placed ahead', aheadA, aheadB],
        ],
      }
    } else {
      const A = playerStat(h2hA), B = playerStat(h2hB)
      const pa = players.find((x) => x.id === h2hA), pb = players.find((x) => x.id === h2hB)
      h2hSides = {
        a: { kind: 'player', player: pa, team: teamById[pa?.team_id] }, b: { kind: 'player', player: pb, team: teamById[pb?.team_id] },
        rows: [['Elims', A.k, B.k], ['Matches', A.m, B.m, true], ['Avg elims', A.avg.toFixed(1), B.avg.toFixed(1), false, A.avg - B.avg], ['Best match', A.best, B.best], ['Elim. contr.', `${A.contr}%`, `${B.contr}%`, false, A.contr - B.contr]],
      }
    }
  }
  const mvpSub = [rid === 'all' ? null : roundById[rid]?.name, 'MVP list', 'Most eliminations'].filter(Boolean).join('  ·  ')
  const npages = h2h ? (h2hSides ? 1 : 0) : mvp ? mvpPages.length : standings ? standPages.length : sheetPages.length
  const titlePt = Math.min(48, Math.max(18, 760 / Math.max(title.length, 1)))

  return (
    <div>
      {/* ---------- controls (not printed) ---------- */}
      <div className="no-print mb-4 space-y-3">
        <Link to="/admin?tab=tournaments" className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300"><ArrowLeft size={13} /> Back to tournaments</Link>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="label">Theme</span>
            <div className="flex gap-2">
              {THEMES.map((x) => (
                <button key={x.key} onClick={() => pickTheme(x.key)} className={`flex items-center gap-2 rounded-lg border p-1.5 pr-3 text-xs font-semibold ${themeKey === x.key ? 'border-accent bg-accent/15 text-white' : 'border-ink-600 text-slate-300'}`}>
                  <img src={x.bg} alt="" className="h-10 w-7 rounded object-cover" /> {x.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Print</span>
            <div className="flex overflow-hidden rounded-lg border border-ink-600">
              {[['fixture', 'Fixture (slot list)'], ['results', 'Results'], ['standings', 'Current standings'], ['mvp', 'MVP list'], ['h2h', 'Head to head']].map(([k, l]) => (
                <button key={k} onClick={() => setMode(k)} className={`px-4 py-2 text-xs font-semibold ${mode === k ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-700'}`}>{l}</button>
              ))}
            </div>
          </div>
          {standings && rid !== 'all' && (
            <label className="flex items-center gap-2 pb-2 text-xs text-slate-300">
              <input type="checkbox" checked={overall} onChange={(e) => setOverall(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" /> Combine all groups of the round (overall standings)
            </label>
          )}
          {!results && !land && (
            <div>
              <span className="label">Slot list style</span>
              <div className="flex overflow-hidden rounded-lg border border-ink-600">
                {[['list', 'List'], ['cards', 'Logo cards']].map(([k, l]) => (
                  <button key={k} onClick={() => { setStyle(k); try { localStorage.setItem('reportStyle', k) } catch { /* ignore */ } }} className={`px-4 py-2 text-xs font-semibold ${style === k ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-700'}`}>{l}</button>
                ))}
              </div>
            </div>
          )}
          {h2h && (
            <>
              <div>
                <span className="label">Compare</span>
                <div className="flex overflow-hidden rounded-lg border border-ink-600">
                  {[['players', 'Players'], ['teams', 'Teams']].map(([k, l]) => (
                    <button key={k} onClick={() => { setH2hType(k); setH2hA(''); setH2hB('') }} className={`px-4 py-2 text-xs font-semibold ${h2hType === k ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-700'}`}>{l}</button>
                  ))}
                </div>
              </div>
              {[['Left side', h2hA, setH2hA], ['Right side', h2hB, setH2hB]].map(([lab, val, set]) => (
                <label key={lab}>
                  <span className="label">{lab}</span>
                  <select className="input" value={val} onChange={(e) => set(e.target.value)}>
                    <option value="">— choose —</option>
                    {h2hType === 'teams'
                      ? [...teams].sort((a, b) => a.name.localeCompare(b.name)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)
                      : [...players].sort((a, b) => (teamById[a.team_id]?.name || '').localeCompare(teamById[b.team_id]?.name || '') || a.name.localeCompare(b.name)).map((x) => <option key={x.id} value={x.id}>{x.name} ({teamById[x.team_id]?.tag || teamById[x.team_id]?.name})</option>)}
                  </select>
                </label>
              ))}
            </>
          )}
          {results && (
            <div>
              <span className="label">Results page</span>
              <div className="flex overflow-hidden rounded-lg border border-ink-600">
                {[['group', 'Per group'], ['overall', 'Overall (20 per page)']].map(([k, l]) => (
                  <button key={k} onClick={() => setView(k)} className={`px-4 py-2 text-xs font-semibold ${view === k ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-700'}`}>{l}</button>
                ))}
              </div>
            </div>
          )}
          <label>
            <span className="label">Extra line (optional)</span>
            <input className="input" placeholder="Back to back 5 matches" value={extra} onChange={(e) => { setExtra(e.target.value); try { localStorage.setItem('reportExtra', e.target.value) } catch { /* ignore */ } }} />
          </label>
          <label>
            <span className="label">Round</span>
            <select className="input" value={rid} onChange={(e) => setRid(e.target.value)}>
              <option value="all">All rounds</option>
              {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF ({npages} page{npages === 1 ? '' : 's'})</button>
        </div>
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <ImageField label="Tournament logo (top right corner)" folder="tournament" value={t.logo_url} onChange={saveLogo} hint="PNG with a transparent background looks best." />
          <ImageField label="Sponsor image (placed above “Sponsored by”)" folder="sponsor" value={t.sponsor_url} onChange={saveSponsor} hint="PNG with a transparent background looks best." />
        </div>
        <ErrorBox>{saveErr}</ErrorBox>
        <p className="text-xs text-slate-500">Fixture = slot list before the match, Results = leaderboard after it (teams that qualified are filled in). One group per A4 page. In the print window choose A4, Portrait, margins None, and tick “Background graphics”.</p>
      </div>

      {/* ---------- A4 pages ---------- */}
      {h2h && (
        <div className="a4l-area overflow-x-auto">
          {!h2hSides && <div className="card py-10 text-center text-sm text-slate-400">Choose two different {h2hType} above to build the head-to-head page.</div>}
          {h2hSides && <H2HPage sides={h2hSides} sub={[rid === 'all' ? null : roundById[rid]?.name, 'Head to head', h2hType === 'teams' ? 'Tournament record so far' : 'Player record so far'].filter(Boolean).join('  ·  ')} th={th} t={t} />}
        </div>
      )}
      {mvp && (
        <div className="a4l-area overflow-x-auto">
          {!mvpPages.length && <div className="card py-10 text-center text-sm text-slate-400">No player eliminations yet. In Tournaments → Results tick the players who played and type their eliminations (run supabase/match-players.sql once).</div>}
          {mvpPages.map((list, i) => (
            <MvpPage key={i} list={list} offset={i * 5} page={i} pages={mvpPages.length} sub={mvpSub} th={th} t={t} />
          ))}
        </div>
      )}
      {standings && (
        <div className="a4l-area overflow-x-auto">
          {!standPages.length && <div className="card py-10 text-center text-sm text-slate-400">No groups yet. Draw the groups first.</div>}
          {standPages.map((sp) => (
            <StandingsPage key={sp.key} sp={sp} th={th} t={t} teamById={teamById} players={players} lastSquad={lastSquad} />
          ))}
        </div>
      )}
      <div className={`a4-area overflow-x-auto ${land ? 'hidden' : ''}`}>
        {!sheetPages.length && <div className="card py-10 text-center text-sm text-slate-400">No groups yet. Draw the groups first.</div>}
        {sheetPages.map((sp0) => {
          const g = sp0.g
          const round = roundById[g.round_id]
          const rows = sp0.rows
          const off = sp0.offset
          const list = results ? (view === 'overall' ? rows : rank(rows)) : [...rows].sort((a, b) => (a.slot || 0) - (b.slot || 0))
          const nRows = Math.max(1, results ? Math.max(Math.min(10, list.length), Math.ceil(list.length / 2)) : Math.ceil(list.length / 2)) // results: 10 on the left, rest on the right, like the Grand Final post
          const GAP = nRows > 10 ? 1.4 : 2.2 // mm between rows
          const h = Math.min(20, ((results ? 138 : 127) - GAP * (nRows - 1)) / nRows) // box height, mm: rows stretch so the board fills the page
          const fs = Math.min(13, h * 0.9) // pt
          const halves = [list.slice(0, nRows), list.slice(nRows)]
          const info = fmtDate(g.match_date)
          const timeTxt = g.match_time ? `${fmtTime(g.match_time)}${g.match_note ? ` (${g.match_note.toUpperCase()})` : ''}` : ''
          const nCols = list.length <= 9 ? 3 : list.length <= 16 ? 4 : 5
          const nCardRows = Math.max(1, Math.ceil(list.length / nCols))
          const cardH = Math.min(42, (140 - 3 * (nCardRows - 1)) / nCardRows)
          const BLK = 12 // rank block width, mm
          const inner = results ? '1fr 8mm 8mm 11mm 9mm' : '1fr'
          const cell = { textAlign: 'center' }
          return (
            <section
              key={g.id}
              className="a4-page relative mx-auto mb-6 overflow-hidden shadow-xl"
              style={{ width: '210mm', height: '297mm', backgroundImage: `url(${th.bg})`, backgroundSize: '100% 100%', color: '#fff', fontFamily: FONT, fontWeight: 400 }}
            >
              {/* tournament logo, top right corner */}
              {t.logo_url && (
                <img src={t.logo_url} alt="" style={{ position: 'absolute', right: '3.5%', top: '1.6%', width: '14%', height: '9.6%', objectFit: 'contain', objectPosition: 'right top' }} />
              )}

              {/* tournament name (replaces the "TOURNAMENT NAME" placeholder) */}
              <div style={{ position: 'absolute', left: '14%', right: '14%', top: '12.4%', height: '6.6%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'nowrap', fontSize: `${titlePt}pt`, lineHeight: 1, letterSpacing: '.02em', textShadow: '0 1px 4px rgba(0,0,0,.35)' }}>
                {title}
              </div>

              {/* group name, in the bar */}
              <div style={{ position: 'absolute', left: '29.7%', width: '42%', top: '19%', height: '4.3%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24pt', letterSpacing: '.06em', textTransform: 'uppercase', textShadow: '0 1px 3px rgba(0,0,0,.45)' }}>
                {g.name}
              </div>

              {/* white board, like the Grand Final result post */}
              <div style={{ position: 'absolute', left: '5%', right: '5%', top: '25.8%' }}>
                <div style={{ background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,.35)' }}>
                  {cards ? (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${nCols}, 1fr)`, gridAutoRows: `${cardH}mm`, gap: '3mm', padding: '4mm' }}>
                      {list.map((x) => {
                        const tm = teamById[x.team_id]
                        return (
                          <div key={x.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', border: `0.5mm solid ${th.line}`, background: '#fff', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, minWidth: '8.5mm', height: '8.5mm', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.block, color: '#fff', fontSize: '13pt' }}>{x.slot}</div>
                            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                              {tm?.logo_url
                                ? <img src={tm.logo_url} alt="" style={{ position: 'absolute', inset: '2.5mm 4mm 1.5mm', width: 'calc(100% - 8mm)', height: 'calc(100% - 4mm)', objectFit: 'contain' }} />
                                : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.line, opacity: 0.35, fontSize: '30pt' }}>{String(tm?.name || '?').slice(0, 2)}</div>}
                            </div>
                            <div style={{ height: '8mm', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2mm', background: th.head, color: '#fff', fontSize: '10.5pt', letterSpacing: '.03em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><Flag code={tm?.country} h="4mm" style={{ marginRight: '1.5mm' }} />{tm?.name}</div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (<>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '4mm', padding: '0 4mm', height: '11mm', alignItems: 'center', background: th.head, fontSize: '14pt', letterSpacing: '.03em' }}>
                    {[0, 1].map((k) => (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: `${BLK}mm 1fr`, columnGap: '1.5mm', alignItems: 'center' }}>
                        <span style={{ textAlign: 'center' }}>{results ? 'RANK' : 'SLOT'}</span>
                        <div style={{ display: 'grid', gridTemplateColumns: inner, padding: '0 2mm' }}>
                          <span>TEAM</span>
                          {results && ['PP', 'KP', 'CD', 'TP'].map((c) => <span key={c} style={cell}>{c}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '4mm', padding: '4mm', alignItems: 'start' }}>
                    {halves.map((half, k) => (
                      <div key={k} style={{ display: 'grid', rowGap: `${GAP}mm` }}>
                        {half.map((x, j) => {
                          const i = k * nRows + j
                          const tm = teamById[x.team_id]
                          const q = results && (x.qualified || (g.qualify > 0 && off + i < g.qualify))
                          const wwcd = Number(x.wwcd) || 0
                          return (
                            <div key={x.id} style={{ display: 'grid', gridTemplateColumns: `${BLK}mm 1fr`, columnGap: '1.5mm', height: `${h}mm` }}>
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.block, color: '#fff', fontSize: `${fs * 1.5}pt` }}>
                                {results ? off + i + 1 : x.slot}
                                <i style={{ position: 'absolute', left: 0, bottom: 0, width: '2mm', height: '2mm', background: '#fff', clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: inner, alignItems: 'center', padding: '0 2mm', border: `0.4mm solid ${th.line}`, background: q ? th.fill : '#fff', color: q ? '#fff' : '#0b0b0b', fontSize: `${fs}pt`, letterSpacing: '.02em', textTransform: 'uppercase' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '2mm', minWidth: 0 }}>
                                  {tm?.logo_url && <img src={tm.logo_url} alt="" style={{ height: `${Math.min(h - 2, 9)}mm`, width: `${Math.min(h - 2, results ? 7 : 9)}mm`, objectFit: 'contain', flexShrink: 0 }} />}
                                  <Flag code={tm?.country} h={`${Math.min(h - 3, 5)}mm`} />
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tm?.name}</span>
                                </span>
                                {results && (
                                  <>
                                    <span style={cell}>{two(x.place_pts)}</span>
                                    <span style={cell}>{two(x.kill_pts)}</span>
                                    <span style={{ ...cell, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6mm', filter: q ? 'invert(1)' : 'none' }}>
                                      {wwcd > 0 && wwcd <= 2 && Array.from({ length: wwcd }, (_, n) => <Chicken key={n} />)}
                                      {wwcd > 2 && <><Chicken /><span style={{ fontSize: `${fs * 0.8}pt` }}>x{wwcd}</span></>}
                                    </span>
                                    <span style={cell}>{two(totalOf(x))}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  </>)}
                </div>

                {results && g.qualify > 0 && (
                  <div style={{ marginTop: '6mm', textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.1, textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                    {g.qualify > 0 && <div style={{ fontSize: '20pt', letterSpacing: '.12em' }}>Top {g.qualify} teams qualify</div>}
                  </div>
                )}
                {!results && (timeTxt || extra.trim() || info || g.qualify > 0) && (
                  <div style={{ marginTop: '6mm', textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                    {timeTxt && <div style={{ fontSize: '22pt', letterSpacing: '.1em', textTransform: 'uppercase', lineHeight: 1.1 }}>Match time : {timeTxt}</div>}
                    {extra.trim() && <div style={{ marginTop: '1mm', fontSize: '16pt', letterSpacing: '.12em', textTransform: 'uppercase', lineHeight: 1.1 }}>{extra}</div>}
                    {info && <div style={{ marginTop: '2mm', fontSize: '12pt', letterSpacing: '.14em', textTransform: 'uppercase', lineHeight: 1.1, opacity: 0.9 }}>Match date : {info}</div>}
                    {g.qualify > 0 && <div style={{ marginTop: '1mm', fontSize: '12pt', letterSpacing: '.14em', textTransform: 'uppercase', lineHeight: 1.1, opacity: 0.9 }}>Top {g.qualify} teams will qualify</div>}
                  </div>
                )}
              </div>

              {/* sponsor image, sits on the line above "SPONSORED BY" */}
              <div style={{ position: 'absolute', left: '47.5%', width: '16.8%', bottom: '5.9%', height: '6.4%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                {t.sponsor_url
                  ? <img src={t.sponsor_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <div className="no-print" style={{ width: '100%', textAlign: 'center', border: '1px dashed rgba(255,255,255,.5)', fontSize: '7pt', padding: '2mm 0', opacity: 0.8 }}>Sponsor image</div>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** Current standings, broadcast style: leader photo on the left, 8 teams per page on the right (A4 landscape). */
function StandingsPage({ sp, th, t, teamById, players, lastSquad }) {
  const { ranked, slice, offset, played, c, chunks, sc, delta } = sp
  const leader = teamById[ranked[0]?.team_id]
  // squad order: 6 players -> 6,3,1,2,4,5 ; 5 players -> 4,3,1,2,5 ; fewer -> simple order
  const playing = leader ? lastSquad(leader.id) : []   // the players ticked in the team's latest match
  const all = leader ? (playing.length ? playing : players.filter((p) => p.team_id === leader.id)).slice(0, 6) : []
  const withPhoto = all.filter((p) => p.photo_url)
  const base = withPhoto.length ? withPhoto : []
  const ORD = { 6: [6, 3, 1, 2, 4, 5], 5: [4, 3, 1, 2, 5], 4: [3, 1, 2, 4], 3: [3, 1, 2], 2: [1, 2], 1: [1] }
  const squad = (ORD[base.length] || []).map((n) => base[n - 1]).filter(Boolean)
  const mid = (squad.length - 1) / 2
  const sub = [sc.round, sc.name, 'Current standings', played > 0 ? `${played} match${played === 1 ? '' : 'es'} played` : null].filter(Boolean).join('  ·  ')
  const cols = '6mm 13mm 1fr 14mm 22mm 18mm 24mm'
  const num = { textAlign: 'center' }
  return (
    <section
      className="a4-page relative mx-auto mb-6 overflow-hidden shadow-xl"
      style={{ width: '297mm', height: '210mm', backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.82) 0, rgba(0,0,0,.7) 34mm, rgba(0,0,0,.3) 50mm, rgba(0,0,0,.5) 100%), url(${th.bg})`, backgroundSize: 'cover', backgroundPosition: 'center', color: '#fff', fontFamily: FONT, fontWeight: 400 }}
    >
      {/* left: #1 team photo */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '46%', overflow: 'hidden' }}>
        {squad.length === 0 && leader?.photo_url
          ? <img src={leader.photo_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
          : squad.length > 0
            ? (
              <div style={{ position: 'absolute', left: '4mm', right: '4mm', bottom: '26mm', top: '40mm', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2mm' }}>
                {squad.map((p, i) => (
                  <div key={p.id} style={{ flex: 1, height: `${100 - Math.abs(i - mid) * 11}%`, maxWidth: '34mm', overflow: 'hidden', borderRadius: '2mm 2mm 0 0', background: 'rgba(0,0,0,.35)' }}>
                    {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} /> : <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '28pt', opacity: 0.4 }}>{p.name.slice(0, 1)}</div>}
                  </div>
                ))}
              </div>
            )
            : leader?.logo_url && <img src={leader.logo_url} alt="" style={{ position: 'absolute', left: '15%', top: '22%', width: '70%', height: '50%', objectFit: 'contain' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'transparent' }} />
        {t.logo_url && <img src={t.logo_url} alt="" style={{ position: 'absolute', left: '8mm', top: '7mm', height: '20mm', maxWidth: '40mm', objectFit: 'contain', objectPosition: 'left top' }} />}
        {leader && (
          <div style={{ position: 'absolute', left: '8mm', bottom: '8mm', display: 'flex', alignItems: 'center', gap: '4mm' }}>
            <span style={{ background: th.block, color: '#fff', fontSize: '30pt', lineHeight: 1, padding: '2.5mm 5mm', border: `0.6mm solid ${th.line}` }}>#1</span>
            {leader.logo_url && <img src={leader.logo_url} alt="" style={{ height: '16mm', width: '16mm', objectFit: 'contain' }} />}
            <span style={{ fontSize: '20pt', letterSpacing: '.04em', textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>{leader.name}</span>
          </div>
        )}
      </div>

      {/* right: title + table */}
      <div style={{ position: 'absolute', left: '48%', right: '4%', top: '8mm' }}>
        <div style={{ fontSize: '24pt', lineHeight: 1, letterSpacing: '.03em', textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>{t.title}</div>
        <div style={{ marginTop: '1.5mm', fontSize: '11pt', letterSpacing: '.14em', textTransform: 'uppercase', color: th.line, filter: 'brightness(1.5)' }}>{sub}</div>
        <div style={{ marginTop: '5mm', background: 'rgba(0,0,0,.35)', borderTop: `0.6mm solid ${th.line}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', height: '9mm', padding: '0 3mm', fontSize: '11pt', letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.9 }}>
            <span /><span>Rank</span><span>Team</span>
            <span style={{ ...num, display: 'flex', justifyContent: 'center' }}><Chicken w="5mm" light /></span>
            <span style={num}>Place pts</span><span style={num}>Elims</span><span style={num}>Total pts</span>
          </div>
          {slice.map((x, i) => {
            const tm = teamById[x.team_id]
            const n = offset + i + 1
            return (
              <div key={x.id} style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', height: '17mm', padding: '0 3mm', borderTop: '0.3mm solid rgba(255,255,255,.18)', background: n === 1 ? `${th.line}33` : i % 2 ? 'rgba(0,0,0,.18)' : 'transparent', fontSize: '15pt' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  {(delta?.[x.team_id] || 0) !== 0 && (
                    <svg viewBox="0 0 10 8" style={{ width: '3.6mm', height: '3mm' }}><path d={delta[x.team_id] > 0 ? 'M5 0 L10 8 L0 8 Z' : 'M0 0 L10 0 L5 8 Z'} fill={delta[x.team_id] > 0 ? '#22c55e' : '#ef4444'} /></svg>
                  )}
                </span>
                <span style={{ fontSize: '17pt' }}>#{n}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3mm', minWidth: 0 }}>
                  {tm?.logo_url ? <img src={tm.logo_url} alt="" style={{ height: '12mm', width: '12mm', objectFit: 'contain', flexShrink: 0 }} /> : <span style={{ width: '12mm', flexShrink: 0 }} />}
                  <Flag code={tm?.country} h="6mm" />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase', letterSpacing: '.03em' }}>{tm?.tag || tm?.name}</span>
                </span>
                <span style={num}>{Number(x.wwcd) || 0}</span>
                <span style={num}>{Number(x.place_pts) || 0}</span>
                <span style={num}>{Number(x.kill_pts) || 0}</span>
                <span style={{ ...num, fontSize: '18pt' }}>{totalOf(x)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* footer: sponsor + page */}
      <div style={{ position: 'absolute', left: '48%', right: '4%', bottom: '6mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9pt', letterSpacing: '.15em', textTransform: 'uppercase', opacity: 0.9 }}>
        <span>{chunks > 1 ? `Page ${c + 1} / ${chunks}` : ''}</span>
        {t.sponsor_url && <span style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>Sponsored by <img src={t.sponsor_url} alt="" style={{ height: '11mm', maxWidth: '35mm', objectFit: 'contain' }} /></span>}
      </div>
    </section>
  )
}

/** MVP list: top players by eliminations (5 per landscape page): photo, name, team, elims. */
function MvpPage({ list, offset, page, pages, sub, th, t }) {
  const n = list.length
  return (
    <section
      className="a4-page relative mx-auto mb-6 overflow-hidden shadow-xl"
      style={{ width: '297mm', height: '210mm', backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.82) 0, rgba(0,0,0,.7) 34mm, rgba(0,0,0,.3) 50mm, rgba(0,0,0,.5) 100%), url(${th.bg})`, backgroundSize: 'cover', backgroundPosition: 'center', color: '#fff', fontFamily: FONT, fontWeight: 400 }}
    >
      {t.logo_url && <img src={t.logo_url} alt="" style={{ position: 'absolute', right: '10mm', top: '8mm', height: '22mm', maxWidth: '40mm', objectFit: 'contain', objectPosition: 'right top' }} />}
      <div style={{ position: 'absolute', left: '12mm', right: '55mm', top: '10mm', textAlign: 'left' }}>
        <div style={{ fontSize: '32pt', lineHeight: 1, letterSpacing: '.06em', textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>{t.title}</div>
        <div style={{ marginTop: '2mm', fontSize: '13pt', letterSpacing: '.2em', textTransform: 'uppercase', color: th.line, filter: 'brightness(1.6)' }}>{sub}</div>
      </div>
      <div style={{ position: 'absolute', left: '12mm', right: '12mm', top: '38mm', bottom: '22mm', display: 'flex', justifyContent: 'center', gap: '5mm' }}>
        {list.map((x, i) => (
          <div key={x.p.id} style={{ width: '50mm', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,.55)', border: `0.5mm solid ${th.line}`, overflow: 'hidden' }}>
            <div style={{ position: 'relative', flex: 1, minHeight: 0, background: `linear-gradient(180deg, ${th.block}, rgba(0,0,0,.6))` }}>
              {x.p.photo_url
                ? <img src={x.p.photo_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '60pt', opacity: 0.35 }}>{x.p.name.slice(0, 1)}</div>}
              <span style={{ position: 'absolute', left: '2.5mm', top: '2mm', fontSize: '20pt', lineHeight: 1, textShadow: '0 1px 4px rgba(0,0,0,.7)' }}>#{offset + i + 1}</span>
              {x.team?.logo_url && <img src={x.team.logo_url} alt="" style={{ position: 'absolute', right: '2mm', top: '2mm', height: '13mm', width: '13mm', objectFit: 'contain' }} />}
            </div>
            <div style={{ background: th.block, borderTop: `0.4mm solid ${th.line}`, borderBottom: `0.4mm solid ${th.line}`, textAlign: 'center', padding: '1.6mm 1mm', fontSize: '17pt', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.p.name}</div>
            <div style={{ padding: '3mm 2mm 3.5mm', textAlign: 'center' }}>
              <div style={{ fontSize: '11pt', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.team?.tag || x.team?.name}</div>
              <div style={{ marginTop: '2mm', fontSize: '10pt', letterSpacing: '.2em', opacity: 0.75 }}>ELIMS</div>
              <div style={{ fontSize: '40pt', lineHeight: 1 }}>{x.k}</div>
            </div>
          </div>
        ))}
        {n === 0 && null}
      </div>
      <div style={{ position: 'absolute', left: '12mm', right: '12mm', bottom: '6mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9pt', letterSpacing: '.15em', textTransform: 'uppercase', opacity: 0.9 }}>
        <span>{pages > 1 ? `Page ${page + 1} / ${pages}` : ''}</span>
        {t.sponsor_url && <span style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>Sponsored by <img src={t.sponsor_url} alt="" style={{ height: '11mm', maxWidth: '35mm', objectFit: 'contain' }} /></span>}
      </div>
    </section>
  )
}

/** Head to head: two players (photo) or two teams (logo only), stats in the middle, the better value is highlighted. */
function H2HPage({ sides, sub, th, t }) {
  const { a, b, rows } = sides
  const side = (x, right) => {
    const isTeam = x.kind === 'team'
    const logo = isTeam ? x.team?.logo_url : x.team?.logo_url
    return (
      <div style={{ position: 'absolute', top: '40mm', bottom: '22mm', [right ? 'right' : 'left']: '10mm', width: '86mm', overflow: 'hidden', background: 'rgba(0,0,0,.35)', borderTop: `0.6mm solid ${th.line}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {isTeam
            ? (logo ? <img src={logo} alt="" style={{ position: 'absolute', inset: '8mm', width: 'calc(100% - 16mm)', height: 'calc(100% - 16mm)', objectFit: 'contain', filter: 'drop-shadow(0 2mm 3mm rgba(0,0,0,.5))' }} /> : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '70pt', opacity: 0.35 }}>{String(x.team?.name || '?').slice(0, 2)}</div>)
            : (x.player?.photo_url ? <img src={x.player.photo_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} /> : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80pt', opacity: 0.35 }}>{String(x.player?.name || '?').slice(0, 1)}</div>)}
          {!isTeam && logo && <img src={logo} alt="" style={{ position: 'absolute', [right ? 'left' : 'right']: '3mm', top: '3mm', height: '16mm', width: '16mm', objectFit: 'contain' }} />}
        </div>
        <div style={{ background: 'rgba(0,0,0,.45)', borderTop: '0.3mm solid rgba(255,255,255,.18)', padding: '2mm 4mm', textAlign: right ? 'left' : 'right' }}>
          <div style={{ fontSize: '22pt', lineHeight: 1.05, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '2mm', justifyContent: right ? 'flex-start' : 'flex-end' }}>
            {isTeam && <Flag code={x.team?.country} h="5mm" />}{isTeam ? x.team?.name : x.player?.name}
          </div>
          {!isTeam && <div style={{ fontSize: '11pt', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.85 }}>{x.team?.name}</div>}
        </div>
      </div>
    )
  }
  const better = (va, vb, lowerBetter, diff) => {
    // diff > 0 means the left side is better (given for rows where a plain number compare is not enough)
    if (diff != null && diff !== 0) return diff > 0 ? 'a' : 'b'
    const na = Number(String(va).replace('%', '')), nb = Number(String(vb).replace('%', ''))
    if (!Number.isFinite(na) || !Number.isFinite(nb) || na === nb || diff === 0) return null
    return (na > nb) !== !!lowerBetter ? 'a' : 'b'
  }
  return (
    <section
      className="a4-page relative mx-auto mb-6 overflow-hidden shadow-xl"
      style={{ width: '297mm', height: '210mm', backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.82) 0, rgba(0,0,0,.7) 34mm, rgba(0,0,0,.3) 50mm, rgba(0,0,0,.5) 100%), url(${th.bg})`, backgroundSize: 'cover', backgroundPosition: 'center', color: '#fff', fontFamily: FONT, fontWeight: 400 }}
    >
      {t.logo_url && <img src={t.logo_url} alt="" style={{ position: 'absolute', right: '10mm', top: '8mm', height: '22mm', maxWidth: '40mm', objectFit: 'contain', objectPosition: 'right top' }} />}
      <div style={{ position: 'absolute', left: '12mm', right: '55mm', top: '10mm' }}>
        <div style={{ fontSize: '30pt', lineHeight: 1, letterSpacing: '.06em', textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>{t.title}</div>
        <div style={{ marginTop: '2mm', fontSize: '13pt', letterSpacing: '.2em', textTransform: 'uppercase', color: th.line, filter: 'brightness(1.6)' }}>{sub}</div>
      </div>
      {side(a, false)}
      {side(b, true)}
      <div style={{ position: 'absolute', left: '100mm', right: '100mm', top: '40mm', bottom: '22mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
        {rows.map(([label, va, vb, lowerBetter, diff]) => {
          const w = better(va, vb, lowerBetter, diff)
          const col = (win) => ({ fontSize: '34pt', lineHeight: 1, color: win ? '#fff' : 'rgba(255,255,255,.7)', textShadow: win ? `0 0 14px ${th.line}` : 'none' })
          return (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 34mm 1fr', alignItems: 'center', columnGap: '2mm' }}>
              <div style={{ textAlign: 'right', ...col(w === 'a'), paddingRight: '3mm', borderRight: w === 'a' ? `1.2mm solid ${th.line}` : '1.2mm solid transparent' }}>{va}</div>
              <div style={{ textAlign: 'center', fontSize: '11pt', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.9 }}>{label}</div>
              <div style={{ textAlign: 'left', ...col(w === 'b'), paddingLeft: '3mm', borderLeft: w === 'b' ? `1.2mm solid ${th.line}` : '1.2mm solid transparent' }}>{vb}</div>
            </div>
          )
        })}
      </div>
      {t.sponsor_url && <div style={{ position: 'absolute', right: '10mm', bottom: '6mm', display: 'flex', alignItems: 'center', gap: '3mm', fontSize: '9pt', letterSpacing: '.15em', textTransform: 'uppercase', opacity: 0.9 }}>Sponsored by <img src={t.sponsor_url} alt="" style={{ height: '11mm', maxWidth: '35mm', objectFit: 'contain' }} /></div>}
    </section>
  )
}

import { useEffect, useState } from 'react'
import { LIVE_THEMES, computeRows, mvpList, playerTotal } from '../lib/live'
import Flag from './Flag'
import bgGreen from '../assets/report/green.jpg'
import bgBlue from '../assets/report/blue.jpg'
import bgRed from '../assets/report/red.jpg'

export const FONT = "'Bebas Neue','Oswald','Arial Narrow',Impact,sans-serif"
export const stageBg = (th) => `radial-gradient(ellipse at 50% 15%, ${th.block} 0%, #070b16 60%, #04060d 100%)`

function Logo({ r, size, th, ring = true }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: '#fff', border: ring ? `${Math.max(2, size / 28)}px solid ${th.line}` : 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      {r.logo ? <img src={r.logo} alt="" style={{ width: '86%', height: '86%', objectFit: 'contain' }} /> : <span style={{ color: '#111', fontSize: size / 3 }}>{String(r.tag || r.name || '').slice(0, 2)}</span>}
    </span>
  )
}
const Title = ({ children, th, sub }) => (
  <div style={{ textAlign: 'center', paddingTop: 46 }}>
    <div style={{ fontSize: 76, letterSpacing: '.14em', textTransform: 'uppercase', lineHeight: 1 }}>{children}</div>
    {sub && <div style={{ fontSize: 28, letterSpacing: '.3em', color: th.line, marginTop: 6, textTransform: 'uppercase' }}>{sub}</div>}
    <div style={{ width: 220, height: 5, background: th.line, margin: '14px auto 0', borderRadius: 3 }} />
  </div>
)
const subOf = (info) => [info?.tournament, info?.match && `Match ${info.match}`, info?.map].filter(Boolean).join('  ·  ')

/** Ticking countdown to the match start. */
function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t) }, [])
  return now
}

/** 1. Starting soon — with a countdown to the match start time */
export function StartingScene({ info = {}, theme }) {
  const th = LIVE_THEMES[theme] || LIVE_THEMES.blue
  const now = useNow()
  const target = info.startAt ? new Date(info.startAt).getTime() : null
  const left = target ? Math.max(0, Math.ceil((target - now) / 1000)) : null
  const d = left != null ? Math.floor(left / 86400) : 0
  const parts = left == null ? [] : [...(d > 0 ? [['DAYS', d]] : []), ['HOURS', Math.floor((left % 86400) / 3600)], ['MINUTES', Math.floor((left % 3600) / 60)], ['SECONDS', left % 60]]
  const startTxt = target ? new Date(target).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: FONT, color: '#fff' }}>
      <style>{`@keyframes lsDot{0%,80%,100%{opacity:.2;transform:scale(.7)}40%{opacity:1;transform:scale(1.2)}}@keyframes lsBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}`}</style>
      {info.logo && <img src={info.logo} alt="" style={{ height: 230, maxWidth: 460, objectFit: 'contain', animation: 'lsBreath 3.2s ease-in-out infinite' }} />}
      <div style={{ fontSize: 84, letterSpacing: '.1em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1 }}>{info.tournament || 'Tournament'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, background: th.line, borderRadius: 8, padding: '4px 40px', fontSize: 60, letterSpacing: '.22em' }}>
        {left === 0 ? 'STARTING NOW' : 'STARTING SOON'}
        <span style={{ display: 'inline-flex', gap: 8 }}>{[0, 1, 2].map((i) => <i key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', animation: `lsDot 1.4s ${i * 0.2}s infinite` }} />)}</span>
      </div>
      {left != null && left > 0 && (
        <>
          <div style={{ fontSize: 28, letterSpacing: '.35em', color: '#cfd6ea' }}>MATCH STARTS IN</div>
          <div style={{ display: 'flex', gap: 18 }}>
            {parts.map(([l, v]) => (
              <div key={l} style={{ width: 190, textAlign: 'center', background: 'rgba(5,8,18,.78)', border: `2px solid ${th.line}`, borderRadius: 10, padding: '10px 0 8px' }}>
                <div style={{ fontSize: 110, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{String(v).padStart(2, '0')}</div>
                <div style={{ fontSize: 20, letterSpacing: '.3em', color: th.line, filter: 'brightness(1.5)' }}>{l}</div>
              </div>
            ))}
          </div>
          {startTxt && <div style={{ fontSize: 26, letterSpacing: '.25em', color: '#aab' }}>STARTS AT {startTxt}</div>}
        </>
      )}
      {(info.match || info.map) && <div style={{ fontSize: 32, letterSpacing: '.3em', color: '#cfd6ea' }}>{[info.match && `MATCH ${info.match}`, info.map].filter(Boolean).join('  ·  ').toUpperCase()}</div>}
    </div>
  )
}

/** 2. Participating teams */
export function TeamsScene({ teams = [], info = {}, theme }) {
  const th = LIVE_THEMES[theme] || LIVE_THEMES.blue
  const n = teams.length || 1
  const cols = n <= 8 ? 4 : n <= 15 ? 5 : n <= 24 ? 6 : 7
  const rowsN = Math.ceil(n / cols)
  const size = Math.min(170, Math.floor(640 / rowsN) - 52)
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: FONT, color: '#fff' }}>
      <Title th={th} sub={subOf(info)}>Participating teams</Title>
      <div style={{ position: 'absolute', left: 90, right: 90, top: 230, bottom: 50, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: '1fr', gap: 14 }}>
        {teams.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(5,8,18,.7)', border: `1px solid ${th.line}55`, borderRadius: 10, padding: 8, animation: `lsTeamIn .6s ${Math.min(i * 0.05, 1.2)}s both` }}>
            <Logo r={t} size={size} th={th} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
              <Flag code={t.country} h="16px" />
              <span style={{ fontSize: n > 16 ? 22 : 28, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes lsTeamIn{from{opacity:0;transform:translateY(24px) scale(.92)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}

// ---------- A4-report look (same backgrounds, colours, fonts and layouts as the printed report) ----------
const BG = { green: bgGreen, blue: bgBlue, red: bgRed }
const themeOf = (k) => ({ ...(LIVE_THEMES[k] || LIVE_THEMES.blue), bg: BG[k] || bgBlue })
const A4_PX_H = 210 * 3.7795275591
const SCALE = 1080 / A4_PX_H
const A4_LEFT = (1920 - 297 * 3.7795275591 * SCALE) / 2

/** Full-screen report background, with the A4 landscape page centred and scaled to the screen height. */
function A4Frame({ th, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.82) 0, rgba(0,0,0,.7) 12%, rgba(0,0,0,.3) 20%, rgba(0,0,0,.5) 100%), url(${th.bg})`, backgroundSize: 'cover', backgroundPosition: 'center', fontFamily: FONT, fontWeight: 400, color: '#fff' }}>
      <div style={{ position: 'absolute', left: A4_LEFT, top: 0, width: '297mm', height: '210mm', transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}

function Chicken({ w = '4.8mm' }) {
  return (
    <svg viewBox="0 0 64 40" style={{ width: w, height: `calc(${w} / 1.6)`, display: 'block', flexShrink: 0 }} fill="#fff">
      <rect x="2" y="34" width="60" height="5" rx="2.5" /><path d="M8 33 C6 21 16 13 28 14 C40 15 49 23 49 33 Z" /><path d="M44 21 L55 9 a3.2 3.2 0 1 1 4.5 4.5 L48 25 Z" /><path d="M13 22 L6 15 a3 3 0 1 0 -4.2 4.2 L10 27 Z" />
    </svg>
  )
}
const heading = (th, info, title, sub, small) => (
  <>
    {info?.logo && <img src={info.logo} alt="" style={{ position: 'absolute', right: '10mm', top: '8mm', height: '22mm', maxWidth: '40mm', objectFit: 'contain', objectPosition: 'right top' }} />}
    <div style={{ position: 'absolute', left: '12mm', right: '55mm', top: '10mm' }}>
      <div style={{ fontSize: small ? '30pt' : '32pt', lineHeight: 1, letterSpacing: '.06em', textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>{title}</div>
      <div style={{ marginTop: '2mm', fontSize: '13pt', letterSpacing: '.2em', textTransform: 'uppercase', color: th.line, filter: 'brightness(1.6)' }}>{sub}</div>
    </div>
  </>
)

/** 4. Live scoreboard — same look as the A4 "Current standings" page. */
export function StandingsScene({ state, mode, theme, title }) {
  const th = themeOf(theme)
  const overall = state?.board === 'overall'
  const rows = computeRows(state, mode, overall ? 'overall' : 'match')
  const info = state?.info || {}
  const leader = rows[0]
  const base = (leader?.players || []).filter((p) => p.photo).slice(0, 6)
  const ORD = { 6: [6, 3, 1, 2, 4, 5], 5: [4, 3, 1, 2, 5], 4: [3, 1, 2, 4], 3: [3, 1, 2], 2: [1, 2], 1: [1] }
  const squad = (ORD[base.length] || []).map((n) => base[n - 1]).filter(Boolean)
  const mid = (squad.length - 1) / 2
  // like the A4 report: at most 8 teams per page, split evenly (16 teams = 8 + 8) and flipped automatically
  const pages = Math.max(1, Math.ceil(rows.length / 8))
  const per = Math.ceil(rows.length / pages) || 1
  const [tick, setTick] = useState(0)
  useEffect(() => { if (pages < 2) return undefined; const t = setInterval(() => setTick((x) => x + 1), 9000); return () => clearInterval(t) }, [pages])
  const manual = state?.boardPage != null && state.boardPage !== 'auto' ? Number(state.boardPage) : null
  const pg = pages < 2 ? 0 : manual != null && manual >= 0 && manual < pages ? manual : tick % pages
  const pageRows = rows.slice(pg * per, pg * per + per)
  const n = Math.max(pageRows.length, 1)
  const rowH = 17
  const fs = 15
  const sub = [state?.group, overall ? 'Overall standings' : 'Live standings', info.match && `Match ${info.match}`, info.map].filter(Boolean).join('  ·  ')
  const cols = '6mm 13mm 1fr 14mm 22mm 18mm 24mm'
  const num = { textAlign: 'center' }
  return (
    <A4Frame th={th}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '46%', overflow: 'hidden' }}>
        {squad.length === 0 && leader?.photo
          ? <img src={leader.photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
          : squad.length > 0
            ? (
              <div style={{ position: 'absolute', left: '4mm', right: '4mm', bottom: '26mm', top: '40mm', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2mm' }}>
                {squad.map((p, i) => (
                  <div key={p.key} style={{ flex: 1, height: `${100 - Math.abs(i - mid) * 11}%`, maxWidth: '34mm', overflow: 'hidden', borderRadius: '2mm 2mm 0 0', background: 'rgba(0,0,0,.35)' }}>
                    <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                  </div>
                ))}
              </div>
            )
            : leader?.logo && <img src={leader.logo} alt="" style={{ position: 'absolute', left: '15%', top: '22%', width: '70%', height: '50%', objectFit: 'contain' }} />}
        {info.logo && <img src={info.logo} alt="" style={{ position: 'absolute', left: '8mm', top: '7mm', height: '20mm', maxWidth: '40mm', objectFit: 'contain', objectPosition: 'left top' }} />}
        {leader && (
          <div style={{ position: 'absolute', left: '8mm', bottom: '8mm', display: 'flex', alignItems: 'center', gap: '4mm' }}>
            <span style={{ background: th.block, color: '#fff', fontSize: '30pt', lineHeight: 1, padding: '2.5mm 5mm', border: `0.6mm solid ${th.line}` }}>#1</span>
            {leader.logo && <img src={leader.logo} alt="" style={{ height: '16mm', width: '16mm', objectFit: 'contain' }} />}
            <span style={{ fontSize: '20pt', letterSpacing: '.04em', textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>{leader.name}</span>
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: '48%', right: '4%', top: '8mm' }}>
        <div style={{ fontSize: '24pt', lineHeight: 1, letterSpacing: '.03em', textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>{info.tournament || title}</div>
        <div style={{ marginTop: '1.5mm', fontSize: '11pt', letterSpacing: '.14em', textTransform: 'uppercase', color: th.line, filter: 'brightness(1.5)' }}>{sub}</div>
        <div style={{ marginTop: '5mm', background: 'rgba(0,0,0,.35)', borderTop: `0.6mm solid ${th.line}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', height: '9mm', padding: '0 3mm', fontSize: '11pt', letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.9 }}>
            <span /><span>Rank</span><span>Team</span>
            <span style={{ ...num, display: 'flex', justifyContent: 'center' }}><Chicken w="5mm" /></span>
            <span style={num}>Place pts</span><span style={num}>Elims</span><span style={num}>Total pts</span>
          </div>
          <div key={pg} style={{ position: 'relative', height: `${n * rowH}mm`, animation: pages > 1 ? 'lsPage .6s ease-out' : 'none' }}>
            <style>{`@keyframes lsPage{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}`}</style>
            {pageRows.map((r, idx) => (
              <div key={r.id} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${rowH}mm`, transform: `translateY(${idx * rowH}mm)`, transition: 'transform .8s cubic-bezier(.22,1,.36,1), opacity 1.2s', display: 'grid', gridTemplateColumns: cols, alignItems: 'center', padding: '0 3mm', borderTop: '0.3mm solid rgba(255,255,255,.18)', background: r.rank === 1 ? `${th.line}33` : r.rank % 2 === 0 ? 'rgba(0,0,0,.18)' : 'transparent', fontSize: `${fs}pt`, opacity: r.alive ? 1 : 0.4 }}>
                <span />
                <span style={{ fontSize: `${fs * 1.13}pt` }}>#{r.rank}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3mm', minWidth: 0 }}>
                  {r.logo ? <img src={r.logo} alt="" style={{ height: `${rowH * 0.7}mm`, width: `${rowH * 0.7}mm`, objectFit: 'contain', flexShrink: 0 }} /> : <span style={{ width: `${rowH * 0.7}mm`, flexShrink: 0 }} />}
                  <Flag code={r.country} h={`${Math.min(6, rowH * 0.35)}mm`} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase', letterSpacing: '.03em' }}>{r.tag || r.name}</span>
                </span>
                <span style={num}>{r.wwcd}</span>
                <span style={num}>{r.pp}</span>
                <span style={num}>{r.kills}</span>
                <span style={{ ...num, fontSize: `${fs * 1.2}pt` }}>{r.tp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {pages > 1 && <div style={{ position: 'absolute', left: '48%', right: '4%', bottom: '6mm', fontSize: '9pt', letterSpacing: '.15em', textTransform: 'uppercase', opacity: 0.9 }}>Page {pg + 1} / {pages}</div>}
    </A4Frame>
  )
}

/** 6. MVP list — same cards as the A4 MVP page (top 5 players by kills). */
export function MvpScene({ state, theme }) {
  const th = themeOf(theme)
  const info = state?.info || {}
  const list = mvpList(state).filter((p) => p.total > 0).slice(0, 5)
  const sub = [state?.group, 'MVP list', info.match && `Match ${info.match}`, info.map].filter(Boolean).join('  ·  ')
  return (
    <A4Frame th={th}>
      {heading(th, info, info.tournament || 'MVP', sub)}
      <div style={{ position: 'absolute', left: '12mm', right: '12mm', top: '38mm', bottom: '22mm' }}>
        <div style={{ position: 'relative', width: '270mm', height: '100%', margin: '0 auto' }}>
          {list.map((x, i) => (
            <div key={x.key} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50mm', transform: `translateX(${i * 55}mm)`, transition: 'transform .8s cubic-bezier(.22,1,.36,1)', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,.55)', border: `0.5mm solid ${th.line}`, overflow: 'hidden' }}>
              <div style={{ position: 'relative', flex: 1, minHeight: 0, background: `linear-gradient(180deg, ${th.block}, rgba(0,0,0,.6))` }}>
                {x.photo
                  ? <img src={x.photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                  : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '60pt', opacity: 0.35 }}>{x.name.slice(0, 1)}</div>}
                <span style={{ position: 'absolute', left: '2.5mm', top: '2mm', fontSize: '20pt', lineHeight: 1, textShadow: '0 1px 4px rgba(0,0,0,.7)' }}>#{i + 1}</span>
                {x.team?.logo && <img src={x.team.logo} alt="" style={{ position: 'absolute', right: '2mm', top: '2mm', height: '13mm', width: '13mm', objectFit: 'contain' }} />}
              </div>
              <div style={{ background: th.block, borderTop: `0.4mm solid ${th.line}`, borderBottom: `0.4mm solid ${th.line}`, textAlign: 'center', padding: '1.6mm 1mm', fontSize: '17pt', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</div>
              <div style={{ padding: '3mm 2mm 3.5mm', textAlign: 'center' }}>
                <div style={{ fontSize: '11pt', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.team?.tag || x.team?.name}</div>
                <div style={{ marginTop: '2mm', fontSize: '10pt', letterSpacing: '.2em', opacity: 0.75 }}>ELIMS</div>
                <div style={{ fontSize: '40pt', lineHeight: 1 }}>{x.total}</div>
              </div>
            </div>
          ))}
          {!list.length && <div style={{ textAlign: 'center', paddingTop: '60mm', fontSize: '22pt', opacity: 0.6 }}>No player kills recorded yet</div>}
        </div>
      </div>
    </A4Frame>
  )
}

/** 5. Head to head (teams, logos only) — same layout as the A4 head-to-head page. */
export function H2HScene({ state, mode, theme }) {
  const th = themeOf(theme)
  const info = state?.info || {}
  const rows = computeRows(state, mode)
  const A = rows.find((r) => r.id === state?.h2h?.a)
  const B = rows.find((r) => r.id === state?.h2h?.b)
  const sub = [state?.group, 'Head to head', info.match && `Match ${info.match}`, info.map].filter(Boolean).join('  ·  ')
  const aliveP = (r) => (r.alive ? (r.pl && r.pl.length ? r.pl : ['a', 'a', 'a', 'a']).filter((c) => c === 'a').length : 0)
  const sumP = (r) => (r.players || []).reduce((a, p) => a + playerTotal(p), 0)
  const stat = A && B ? [['Elims', A.kills, B.kills], ['Points', A.tp, B.tp], ['Rank', A.rank, B.rank, true], ['Players alive', aliveP(A), aliveP(B)], ['Player kills', sumP(A), sumP(B)]] : []
  const better = (va, vb, lower) => (va === vb ? null : (va > vb) !== !!lower ? 'a' : 'b')
  const side = (r, right) => {
    const top = (r.players || []).filter((p) => p.name).slice().sort((x, y) => playerTotal(y) - playerTotal(x)).slice(0, 3)
    return (
      <div key={r.id} style={{ position: 'absolute', top: '40mm', bottom: '22mm', [right ? 'right' : 'left']: '10mm', width: '86mm', overflow: 'hidden', background: 'rgba(0,0,0,.35)', borderTop: `0.6mm solid ${th.line}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {r.logo ? <img src={r.logo} alt="" style={{ position: 'absolute', inset: '8mm', width: 'calc(100% - 16mm)', height: 'calc(100% - 16mm)', objectFit: 'contain', filter: 'drop-shadow(0 2mm 3mm rgba(0,0,0,.5))' }} /> : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '70pt', opacity: 0.35 }}>{String(r.name || '?').slice(0, 2)}</div>}
        </div>
        {top.length > 0 && (
          <div style={{ padding: '1.5mm 4mm', borderTop: '0.3mm solid rgba(255,255,255,.18)', background: 'rgba(0,0,0,.3)' }}>
            {top.map((p) => (
              <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12pt', letterSpacing: '.06em', textTransform: 'uppercase' }}><span>{p.name}</span><span>{playerTotal(p)}</span></div>
            ))}
          </div>
        )}
        <div style={{ background: 'rgba(0,0,0,.45)', borderTop: '0.3mm solid rgba(255,255,255,.18)', padding: '2mm 4mm', textAlign: right ? 'left' : 'right' }}>
          <div style={{ fontSize: '22pt', lineHeight: 1.05, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '2mm', justifyContent: right ? 'flex-start' : 'flex-end' }}>
            <Flag code={r.country} h="5mm" />{r.name}
          </div>
        </div>
      </div>
    )
  }
  return (
    <A4Frame th={th}>
      {heading(th, info, info.tournament || 'Head to head', sub, true)}
      {A && B ? (
        <>
          {side(A, false)}
          {side(B, true)}
          <div style={{ position: 'absolute', left: '100mm', right: '100mm', top: '40mm', bottom: '22mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
            {stat.map(([label, va, vb, lower]) => {
              const w = better(va, vb, lower)
              const col = (win) => ({ fontSize: '34pt', lineHeight: 1, color: win ? '#fff' : 'rgba(255,255,255,.7)', textShadow: win ? `0 0 14px ${th.line}` : 'none', transition: 'all .5s' })
              return (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 34mm 1fr', alignItems: 'center', columnGap: '2mm' }}>
                  <div style={{ textAlign: 'right', ...col(w === 'a'), paddingRight: '3mm', borderRight: w === 'a' ? `1.2mm solid ${th.line}` : '1.2mm solid transparent' }}>{va}</div>
                  <div style={{ textAlign: 'center', fontSize: '11pt', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.9 }}>{label}</div>
                  <div style={{ textAlign: 'left', ...col(w === 'b'), paddingLeft: '3mm', borderLeft: w === 'b' ? `1.2mm solid ${th.line}` : '1.2mm solid transparent' }}>{vb}</div>
                </div>
              )
            })}
          </div>
        </>
      ) : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22pt', opacity: 0.6 }}>Choose two teams in the broadcast controls</div>}
    </A4Frame>
  )
}

/** WWCD team stats: shown after the winning team is known — the winner's players with their kills of THIS match only (they reset with the match). */
export function WwcdStatsScene({ row, info = {}, theme }) {
  const th = LIVE_THEMES[theme] || LIVE_THEMES.blue
  if (!row) return null
  const pl = (row.players || []).filter((p) => p.name).slice(0, 4)
  const W = 1500
  const cardW = pl.length ? Math.min(330, Math.floor((W - 330) / pl.length)) : 0
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: FONT, color: '#fff' }}>
      <div style={{ textAlign: 'center', paddingTop: 56 }}>
        <div style={{ fontSize: 130, letterSpacing: '.06em', lineHeight: 1, textTransform: 'uppercase' }}>WWCD team stats</div>
        <div style={{ fontSize: 38, letterSpacing: '.2em', color: th.line, filter: 'brightness(1.6)', marginTop: 6, textTransform: 'uppercase' }}>{subOf(info)}</div>
        <div style={{ width: 220, height: 5, background: th.line, margin: '14px auto 0', borderRadius: 3 }} />
      </div>
      <div style={{ position: 'absolute', left: (1920 - (330 + cardW * pl.length)) / 2, top: 340, display: 'flex', boxShadow: '0 20px 60px rgba(0,0,0,.55)', border: `3px solid ${th.line}`, background: '#070b16' }}>
        <div style={{ width: 330, height: 580, background: `linear-gradient(180deg,${th.block},#070b16)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 18, right: 18 }}><Flag code={row.country} h="30px" /></div>
          {row.logo ? <img src={row.logo} alt="" style={{ width: 220, height: 220, objectFit: 'contain' }} /> : <Logo r={row} size={200} th={th} />}
          <div style={{ fontSize: 76, letterSpacing: '.05em', lineHeight: 1, textTransform: 'uppercase', textAlign: 'center', padding: '0 10px' }}>{row.tag || row.name}</div>
          <div style={{ textAlign: 'center', borderTop: `2px solid ${th.line}`, paddingTop: 8, width: 220 }}>
            <div style={{ fontSize: 22, letterSpacing: '.25em', color: '#cfd6ea' }}>TEAM ELIMS</div>
            <div style={{ fontSize: 72, lineHeight: 1 }}>{row.mkills}</div>
          </div>
        </div>
        {pl.map((p) => (
          <div key={p.key} style={{ width: cardW, height: 580, position: 'relative', overflow: 'hidden', background: `linear-gradient(180deg,${th.block}cc,#0b1226)`, borderLeft: '1px solid rgba(255,255,255,.18)' }}>
            {p.photo && <img src={p.photo} alt="" style={{ position: 'absolute', right: 0, top: 0, bottom: 70, width: '66%', height: 'calc(100% - 70px)', objectFit: 'cover', objectPosition: 'center top' }} />}
            <div style={{ position: 'absolute', left: 12, top: 10, zIndex: 1 }}>
              <div style={{ fontSize: 54, lineHeight: 1, textShadow: '0 2px 10px rgba(0,0,0,.8)' }}>{Number(p.kills) || 0}</div>
              <div style={{ fontSize: 20, letterSpacing: '.06em', textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>ELIMS</div>
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, background: '#dbe7ff', color: '#16307a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, letterSpacing: '.03em', textTransform: 'uppercase', padding: '0 8px' }}><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{row.tag ? `${row.tag} ${p.name}` : p.name}</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

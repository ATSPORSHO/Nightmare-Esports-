import { useEffect, useRef, useState } from 'react'
import { computeRows, LIVE_THEMES } from '../lib/live'
import Flag from './Flag'

const ROW_DEFAULT = 36 // px
const FONT = "'Bebas Neue','Oswald','Arial Narrow',Impact,sans-serif"

/** Broadcast palette (olive rows, charcoal header, white slanted logo panel) shared by the scoreboard, final-4 strip, match overlay and elimination bar. */
const SB = { head: '#1a1a1c', row: '#51533f', row2: '#494b39', sep: 'rgba(255,255,255,.78)', panel: '#fbf7f7', dim: '#9a9c8c' }
const BAR = {
  a: 'linear-gradient(180deg,#46ff46 0%,#12b412 55%,#0a850a 100%)',
  k: 'linear-gradient(180deg,#ff5050 0%,#c01212 55%,#7d0808 100%)',
  d: '#2d2f26',
}
const SLANT = 'polygon(24% 0,100% 0,76% 100%,0 100%)'

/** White slanted logo panel (same shape as the reference scoreboard). */
function LogoPanel({ r, w = 74, h = '100%', fs = 14 }) {
  return (
    <div style={{ width: w, height: h, background: SB.panel, clipPath: SLANT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {r.logo ? <img src={r.logo} alt="" style={{ height: '78%', width: '56%', objectFit: 'contain' }} /> : <span style={{ color: '#111', fontSize: fs, letterSpacing: '.04em' }}>{String(r.tag || r.name || '').slice(0, 3).toUpperCase()}</span>}
    </div>
  )
}

/** Four slanted "alive players" bars: green alive, red knocked, dark = out. */
function AliveBars({ pl, alive, h = 20, w = 10, gap = 3 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap, paddingLeft: 6 }}>
      {[0, 1, 2, 3].map((i) => {
        const c = alive ? ((pl || [])[i] || 'a') : 'd'
        return <i key={i} style={{ display: 'block', width: w, height: h, background: BAR[c], transform: 'skewX(-22deg)', boxShadow: c === 'd' ? 'none' : 'inset 0 0 0 1px rgba(0,0,0,.25)', transition: 'background .4s' }} />
      })}
    </div>
  )
}

/** Animated live scorecard: rows slide to their new position when the ranking changes, numbers flash when points change. */
export default function LiveScorecard({ title, state, mode, theme = 'blue', width = 430, onEliminate, rowH, hideInfo, view = 'match' }) {
  const ROW = rowH || ROW_DEFAULT
  const cb = useRef(onEliminate)
  cb.current = onEliminate
  const th = LIVE_THEMES[theme] || LIVE_THEMES.blue
  const rows = computeRows(state, mode, view)
  const prev = useRef({})            // id -> { rank, tp, kills }
  const [fx, setFx] = useState({})   // id -> { pts, kills, up, down }
  const first = useRef(true)

  useEffect(() => {
    const next = {}
    const changes = {}
    const outs = []
    rows.forEach((r) => {
      const p = prev.current[r.id]
      if (p && !first.current) {
        const c = {}
        if (!p.winner && r.winner) { c.elim = true; outs.push({ ...r, win: true }) }
        else if (p.alive && !r.alive && !r.winner) { c.elim = true; outs.push(r) }
        if (r.tp !== p.tp) c.pts = true
        if (r.kills !== p.kills) c.kills = true
        if (r.rank < p.rank) c.up = true
        if (r.rank > p.rank) c.down = true
        if (Object.keys(c).length) changes[r.id] = c
      }
      next[r.id] = { rank: r.rank, tp: r.tp, kills: r.kills, alive: r.alive, winner: r.winner }
    })
    prev.current = next
    first.current = false
    if (Object.keys(changes).length) {
      setFx((o) => ({ ...o, ...changes }))
      outs.forEach((r) => cb.current && cb.current({ id: r.id, name: r.name, tag: r.tag, logo: r.logo, country: r.country, placement: r.placement, kills: r.mkills, points: r.mtp, win: r.win }))
      setTimeout(() => setFx((o) => { const n = { ...o }; Object.keys(changes).forEach((k) => { delete n[k] }); return n }), 3200)
    }
  }, [JSON.stringify(rows.map((r) => [r.id, r.rank, r.tp, r.kills, r.alive, r.placement]))]) // eslint-disable-line react-hooks/exhaustive-deps

  const alive = rows.filter((r) => r.alive).length
  const fs = Math.max(15, Math.round(ROW * 0.6))   // team / number size follows the row height
  const COLS = '36px 74px 1fr 76px 46px 44px'
  const dash = <i style={{ position: 'absolute', top: '18%', bottom: '18%', width: 1, background: 'rgba(255,255,255,.22)', transform: 'skewX(-22deg)' }} />
  return (
    <div style={{ width, fontFamily: FONT, color: '#fff', filter: 'drop-shadow(0 6px 18px rgba(0,0,0,.55))' }}>
      <style>{`
        @keyframes lsPulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes lsFlash{0%{background:${th.line}cc;transform:scale(1.25)}100%{background:transparent;transform:scale(1)}}
        @keyframes lsRowGlow{0%{box-shadow:inset 0 0 0 2px ${th.line},0 0 18px ${th.line}}100%{box-shadow:inset 0 0 0 0 transparent,0 0 0 transparent}}
        .ls-flash{animation:lsFlash 1.1s ease-out;border-radius:3px;display:inline-block;padding:0 4px}
        .ls-glow{animation:lsRowGlow 1.6s ease-out}
        @keyframes lsElim{0%{transform:translateX(-105%);opacity:0}12%{transform:translateX(0);opacity:1}78%{transform:translateX(0);opacity:1}100%{transform:translateX(0);opacity:0}}
        @keyframes lsElimShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
        .ls-shake{animation:lsElimShake .5s ease-in-out}
      `}</style>
      {!hideInfo && (state?.info?.tournament || state?.info?.match || state?.info?.map || state?.info?.logo) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: SB.head, borderBottom: `2px solid ${th.line}`, padding: '6px 12px' }}>
          {state.info.logo && <img src={state.info.logo} alt="" style={{ height: 32, width: 32, objectFit: 'contain', flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{state.info.tournament}</div>
            <div style={{ fontSize: 13, letterSpacing: '.14em', color: th.line, filter: 'brightness(1.5)', textTransform: 'uppercase' }}>{[state.info.match && `Match ${state.info.match}`, state.info.map].filter(Boolean).join('  ·  ')}</div>
          </div>
        </div>
      )}
      {/* header: slim title bar + column titles (slanted top-left corner like the reference) */}
      <div style={{ background: SB.head, clipPath: 'polygon(22px 0,100% 0,100% 100%,0 100%)', borderBottom: `3px solid ${th.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 0 30px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#d90429', borderRadius: 2, padding: '0 6px', fontSize: 12, letterSpacing: '.12em', lineHeight: '16px' }}>
            <i style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'lsPulse 1.2s infinite' }} />LIVE
          </span>
          <span style={{ fontSize: 15, letterSpacing: '.08em', textTransform: 'uppercase', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#e8e8e0' }}>{title}</span>
          {view === 'overall' && <span style={{ fontSize: 11, letterSpacing: '.14em', background: 'rgba(255,255,255,.18)', borderRadius: 2, padding: '0 6px' }}>OVERALL</span>}
          <span style={{ fontSize: 13, letterSpacing: '.1em', color: SB.dim }}>{alive} ALIVE</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', height: 26, fontSize: 15, letterSpacing: '.06em', textAlign: 'center' }}>
          <span /><span /><span style={{ textAlign: 'left', paddingLeft: 4 }}>TEAM</span><span style={{ paddingLeft: 6 }}>ALIVE</span><span>ELIMS</span><span>PTS</span>
        </div>
      </div>
      <div style={{ position: 'relative', height: rows.length * ROW, background: SB.row, overflow: 'hidden' }}>
        {rows.map((r) => {
          const f = fx[r.id] || {}
          const on = r.alive || r.winner || f.elim
          const fade = { opacity: on ? 1 : 0.34, filter: on ? 'none' : 'grayscale(1)', transition: 'opacity 1.4s ease 0.2s, filter 1.4s ease 0.2s' }
          return (
            <div key={r.id} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: ROW, transform: `translateY(${(r.rank - 1) * ROW}px)`, transition: 'transform .8s cubic-bezier(.22,1,.36,1)', borderBottom: `1px solid ${SB.sep}`, background: r.rank === 1 ? `linear-gradient(90deg,${th.line}66,transparent 55%), ${SB.row}` : r.rank % 2 ? SB.row : SB.row2, overflow: 'hidden' }}>
              <div className={f.elim ? 'ls-shake' : f.pts ? 'ls-glow' : ''} style={{ height: '100%', display: 'grid', gridTemplateColumns: COLS, alignItems: 'center' }}>
                {f.elim && <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: r.winner ? 'linear-gradient(90deg,#8a6200,#f5b301 50%,#8a6200)' : 'linear-gradient(90deg,#7f0a0a,#d90429 50%,#7f0a0a)', animation: 'lsElim 3s ease-in-out forwards', fontSize: Math.max(16, ROW * 0.55), letterSpacing: '.16em', color: r.winner ? '#111' : '#fff' }}>{r.winner ? 'WINNER WINNER CHICKEN DINNER' : <>ELIMINATED<span style={{ background: '#fff', color: '#b00020', borderRadius: 3, padding: '0 6px' }}>#{r.placement}</span></>}</div>}
                <div style={{ textAlign: 'center', fontSize: fs, position: 'relative' }}>
                  {r.rank}
                  {f.up && <span style={{ position: 'absolute', left: 2, top: 1, fontSize: 8, color: '#4ade80' }}>▲</span>}
                  {f.down && <span style={{ position: 'absolute', left: 2, bottom: 1, fontSize: 8, color: '#f87171' }}>▼</span>}
                </div>
                <div style={{ height: '100%', ...fade }}><LogoPanel r={r} fs={Math.round(ROW * 0.42)} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, paddingLeft: 4, ...fade }}>
                  <Flag code={r.country} h="10px" />
                  <span style={{ fontSize: fs, letterSpacing: '.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.tag || r.name}</span>
                  {r.winner ? <span style={{ fontSize: 11, letterSpacing: '.08em', color: '#f5b301', flexShrink: 0 }}>WWCD</span> : !r.alive && <span style={{ fontSize: 11, letterSpacing: '.08em', color: '#ff7b7b', flexShrink: 0 }}>#{r.placement}</span>}
                </div>
                <div style={{ position: 'relative', ...fade }}>{dash}<AliveBars pl={r.pl} alive={r.alive} h={Math.round(ROW * 0.5)} /></div>
                <div style={{ position: 'relative', textAlign: 'center', fontSize: fs, ...fade }}>{dash}<span className={f.kills ? 'ls-flash' : ''}>{String(r.kills).padStart(2, '0')}</span></div>
                <div style={{ position: 'relative', textAlign: 'center', fontSize: fs + 2, ...fade }}>{dash}<span className={f.pts ? 'ls-flash' : ''}>{r.tp}</span></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Bottom-left match overlay: red title block (stage name), dark "MATCH 06/16" strip and the tournament logo on a light panel. */
export function MatchOverlay({ info, theme = 'blue', width = 340 }) {
  const pad = (v) => String(v).padStart(2, '0')
  const title = info.stage || info.tournament || ''
  const matchTxt = info.match ? `MATCH ${pad(info.match)}${info.total ? `/${pad(info.total)}` : ''}` : ''
  const k = width / 340
  const fit = (txt, max, avail) => Math.min(max, avail / (Math.max(String(txt).length, 1) * 0.62))
  return (
    <div style={{ width, fontFamily: FONT, color: '#fff', borderTopRightRadius: 120 * k, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
      {title && (
        <div style={{ height: 72 * k, background: 'linear-gradient(90deg,#6e0000 0%,#c40000 55%,#f00000 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `0 ${44 * k}px 0 ${12 * k}px`, fontSize: fit(title, 48 * k, 284 * k), letterSpacing: '.02em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textShadow: '0 3px 6px rgba(0,0,0,.45)' }}>{title}</div>
      )}
      {(matchTxt || info.map) && (
        <div style={{ height: 50 * k, background: '#2a0000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 * k, fontSize: fit(matchTxt + (info.map ? '  · ' + info.map : ''), 36 * k, 316 * k), letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <span>{matchTxt}</span>
          {info.map && <span style={{ fontSize: '.66em', letterSpacing: '.1em', color: '#ff9b9b', textTransform: 'uppercase' }}>{matchTxt ? '· ' : ''}{info.map}</span>}
        </div>
      )}
      {info.logo && (
        <div style={{ height: 160 * k, background: '#eef2fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={info.logo} alt="" style={{ maxHeight: '88%', maxWidth: '82%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

/** Wide "eliminated stat" bar (top-centre of the broadcast layout), shown for a few seconds when a team is eliminated. */
function Chicken({ w = '40px', dark }) {
  return (
    <svg viewBox="0 0 64 40" style={{ width: w, height: `calc(${w} / 1.6)`, display: 'block' }} fill={dark ? '#111' : '#fff'}>
      <rect x="2" y="34" width="60" height="5" rx="2.5" /><path d="M8 33 C6 21 16 13 28 14 C40 15 49 23 49 33 Z" /><path d="M44 21 L55 9 a3.2 3.2 0 1 1 4.5 4.5 L48 25 Z" /><path d="M13 22 L6 15 a3 3 0 1 0 -4.2 4.2 L10 27 Z" />
    </svg>
  )
}
export function EliminationPopup({ item, theme = 'blue', top = 80, cx = 725 }) {
  const th = LIVE_THEMES[theme] || LIVE_THEMES.blue
  if (!item) return null
  return (
    <div style={{ position: 'absolute', left: cx - 700, top, width: 1400, fontFamily: FONT, color: '#fff', animation: 'lsGlitch 3.6s linear forwards' }}>
      <style>{`
        @keyframes lsGlitch{
          0%{opacity:0;transform:translateX(0)}
          2%{opacity:1;transform:translateX(-18px) skewX(14deg);clip-path:inset(10% 0 55% 0);filter:drop-shadow(5px 0 0 #ff003c) drop-shadow(-5px 0 0 #00e5ff)}
          4%{opacity:.2;transform:translateX(14px) skewX(-10deg);clip-path:inset(60% 0 8% 0)}
          6%{opacity:1;transform:translateX(-8px);clip-path:inset(0 0 35% 0);filter:drop-shadow(-4px 0 0 #ff003c) drop-shadow(4px 0 0 #00e5ff)}
          8%{opacity:0;transform:translateX(10px)}
          10%{opacity:1;transform:translateX(5px) skewX(-6deg);clip-path:inset(30% 0 20% 0)}
          12%{opacity:.6;transform:translateX(-3px);clip-path:inset(0);filter:drop-shadow(3px 0 0 #ff003c) drop-shadow(-3px 0 0 #00e5ff)}
          14%,86%{opacity:1;transform:none;clip-path:inset(0);filter:none}
          88%{opacity:1;transform:translateX(12px) skewX(10deg);clip-path:inset(0 0 50% 0);filter:drop-shadow(5px 0 0 #ff003c) drop-shadow(-5px 0 0 #00e5ff)}
          90%{opacity:.3;transform:translateX(-16px);clip-path:inset(45% 0 0 0)}
          92%{opacity:1;transform:translateX(7px) skewX(-8deg);clip-path:inset(15% 0 40% 0);filter:drop-shadow(-4px 0 0 #ff003c) drop-shadow(4px 0 0 #00e5ff)}
          95%{opacity:0;transform:translateX(-10px)}
          97%{opacity:.7;transform:translateX(4px);clip-path:inset(55% 0 5% 0)}
          100%{opacity:0;transform:translateX(0);clip-path:inset(0)}
        }
      `}</style>
      <div style={{ transform: 'scale(.55)', transformOrigin: 'top center', display: 'flex', alignItems: 'stretch', background: SB.row, borderBottom: `5px solid ${th.line}`, boxShadow: '0 10px 40px rgba(0,0,0,.6)', height: 110 }}>
        {item.win ? (
          <div style={{ background: 'linear-gradient(180deg,#f5b301,#8a6200)', color: '#111', padding: '0 34px 0 22px', clipPath: 'polygon(0 0,100% 0,90% 100%,0 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minWidth: 210, gap: 2 }}>
            <Chicken w="54px" dark />
            <span style={{ fontSize: 20, letterSpacing: '.16em', lineHeight: 1 }}>WINNER WINNER</span>
            <span style={{ fontSize: 20, letterSpacing: '.16em', lineHeight: 1 }}>CHICKEN DINNER</span>
          </div>
        ) : (
          <div style={{ background: 'linear-gradient(180deg,#d90429,#7f0a0a)', padding: '0 38px 0 22px', clipPath: 'polygon(0 0,100% 0,88% 100%,0 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minWidth: 170 }}>
            <span style={{ fontSize: 16, letterSpacing: '.22em' }}>ELIMINATED</span>
            <span style={{ fontSize: 54, lineHeight: 1 }}>#{item.placement}</span>
          </div>
        )}
        <div style={{ width: 120, marginLeft: -22, background: SB.panel, clipPath: SLANT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {item.logo ? <img src={item.logo} alt="" style={{ height: '78%', width: '56%', objectFit: 'contain' }} /> : <span style={{ color: '#111', fontSize: 30 }}>{String(item.tag || item.name).slice(0, 3).toUpperCase()}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 40, letterSpacing: '.05em', textTransform: 'uppercase', lineHeight: 1.05, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.name}</div>
        </div>
        {[['KILLS', item.kills], ['POINTS', item.points]].map(([l, v]) => (
          <div key={l} style={{ textAlign: 'center', background: SB.head, borderLeft: `1px solid ${SB.sep}`, padding: '8px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 110 }}>
            <span style={{ fontSize: 15, letterSpacing: '.2em', color: SB.dim }}>{l}</span>
            <span style={{ fontSize: 52, lineHeight: 1 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Share of the "winner winner chicken dinner" between the teams still alive, worked out from how many of their players are alive (knocked players count half). */
export function wwcdShares(rows) {
  const w = rows.map((r) => (r.pl && r.pl.length ? r.pl : ['a', 'a', 'a', 'a']).reduce((n, c) => n + (c === 'a' ? 1 : c === 'k' ? 0.5 : 0), 0))
  const sum = w.reduce((a, b) => a + b, 0) || 1
  return w.map((x) => (x / sum) * 100)
}

/** Final-4 strip (top-centre): slanted logo panel, tag, four slanted player bars (green alive / red knocked / dark out), kills, WWCD %. */
export function FinalFour({ rows, theme = 'blue' }) {
  const th = LIVE_THEMES[theme] || LIVE_THEMES.blue
  const sh = wwcdShares(rows)
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', fontFamily: FONT, color: '#fff' }}>
      {rows.map((r, i) => (
        <div key={r.id} style={{ width: 290, filter: 'drop-shadow(0 6px 16px rgba(0,0,0,.55))' }}>
          <div style={{ height: 54, display: 'flex', alignItems: 'center', background: SB.row, overflow: 'hidden' }}>
            <LogoPanel r={r} w={92} fs={20} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, paddingLeft: 2 }}>
              <Flag code={r.country} h="12px" />
              <span style={{ fontSize: 26, letterSpacing: '.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.tag || r.name}</span>
            </div>
            <div style={{ paddingRight: 12 }}><AliveBars pl={r.pl || ['a', 'a', 'a', 'a']} alive h={26} w={11} /></div>
          </div>
          <div style={{ height: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', background: SB.head, borderBottom: `3px solid ${th.line}`, fontSize: 18, letterSpacing: '.08em' }}>
            <span style={{ textAlign: 'center' }}><span style={{ fontSize: 13, color: SB.dim, marginRight: 6 }}>KILLS</span>{String(r.kills).padStart(2, '0')}</span>
            <span style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,.2)' }}><span style={{ fontSize: 13, color: SB.dim, marginRight: 6 }}>WWCD</span>{sh[i].toFixed(1)}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}

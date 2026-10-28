import { useEffect, useRef, useState } from 'react'
import { computeRows, LIVE_THEMES } from '../lib/live'
import Flag from './Flag'

const ROW_DEFAULT = 46 // px

/** Animated live scorecard: rows slide to their new position when the ranking changes, numbers flash when points change. */
export default function LiveScorecard({ title, state, mode, theme = 'blue', width = 560, onEliminate, rowH, hideInfo }) {
  const ROW = rowH || ROW_DEFAULT
  const cb = useRef(onEliminate)
  cb.current = onEliminate
  const th = LIVE_THEMES[theme] || LIVE_THEMES.blue
  const rows = computeRows(state, mode)
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
        if (p.alive && !r.alive) { c.elim = true; outs.push(r) }
        if (r.tp !== p.tp) c.pts = true
        if (r.kills !== p.kills) c.kills = true
        if (r.rank < p.rank) c.up = true
        if (r.rank > p.rank) c.down = true
        if (Object.keys(c).length) changes[r.id] = c
      }
      next[r.id] = { rank: r.rank, tp: r.tp, kills: r.kills, alive: r.alive }
    })
    prev.current = next
    first.current = false
    if (Object.keys(changes).length) {
      setFx((o) => ({ ...o, ...changes }))
      outs.forEach((r) => cb.current && cb.current({ id: r.id, name: r.name, tag: r.tag, logo: r.logo, country: r.country, placement: r.placement, kills: r.kills, points: r.tp }))
      setTimeout(() => setFx((o) => { const n = { ...o }; Object.keys(changes).forEach((k) => { delete n[k] }); return n }), 3200)
    }
  }, [JSON.stringify(rows.map((r) => [r.id, r.rank, r.tp, r.kills, r.alive, r.placement]))]) // eslint-disable-line react-hooks/exhaustive-deps

  const alive = rows.filter((r) => r.alive).length
  return (
    <div style={{ width, fontFamily: "'Bebas Neue','Oswald','Arial Narrow',Impact,sans-serif", color: '#fff' }}>
      <style>{`
        @keyframes lsPulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes lsFlash{0%{background:${th.line}cc;transform:scale(1.25)}100%{background:transparent;transform:scale(1)}}
        @keyframes lsRowGlow{0%{box-shadow:inset 0 0 0 2px ${th.line},0 0 22px ${th.line}}100%{box-shadow:inset 0 0 0 0 transparent,0 0 0 transparent}}
        .ls-flash{animation:lsFlash 1.1s ease-out;border-radius:4px;display:inline-block;padding:0 6px}
        .ls-glow{animation:lsRowGlow 1.6s ease-out}
        @keyframes lsElim{0%{transform:translateX(-105%);opacity:0}12%{transform:translateX(0);opacity:1}78%{transform:translateX(0);opacity:1}100%{transform:translateX(0);opacity:0}}
        @keyframes lsElimShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
        .ls-shake{animation:lsElimShake .5s ease-in-out}
      `}</style>
      {!hideInfo && (state?.info?.tournament || state?.info?.match || state?.info?.map || state?.info?.logo) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0a101c', borderBottom: `1px solid ${th.line}66`, padding: '8px 14px', borderRadius: '6px 6px 0 0' }}>
          {state.info.logo && <img src={state.info.logo} alt="" style={{ height: 40, width: 40, objectFit: 'contain', flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{state.info.tournament}</div>
            <div style={{ fontSize: 15, letterSpacing: '.14em', color: th.line, textTransform: 'uppercase' }}>{[state.info.match && `Match ${state.info.match}`, state.info.map].filter(Boolean).join('  ·  ')}</div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: th.block, borderTop: `3px solid ${th.line}`, padding: '8px 14px', borderRadius: '6px 6px 0 0' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#d90429', borderRadius: 4, padding: '2px 8px', fontSize: 15, letterSpacing: '.1em' }}>
          <i style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'lsPulse 1.2s infinite' }} />LIVE
        </span>
        <span style={{ fontSize: 22, letterSpacing: '.06em', textTransform: 'uppercase', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        <span style={{ fontSize: 15, letterSpacing: '.1em', opacity: 0.9 }}>{alive} ALIVE</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 74px 56px 62px', alignItems: 'center', background: '#0a101c', padding: '4px 14px 4px 0', fontSize: 14, letterSpacing: '.12em', color: '#aab', textAlign: 'center' }}>
        <span>#</span><span style={{ textAlign: 'left', paddingLeft: 44 }}>TEAMS</span><span>ALIVE</span><span>ELIMS</span><span>PTS</span>
      </div>
      <div style={{ position: 'relative', height: rows.length * ROW, background: '#0d1524', overflow: 'hidden' }}>
        {rows.map((r) => {
          const f = fx[r.id] || {}
          const fade = { opacity: r.alive || f.elim ? 1 : 0.3, filter: r.alive || f.elim ? 'none' : 'grayscale(1)', transition: 'opacity 1.4s ease 0.2s, filter 1.4s ease 0.2s' }
          return (
            <div key={r.id} className={f.elim ? 'ls-shake' : f.pts ? 'ls-glow' : ''} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: ROW, transform: `translateY(${(r.rank - 1) * ROW}px)`, transition: 'transform .8s cubic-bezier(.22,1,.36,1)', display: 'grid', gridTemplateColumns: '44px 1fr 74px 56px 62px', alignItems: 'center', padding: '0 14px 0 0', borderTop: '1px solid rgba(255,255,255,.08)', background: r.rank === 1 ? `linear-gradient(${th.line}40,${th.line}40), #101a2c` : r.rank % 2 ? '#101a2c' : '#0d1524', overflow: 'hidden' }}>
              {f.elim && <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'linear-gradient(90deg,#7f0a0a,#d90429 50%,#7f0a0a)', animation: 'lsElim 3s ease-in-out forwards', fontSize: 26, letterSpacing: '.18em' }}>ELIMINATED<span style={{ background: '#fff', color: '#b00020', borderRadius: 4, padding: '0 8px' }}>#{r.placement}</span></div>}
              <div style={{ textAlign: 'center', fontSize: 24, color: r.rank <= 3 ? '#fff' : '#cfd3e0', position: 'relative' }}>
                {r.rank}
                {f.up && <span style={{ position: 'absolute', left: 3, top: 3, fontSize: 10, color: '#22c55e' }}>▲</span>}
                {f.down && <span style={{ position: 'absolute', left: 3, bottom: 3, fontSize: 10, color: '#ef4444' }}>▼</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, ...fade }}>
                <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', border: `2px solid ${r.alive ? th.line : '#667'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {r.logo ? <img src={r.logo} alt="" style={{ width: '86%', height: '86%', objectFit: 'contain' }} /> : <span style={{ color: '#111', fontSize: 12 }}>{String(r.tag || r.name).slice(0, 2)}</span>}
                </span>
                <Flag code={r.country} h="12px" />
                <span style={{ fontSize: 22, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.tag || r.name}</span>
                {!r.alive && <span style={{ fontSize: 13, letterSpacing: '.08em', color: '#ef4444', flexShrink: 0 }}>#{r.placement} OUT</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 3, ...fade }}>
                {[0, 1, 2, 3].map((i) => { const c = r.alive ? ((r.pl || [])[i] || 'a') : 'd'; return <i key={i} style={{ width: 8, height: 22, borderRadius: 1, background: c === 'a' ? '#22c55e' : c === 'k' ? '#ef4444' : '#5b6270', transition: 'background .4s' }} /> })}
              </div>
              <div style={{ textAlign: 'center', fontSize: 24, ...fade }}><span className={f.kills ? 'ls-flash' : ''}>{r.kills}</span></div>
              <div style={{ textAlign: 'center', fontSize: 28, ...fade }}><span className={f.pts ? 'ls-flash' : ''}>{r.tp}</span></div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, background: '#0a101c', padding: '6px 14px', fontSize: 13, letterSpacing: '.1em', color: '#aab', borderRadius: '0 0 6px 6px' }}>
        {[['#22c55e', 'ALIVE'], ['#ef4444', 'KNOCKED'], ['#5b6270', 'ELIMINATED']].map(([c, l]) => <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, background: c, display: 'inline-block' }} />{l}</span>)}
      </div>
    </div>
  )
}

/** Wide "eliminated stat" bar (top-centre of the broadcast layout), shown for a few seconds when a team is eliminated. */
export function EliminationPopup({ item, theme = 'blue' }) {
  const th = LIVE_THEMES[theme] || LIVE_THEMES.blue
  if (!item) return null
  return (
    <div style={{ position: 'absolute', left: 240, top: 80, width: 900, fontFamily: "'Bebas Neue','Oswald','Arial Narrow',Impact,sans-serif", color: '#fff', animation: 'lsGlitch 3.6s linear forwards' }}>
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
      <div style={{ transform: 'scale(.6)', transformOrigin: 'top center', display: 'flex', alignItems: 'stretch', background: '#0a101c', border: `2px solid ${th.line}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,.6)' }}>
        <div style={{ background: 'linear-gradient(180deg,#d90429,#7f0a0a)', padding: '0 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minWidth: 150 }}>
          <span style={{ fontSize: 16, letterSpacing: '.22em' }}>ELIMINATED</span>
          <span style={{ fontSize: 54, lineHeight: 1 }}>#{item.placement}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', flex: 1, minWidth: 0 }}>
          <span style={{ width: 84, height: 84, borderRadius: '50%', background: '#fff', border: `3px solid ${th.line}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {item.logo ? <img src={item.logo} alt="" style={{ width: '88%', height: '88%', objectFit: 'contain' }} /> : <span style={{ color: '#111', fontSize: 30 }}>{String(item.tag || item.name).slice(0, 2)}</span>}
          </span>
          <div style={{ fontSize: 38, letterSpacing: '.05em', textTransform: 'uppercase', lineHeight: 1.05, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.name}</div>
        </div>
        {[['KILLS', item.kills], ['POINTS', item.points]].map(([l, v]) => (
          <div key={l} style={{ textAlign: 'center', background: '#101a2c', borderLeft: `2px solid ${th.line}55`, padding: '10px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 110 }}>
            <span style={{ fontSize: 15, letterSpacing: '.2em', color: '#aab' }}>{l}</span>
            <span style={{ fontSize: 52, lineHeight: 1 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { computeRows, LIVE_THEMES } from '../lib/live'
import Flag from './Flag'

const ROW = 46 // px

/** Animated live scorecard: rows slide to their new position when the ranking changes, numbers flash when points change. */
export default function LiveScorecard({ title, state, mode, theme = 'blue', width = 560 }) {
  const th = LIVE_THEMES[theme] || LIVE_THEMES.blue
  const rows = computeRows(state, mode)
  const prev = useRef({})            // id -> { rank, tp, kills }
  const [fx, setFx] = useState({})   // id -> { pts, kills, up, down }
  const first = useRef(true)

  useEffect(() => {
    const next = {}
    const changes = {}
    rows.forEach((r) => {
      const p = prev.current[r.id]
      if (p && !first.current) {
        const c = {}
        if (p.alive && !r.alive) c.elim = true
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
      const t = setTimeout(() => setFx((o) => { const n = { ...o }; Object.keys(changes).forEach((k) => { delete n[k] }); return n }), 3200)
      return () => clearTimeout(t)
    }
  }, [JSON.stringify(rows.map((r) => [r.id, r.rank, r.tp, r.kills]))]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: th.block, borderTop: `3px solid ${th.line}`, padding: '8px 14px', borderRadius: '6px 6px 0 0' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#d90429', borderRadius: 4, padding: '2px 8px', fontSize: 15, letterSpacing: '.1em' }}>
          <i style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'lsPulse 1.2s infinite' }} />LIVE
        </span>
        <span style={{ fontSize: 22, letterSpacing: '.06em', textTransform: 'uppercase', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        <span style={{ fontSize: 15, letterSpacing: '.1em', opacity: 0.9 }}>{alive} ALIVE</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 62px 62px', alignItems: 'center', background: 'rgba(5,8,18,.92)', padding: '4px 14px 4px 0', fontSize: 14, letterSpacing: '.12em', color: '#aab', textAlign: 'center' }}>
        <span>#</span><span style={{ textAlign: 'left', paddingLeft: 44 }}>TEAM</span><span>ELIMS</span><span>PTS</span>
      </div>
      <div style={{ position: 'relative', height: rows.length * ROW, background: 'rgba(5,8,18,.82)', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
        {rows.map((r) => {
          const f = fx[r.id] || {}
          const fade = { opacity: r.alive || f.elim ? 1 : 0.3, filter: r.alive || f.elim ? 'none' : 'grayscale(1)', transition: 'opacity 1.4s ease 0.2s, filter 1.4s ease 0.2s' }
          return (
            <div key={r.id} className={f.elim ? 'ls-shake' : f.pts ? 'ls-glow' : ''} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: ROW, transform: `translateY(${(r.rank - 1) * ROW}px)`, transition: 'transform .8s cubic-bezier(.22,1,.36,1)', display: 'grid', gridTemplateColumns: '44px 1fr 62px 62px', alignItems: 'center', padding: '0 14px 0 0', borderTop: '1px solid rgba(255,255,255,.08)', background: r.rank === 1 ? `${th.line}33` : 'transparent', overflow: 'hidden' }}>
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
                {r.alive
                  ? <i style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', flexShrink: 0 }} />
                  : <span style={{ fontSize: 13, letterSpacing: '.08em', color: '#ef4444', flexShrink: 0 }}>#{r.placement} OUT</span>}
              </div>
              <div style={{ textAlign: 'center', fontSize: 24, ...fade }}><span className={f.kills ? 'ls-flash' : ''}>{r.kills}</span></div>
              <div style={{ textAlign: 'center', fontSize: 28, ...fade }}><span className={f.pts ? 'ls-flash' : ''}>{r.tp}</span></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

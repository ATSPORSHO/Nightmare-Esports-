import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LiveScorecard, { EliminationPopup } from '../components/LiveScorecard'
import { LIVE_THEMES } from '../lib/live'

/** Public live page (no menu). Use this link as a Browser Source in OBS, or open it in any browser. ?theme=green|blue|red  ?bg=dark */
export default function LiveView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const [data, setData] = useState(undefined) // undefined = loading, null = ended / not found
  const timer = useRef(null)
  const queue = useRef([])
  const [pop, setPop] = useState(null)
  const playing = useRef(false)
  const next = useCallback(() => {
    const it = queue.current.shift()
    if (!it) { playing.current = false; setPop(null); return }
    playing.current = true
    setPop({ ...it, k: Date.now() })
    setTimeout(next, 4200)
  }, [])
  const onElim = useCallback((it) => { queue.current.push(it); if (!playing.current) next() }, [next])
  const [scale, setScale] = useState(1)

  // the whole layout is drawn on a 1920x1080 stage and scaled to fit the window / OBS source
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      const { data: d, error } = await supabase.rpc('broadcast_state', { p_id: id })
      if (!alive) return
      if (!error) setData(d || null)
      timer.current = setTimeout(load, 1500)
    }
    load()
    return () => { alive = false; clearTimeout(timer.current) }
  }, [id])

  if (data === undefined) return null
  if (data === null) return <div style={{ padding: 24, color: '#fff', fontFamily: 'sans-serif', textShadow: '0 1px 3px #000' }}>This broadcast has ended.</div>
  const theme = params.get('theme') || data.theme
  const info = data.state?.info || {}
  const n = (data.state?.teams || []).length || 1
  const SB_TOP = 190, SB_H = 1080 - 20 - SB_TOP
  const rowH = Math.max(26, Math.min(46, Math.floor((SB_H - 104) / n)))
  const font = "'Bebas Neue','Oswald','Arial Narrow',Impact,sans-serif"
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: 'top left', transform: `scale(${scale})`, overflow: 'hidden', fontFamily: font, color: '#fff' }}>
      {/* top-right: tournament logo */}
      <div style={{ position: 'absolute', right: 20, top: 20, width: 160, height: 160, background: '#0a101c', border: '2px solid rgba(255,255,255,.12)', borderRadius: 8, display: info.logo ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        {info.logo && <img src={info.logo} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
      </div>
      {/* right: live scoreboard */}
      <div style={{ position: 'absolute', right: 20, top: SB_TOP }}>
        <LiveScorecard title={data.title} state={data.state} mode={data.mode} theme={theme} width={540} rowH={rowH} hideInfo onEliminate={onElim} />
      </div>
      {/* bottom-left: live match overlay */}
      {(info.tournament || info.match || info.map) && (
        <div style={{ position: 'absolute', left: 20, bottom: 20, width: 560, display: 'flex', alignItems: 'center', gap: 14, background: '#0a101c', borderLeft: `5px solid ${(LIVE_THEMES[theme] || LIVE_THEMES.blue).line}`, borderRadius: 6, padding: '10px 18px' }}>
          {info.logo && <img src={info.logo} alt="" style={{ height: 56, width: 56, objectFit: 'contain', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 30, letterSpacing: '.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.tournament}</div>
            <div style={{ fontSize: 22, letterSpacing: '.16em', color: (LIVE_THEMES[theme] || LIVE_THEMES.blue).line, textTransform: 'uppercase' }}>{[info.match && `Match ${info.match}`, info.map].filter(Boolean).join('  ·  ')}</div>
          </div>
        </div>
      )}
      {/* top-centre: eliminated stat */}
      <EliminationPopup key={pop?.k} item={pop} theme={theme} />
    </div>
  )
}

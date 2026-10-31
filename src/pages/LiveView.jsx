import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LiveScorecard, { EliminationPopup, FinalFour, MatchOverlay } from '../components/LiveScorecard'
import { LIVE_THEMES, WWCD_THEMES, computeRows } from '../lib/live'
import { StartingScene, TeamsScene, H2HScene, MvpScene, StandingsScene, WwcdStatsScene, stageBg } from '../components/LiveScenes'

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
  const lastFinal = useRef([])
  const lastWin = useRef(null)
  const wref = useRef(null)

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
      timer.current = setTimeout(load, 700)
    }
    load()
    return () => { alive = false; clearTimeout(timer.current) }
  }, [id])

  // WWCD video: loops full screen from the moment the controls start it until they stop it
  const wOn = !!data?.state?.wwcd?.on
  const wKey = data?.state?.wwcd?.key
  useEffect(() => {
    const v = wref.current
    if (!wOn || !v) return
    v.muted = false
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}) })
  }, [wOn, wKey])

  if (data === undefined) return null
  if (data === null) return <div style={{ padding: 24, color: '#fff', fontFamily: 'sans-serif', textShadow: '0 1px 3px #000' }}>This broadcast has ended.</div>
  const theme = params.get('theme') || data.theme
  const info = data.state?.info || {}
  const n = (data.state?.teams || []).length || 1
  const SB_TOP = 20, SB_H = 1080 - 20 - SB_TOP
  const rowH = Math.max(24, Math.min(36, Math.floor((SB_H - 70) / n)))
  const scene0 = data.state?.scene || 'live'
  const allRows = computeRows(data.state, data.mode, 'match')
  const aliveRows = allRows.filter((r) => r.alive)
  const winRow = allRows.find((r) => r.winner)
  const showStats = !!winRow && scene0 === 'live' && !data.state?.wstatsHide
  if (winRow) lastWin.current = winRow
  const final4 = allRows.length > 4 && aliveRows.length > 0 && aliveRows.length <= 4
  if (final4) lastFinal.current = aliveRows
  const font = "'Bebas Neue','Oswald','Arial Narrow',Impact,sans-serif"
  const scene = data.state?.scene || 'live'
  const th0 = LIVE_THEMES[theme] || LIVE_THEMES.blue
  const layer = (on, bg) => ({ position: 'absolute', inset: 0, background: bg ? stageBg(th0) : 'transparent', opacity: on ? 1 : 0, transform: on ? 'none' : 'scale(1.04)', visibility: on ? 'visible' : 'hidden', transition: `opacity .6s ease, transform .6s ease, visibility 0s linear ${on ? '0s' : '.6s'}`, pointerEvents: 'none' })
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: 'top left', transform: `scale(${scale})`, overflow: 'hidden', fontFamily: font, color: '#fff' }}>
      <div style={layer(scene === 'live', false)}>
      {/* right: live scoreboard */}
      <div style={{ position: 'absolute', right: 20, top: SB_TOP, transform: final4 ? 'translateX(125%)' : 'none', transition: 'transform .9s cubic-bezier(.65,0,.35,1)' }}>
        <LiveScorecard title={data.title} state={data.state} mode={data.mode} theme={theme} width={430} rowH={rowH} hideInfo view={data.state?.board || 'match'} onEliminate={onElim} />
      </div>
      {/* bottom-left: live match overlay */}
      {(info.stage || info.tournament || info.match || info.map || info.logo) && (
        <div style={{ position: 'absolute', left: 20, bottom: 20 }}><MatchOverlay info={info} theme={theme} width={340} /></div>
      )}
      {/* top-centre: final 4 teams (shown when only 4 or fewer teams are alive) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 20, transform: final4 ? 'none' : 'translateY(-260px)', opacity: final4 ? 1 : 0, transition: 'transform .9s cubic-bezier(.65,0,.35,1) .35s, opacity .6s ease .35s' }}>
        <FinalFour rows={lastFinal.current} theme={theme} />
      </div>
      {/* eliminated stat */}
      <EliminationPopup key={pop?.k} item={pop} theme={theme} top={final4 ? 130 : 60} cx={final4 ? 960 : 725} />
      </div>
      <div style={layer(showStats, true)}><WwcdStatsScene row={lastWin.current} info={info} theme={theme} /></div>
      <div style={layer(scene === 'starting', true)}><StartingScene info={info} theme={theme} /></div>
      <div style={layer(scene === 'teams', true)}><TeamsScene teams={data.state?.teams || []} info={info} theme={theme} /></div>
      <div style={layer(scene === 'scoreboard', false)}><StandingsScene state={data.state} mode={data.mode} theme={theme} title={data.title} /></div>
      <div style={layer(scene === 'h2h', false)}><H2HScene state={data.state} mode={data.mode} theme={theme} /></div>
      <video key={wKey} ref={wref} src={`${import.meta.env.BASE_URL}wwcd.mp4`} loop playsInline preload="auto"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#000', zIndex: 100, filter: (WWCD_THEMES[data.state?.wwcdTheme] || WWCD_THEMES.blue).filter, opacity: wOn ? 1 : 0, visibility: wOn ? 'visible' : 'hidden', transition: `opacity .5s ease, visibility 0s linear ${wOn ? '0s' : '.5s'}`, pointerEvents: 'none' }} />
      <div style={layer(scene === 'mvp', false)}><MvpScene state={data.state} theme={theme} /></div>
    </div>
  )
}

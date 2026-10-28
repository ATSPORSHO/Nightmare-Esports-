import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LiveScorecard from '../components/LiveScorecard'

/** Public live page (no menu). Use this link as a Browser Source in OBS, or open it in any browser. ?theme=green|blue|red  ?bg=dark */
export default function LiveView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const [data, setData] = useState(undefined) // undefined = loading, null = ended / not found
  const timer = useRef(null)
  const box = useRef(null)
  const [scale, setScale] = useState(1)

  // shrink the whole scorecard so every team fits inside the browser window / OBS source (never cropped)
  useEffect(() => {
    const fit = () => {
      const el = box.current
      if (!el) return
      const w = 560, h = el.offsetHeight || 1
      setScale(Math.min(window.innerWidth / w, window.innerHeight / h))
    }
    fit()
    const ro = box.current ? new ResizeObserver(fit) : null
    if (ro) ro.observe(box.current)
    window.addEventListener('resize', fit)
    return () => { ro?.disconnect(); window.removeEventListener('resize', fit) }
  }, [data])

  useEffect(() => {
    const css = document.createElement('style')
    css.textContent = `html,body{overflow:hidden !important}html,body,#root{background:${params.get('bg') === 'dark' ? '#05070f' : 'transparent'} !important}`
    document.head.appendChild(css)
    return () => css.remove()
  }, [params])

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
  return (
    <div ref={box} style={{ width: 560, transformOrigin: 'top left', transform: `scale(${scale})`, position: 'absolute', left: 0, top: 0 }}>
      <LiveScorecard title={data.title} state={data.state} mode={data.mode} theme={params.get('theme') || data.theme} />
    </div>
  )
}

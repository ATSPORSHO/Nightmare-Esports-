import { useEffect, useState } from 'react'

/** Live countdown to an ISO date: 02d 03h 12m 45s. Calls onDone once when it reaches zero. */
export default function Countdown({ to, onDone, className = '' }) {
  const [now, setNow] = useState(Date.now())
  const target = new Date(to).getTime()
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, target - now)
  useEffect(() => { if (left === 0 && onDone) onDone() }, [left === 0]) // eslint-disable-line react-hooks/exhaustive-deps
  const d = Math.floor(left / 86400000), h = Math.floor(left / 3600000) % 24, m = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60
  const box = (v, l) => (
    <div className="min-w-[48px] rounded-lg border border-red-800/60 bg-black/50 px-2 py-1.5 text-center">
      <div className="font-display text-xl font-extrabold leading-none text-white">{String(v).padStart(2, '0')}</div>
      <div className="mt-1 text-[9px] uppercase tracking-wider text-red-300">{l}</div>
    </div>
  )
  return <div className={`flex items-center gap-1.5 ${className}`}>{box(d, 'days')}{box(h, 'hrs')}{box(m, 'min')}{box(s, 'sec')}</div>
}

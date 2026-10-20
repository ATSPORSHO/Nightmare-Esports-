import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { CATEGORY_COLORS } from '../lib/constants'
import { num } from '../lib/format'

const FALLBACK = ['#c8102e', '#f59e0b', '#22c58b', '#fb7185', '#f5a524', '#38c2c7', '#f472b6', '#facc15']
export const colorFor = (name, i) => CATEGORY_COLORS[name] || FALLBACK[i % FALLBACK.length]

/** Donut with the total in the middle. items = [{ name, value }] */
export function Donut({ items, center, sub, size = 170, inner = 0.62 }) {
  const data = items.length ? items : [{ name: 'none', value: 1 }]
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={`${inner * 100}%`} outerRadius="100%" stroke="none" paddingAngle={items.length > 1 ? 2 : 0}>
            {data.map((d, i) => <Cell key={d.name} fill={items.length ? colorFor(d.name, i) : '#2a1214'} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {center !== undefined && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="font-display text-xl font-bold leading-none text-white">{center}</div>
          {sub && <div className="mt-1 text-[10px] text-slate-400">{sub}</div>}
        </div>
      )}
    </div>
  )
}

export function Legend({ items, total }) {
  return (
    <ul className="min-w-0 flex-1 space-y-1.5 text-[12.5px]">
      {items.map((d, i) => (
        <li key={d.name} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(d.name, i) }} />
          <span className="truncate text-slate-300">{d.name}</span>
          <span className="ml-auto font-medium text-white">{total ? Math.round((d.value / total) * 100) : 0}%</span>
        </li>
      ))}
      {!items.length && <li className="text-slate-500">No data in this period</li>}
    </ul>
  )
}

/** circular progress ring */
export function Ring({ value, size = 96 }) {
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#2a1214" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke="#22c58b" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, value)) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-white">{num(value)}%</div>
    </div>
  )
}

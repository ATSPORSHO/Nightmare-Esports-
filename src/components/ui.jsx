import { X, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin text-slate-400 ${className}`} size={18} />
}

export function Empty({ children = 'Nothing here yet.' }) {
  return <div className="py-6 text-center text-sm text-slate-500">{children}</div>
}

export function ErrorBox({ children }) {
  if (!children) return null
  return <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{children}</div>
}

export function Notice({ children }) {
  if (!children) return null
  return <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{children}</div>
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className={`my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl border border-ink-600 bg-ink-900 p-5 shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-ink-700 hover:text-white"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  )
}

export function Card({ title, icon: Icon, link, linkLabel = 'View All', children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || link) && (
        <div className="card-title justify-between">
          <span className="flex items-center gap-2">
            {Icon && <Icon size={16} className="text-accent" />}
            {title}
          </span>
          {link && <Link to={link} className="text-[11px] font-medium text-violet-300 hover:text-white">{linkLabel} →</Link>}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}

export function Avatar({ name, url, size = 28 }) {
  const ini = (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return url ? (
    <img src={url} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="inline-flex items-center justify-center rounded-full border border-accent/60 bg-accent/20 font-bold text-violet-100"
    >
      {ini}
    </span>
  )
}

export function StatusBadge({ status }) {
  const cls = status === 'active' ? 'badge-green' : status === 'benched' ? 'badge-amber' : 'badge-red'
  return <span className={cls}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

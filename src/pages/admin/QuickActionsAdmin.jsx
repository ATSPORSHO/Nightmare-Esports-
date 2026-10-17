import { useState } from 'react'
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { Icon, ICONS } from '../../lib/icons'
import { Card, ErrorBox, Field, Modal, Spinner } from '../../components/ui'

// Where a Quick Action button can send people
const TARGETS = [
  { value: '/submit/screenshot', label: 'Analyze PUBG Screenshot (upload page)' },
  { value: '/submit/training', label: 'Add Training Screenshot (upload page)' },
  { value: '/training?new=1', label: 'Add Training Session (form, admin only)' },
  { value: '/matches?new=1', label: 'Add Match Result (form, admin only)' },
  { value: '/finance?new=1', label: 'Add Finance Entry (form, admin only)' },
  { value: '/reports', label: 'Reports' },
  { value: '/players', label: 'Players' },
  { value: '/matches', label: 'Match Results' },
  { value: '/finance', label: 'Finance' },
  { value: '/training', label: 'Training' },
  { value: '/admin?tab=submissions', label: 'Admin → Submissions' },
]

export default function QuickActionsAdmin() {
  const { data, loading, error, reload } = useData(() => supabase.from('quick_actions').select('*').order('sort'))
  const [editing, setEditing] = useState(null)

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.label}"?`)) return
    await supabase.from('quick_actions').delete().eq('id', a.id)
    reload()
  }
  const move = async (i, dir) => {
    const list = data
    const j = i + dir
    if (j < 0 || j >= list.length) return
    await Promise.all([
      supabase.from('quick_actions').update({ sort: list[j].sort }).eq('id', list[i].id),
      supabase.from('quick_actions').update({ sort: list[i].sort }).eq('id', list[j].id),
    ])
    reload()
  }
  const toggle = async (a) => {
    await supabase.from('quick_actions').update({ enabled: !a.enabled }).eq('id', a.id)
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">Choose which buttons appear on the dashboard, what they do, their colour, and which roles can see them.</p>
        <button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add button</button>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading ? <Spinner /> : (
          <ul className="divide-y divide-ink-700/60">
            {(data || []).map((a, i) => (
              <li key={a.id} className={`flex flex-wrap items-center gap-3 py-3 ${a.enabled ? '' : 'opacity-50'}`}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: a.color }}><Icon name={a.icon} size={18} /></span>
                <div className="min-w-[180px] flex-1">
                  <div className="font-medium text-white">{a.label}</div>
                  <div className="text-xs text-slate-500">{a.target}</div>
                </div>
                <div className="flex gap-1">{a.roles.map((r) => <span key={r} className={r === 'admin' ? 'badge-accent' : 'badge-green'}>{r}</span>)}</div>
                <label className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input type="checkbox" checked={a.enabled} onChange={() => toggle(a)} className="h-4 w-4 accent-[rgb(var(--accent))]" /> shown
                </label>
                <div className="flex gap-1">
                  <button className="btn-ghost btn-sm" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></button>
                  <button className="btn-ghost btn-sm" disabled={i === data.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></button>
                  <button className="btn-ghost btn-sm" onClick={() => setEditing(a)}><Pencil size={13} /></button>
                  <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(a)}><Trash2 size={13} /></button>
                </div>
              </li>
            ))}
            {!data?.length && <li className="py-6 text-center text-slate-500">No buttons yet.</li>}
          </ul>
        )}
      </Card>
      {editing && <Form row={editing} count={data?.length || 0} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </div>
  )
}

function Form({ row, count, onClose, onSaved }) {
  const [f, setF] = useState({ label: '', icon: 'Zap', color: '#6d4aff', target: TARGETS[0].value, roles: ['admin'], enabled: true, ...row })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const toggleRole = (r) => setF({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] })

  const save = async (e) => {
    e.preventDefault()
    if (!f.roles.length) return setErr('Pick at least one role who can see this button.')
    setBusy(true); setErr('')
    const payload = { label: f.label, icon: f.icon, color: f.color, target: f.target, roles: f.roles, enabled: f.enabled }
    const q = supabase.from('quick_actions')
    const { error } = row.id ? await q.update(payload).eq('id', row.id) : await q.insert({ ...payload, sort: count + 1 })
    setBusy(false)
    if (error) setErr(error.message)
    else onSaved()
  }

  const known = TARGETS.some((t) => t.value === f.target)

  return (
    <Modal title={row.id ? 'Edit button' : 'Add button'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Button text"><input className="input" required value={f.label} onChange={set('label')} /></Field>
        <Field label="What it does (opens)">
          <select className="input" value={known ? f.target : '__custom'} onChange={(e) => e.target.value !== '__custom' && setF({ ...f, target: e.target.value })}>
            {TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            {!known && <option value="__custom">Custom: {f.target}</option>}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Icon">
            <select className="input" value={f.icon} onChange={set('icon')}>{Object.keys(ICONS).map((n) => <option key={n}>{n}</option>)}</select>
          </Field>
          <Field label="Colour"><input type="color" value={f.color} onChange={set('color')} className="h-10 w-full cursor-pointer rounded border border-ink-600 bg-transparent" /></Field>
        </div>
        <div>
          <span className="label">Who can see this button</span>
          <div className="flex gap-4 text-sm">
            {['admin', 'player'].map((r) => (
              <label key={r} className="flex items-center gap-2 capitalize">
                <input type="checkbox" checked={f.roles.includes(r)} onChange={() => toggleRole(r)} className="h-4 w-4 accent-[rgb(var(--accent))]" /> {r}s
              </label>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Buttons that open an add/edit form only work for admins, even if shown to players.</p>
        </div>
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

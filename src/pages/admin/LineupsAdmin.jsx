import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useLineup } from '../../context/LineupContext'
import { Card, ErrorBox, Field, Modal, Spinner } from '../../components/ui'
import ImageField from '../../components/ImageField'

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export default function LineupsAdmin() {
  const { reload: reloadCtx } = useLineup()
  const { data, loading, error, reload } = useData(() => supabase.from('lineups').select('*').order('sort').order('name'))
  const [editing, setEditing] = useState(null)
  const refresh = () => { reload(); reloadCtx() }

  const remove = async (l) => {
    if (!window.confirm(`Delete lineup "${l.name}"? Players stay, but will have no lineup.`)) return
    await supabase.from('lineups').delete().eq('id', l.id)
    refresh()
  }
  const toggle = async (l) => { await supabase.from('lineups').update({ active: !l.active }).eq('id', l.id); refresh() }
  const togglePublic = async (l) => { await supabase.from('lineups').update({ is_public: !l.is_public }).eq('id', l.id); refresh() }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">Lineups are the teams of your organization. Active lineups show on the home page and can be picked when you create a player.</p>
        <button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add lineup</button>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading ? <Spinner /> : (
          <ul className="divide-y divide-ink-700/60">
            {(data || []).map((l) => (
              <li key={l.id} className={`flex flex-wrap items-center gap-3 py-3 ${l.active ? '' : 'opacity-50'}`}>
                {l.logo_url ? <img src={l.logo_url} alt="" className="h-10 w-10 rounded object-contain" /> : <span className="flex h-10 w-10 items-center justify-center rounded bg-accent/30 font-bold text-white">{l.name[0]}</span>}
                <div className="min-w-[160px] flex-1"><div className="font-medium text-white">{l.name}</div><div className="text-xs text-slate-500">{l.tagline}</div></div>
                <label className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input type="checkbox" checked={l.active} onChange={() => toggle(l)} className="h-4 w-4 accent-[rgb(var(--accent))]" /> active
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-400" title="Visitors who are not logged in can see this lineup and its players">
                  <input type="checkbox" checked={!!l.is_public} onChange={() => togglePublic(l)} className="h-4 w-4 accent-[rgb(var(--accent))]" /> public
                </label>
                <button className="btn-ghost btn-sm" onClick={() => setEditing(l)}><Pencil size={13} /></button>
                <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(l)}><Trash2 size={13} /></button>
              </li>
            ))}
            {!data?.length && <li className="py-6 text-center text-slate-500">No lineups yet — add Nightmare Esports first.</li>}
          </ul>
        )}
      </Card>
      {editing && <Form row={editing} count={data?.length || 0} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
    </div>
  )
}

function Form({ row, count, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', tagline: 'PUBG MOBILE TEAM', logo_url: null, active: true, is_public: false, ...row })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const payload = { name: f.name, tagline: f.tagline || null, logo_url: f.logo_url || null, active: f.active, is_public: !!f.is_public }
    const q = supabase.from('lineups')
    const { error } = row.id ? await q.update(payload).eq('id', row.id) : await q.insert({ ...payload, slug: slugify(f.name) || `lineup-${Date.now()}`, sort: count + 1 })
    setBusy(false)
    if (error) setErr(error.message); else onSaved()
  }

  return (
    <Modal title={row.id ? 'Edit lineup' : 'Add lineup'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Lineup name"><input className="input" required value={f.name} onChange={set('name')} placeholder="Nightmare Official" /></Field>
        <Field label="Sub-title"><input className="input" value={f.tagline || ''} onChange={set('tagline')} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.is_public} onChange={(e) => setF({ ...f, is_public: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--accent))]" /> Show this lineup and its players to the public (visitors not logged in)</label>
        <ImageField label="Lineup logo" folder="lineup" value={f.logo_url} onChange={(v) => setF({ ...f, logo_url: v })} />
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

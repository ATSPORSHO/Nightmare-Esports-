import { useState } from 'react'
import { UserPlus, Pencil, KeyRound, Trash2, Copy, ArrowUp, ArrowDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { useSettings } from '../../context/SettingsContext'
import { useAuth } from '../../context/AuthContext'
import { PLAYER_ROLES } from '../../lib/constants'
import { num } from '../../lib/format'
import { movePlayer } from '../../lib/roster'
import { useLineup } from '../../context/LineupContext'
import LineupSelect from '../../components/LineupSelect'
import ImageField from '../../components/ImageField'
import { Card, ErrorBox, Field, Modal, Notice, Spinner, StatusBadge } from '../../components/ui'

async function callFn(body) {
  const { data, error } = await supabase.functions.invoke('create-player', { body })
  if (error) {
    // surface the JSON error message returned by the function if there is one
    try { const j = await error.context.json(); return { error: j.error || error.message } } catch { return { error: error.message } }
  }
  return data?.error ? { error: data.error } : { data }
}

const randomPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const a = new Uint32Array(10)
  crypto.getRandomValues(a)
  return Array.from(a, (n) => chars[n % chars.length]).join('')
}

export default function PlayersAdmin() {
  const { settings } = useSettings()
  const { data, loading, error, reload } = useData(() => supabase.from('profiles').select('*').order('role').order('sort_order').order('created_at'))
  const [modal, setModal] = useState(null) // { type: 'create' | 'edit' | 'password', player? }
  const [created, setCreated] = useState(null)

  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.full_name}'s account permanently? Their login and stats are removed.`)) return
    const r = await callFn({ action: 'delete', id: p.id })
    if (r.error) window.alert(r.error)
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">Create a Player, Admin or Management account. Player details (name, e-mail, phone, IGN, UID) are saved into the Players dashboard automatically.</p>
        <button className="btn-primary" onClick={() => setModal({ type: 'create' })}><UserPlus size={16} /> Create account</button>
      </div>

      {created && (
        <Notice>
          Account created. Send these login details to the player (the password is shown only now):
          <div className="mt-2 rounded bg-black/30 p-2 font-mono text-xs text-white">
            Email: {created.email}<br />Password: {created.password}<br />Site: {settings.app_url || '(set the website URL in Branding)'}
          </div>
          <button className="btn-ghost btn-sm mt-2" onClick={() => navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}\nSite: ${settings.app_url || ''}`)}>
            <Copy size={13} /> Copy
          </button>
        </Notice>
      )}
      <ErrorBox>{error}</ErrorBox>

      <Card className="overflow-x-auto">
        {loading ? <Spinner /> : (
          <table className="tbl">
            <thead><tr><th>Order</th><th>Player</th><th>IGN</th><th>UID</th><th>Role</th><th>Phone</th><th>Email</th><th>Status</th><th className="text-right">Salary</th><th>Access</th><th /></tr></thead>
            <tbody>
              {(data || []).map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">
                    {p.role === 'player' && (() => {
                      const pl = data.filter((x) => x.role === 'player'); const i = pl.findIndex((x) => x.id === p.id)
                      return (<>
                        <button className="btn-ghost btn-sm mr-1" disabled={i === 0} onClick={async () => { await movePlayer(pl, i, -1); reload() }} title="Move up"><ArrowUp size={13} /></button>
                        <button className="btn-ghost btn-sm" disabled={i === pl.length - 1} onClick={async () => { await movePlayer(pl, i, 1); reload() }} title="Move down"><ArrowDown size={13} /></button>
                      </>)
                    })()}
                  </td>
                  <td>{p.full_name}</td>
                  <td>{p.ign}</td><td>{p.game_uid}</td><td>{p.player_role}</td><td>{p.phone}</td><td>{p.email}</td>
                  <td><StatusBadge status={p.status} /></td><td className="text-right">{num(p.monthly_salary)}</td>
                  <td><span className={p.role === 'admin' ? 'badge-accent' : p.role === 'management' ? 'badge-amber' : 'badge-green'}>{p.role}</span></td>
                  <td className="whitespace-nowrap text-right">
                    <button title="Edit" className="btn-ghost btn-sm mr-1" onClick={() => setModal({ type: 'edit', player: p })}><Pencil size={13} /></button>
                    <button title="Reset password" className="btn-ghost btn-sm mr-1" onClick={() => setModal({ type: 'password', player: p })}><KeyRound size={13} /></button>
                    {p.role !== 'admin' && <button title="Delete" className="btn-ghost btn-sm text-red-300" onClick={() => remove(p)}><Trash2 size={13} /></button>}
                  </td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={11} className="py-6 text-center text-slate-500">No accounts yet.</td></tr>}
            </tbody>
          </table>
        )}
      </Card>

      {modal?.type === 'create' && (
        <CreateForm onClose={() => setModal(null)} onCreated={(c) => { setCreated(c); setModal(null); reload() }} />
      )}
      {modal?.type === 'edit' && <EditForm player={modal.player} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload() }} />}
      {modal?.type === 'password' && <PasswordForm player={modal.player} onClose={() => setModal(null)} />}
    </div>
  )
}

function PlayerFields({ f, set }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Player name"><input className="input" required value={f.full_name} onChange={set('full_name')} /></Field>
        <Field label="IGN (in-game name)"><input className="input" required value={f.ign} onChange={set('ign')} /></Field>
        <Field label="Game UID"><input className="input" required value={f.game_uid} onChange={set('game_uid')} /></Field>
        <Field label="Phone number"><input className="input" required value={f.phone} onChange={set('phone')} /></Field>
        <Field label="In-game role">
          <select className="input" value={f.player_role} onChange={set('player_role')}>{PLAYER_ROLES.map((r) => <option key={r}>{r}</option>)}</select>
        </Field>
        <Field label="Monthly salary"><input className="input" type="number" min="0" value={f.monthly_salary} onChange={set('monthly_salary')} /></Field>
      </div>
    </>
  )
}

const ACCOUNT_TYPES = [
  { key: 'player', label: 'Player', desc: 'Plays for a lineup. Can view the site and upload screenshots.' },
  { key: 'admin', label: 'Admin', desc: 'Full control: edits everything and manages accounts.' },
  { key: 'management', label: 'Management', desc: 'Staff with view-only access to everything (players, matches, finance, reports). Cannot change anything.' },
]

function StaffFields({ f, set }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name"><input className="input" required value={f.full_name} onChange={set('full_name')} /></Field>
      <Field label="Phone number (optional)"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
      <Field label="Position / title (optional)"><input className="input" value={f.title} onChange={set('title')} placeholder="Manager, Coach, Analyst…" /></Field>
    </div>
  )
}

function CreateForm({ onClose, onCreated }) {
  const { activeLineups } = useLineup()
  const [kind, setKind] = useState('player')
  const [f, setF] = useState({ lineup_id: activeLineups[0]?.id || '', avatar_url: null, full_name: '', ign: '', game_uid: '', phone: '', title: '', player_role: PLAYER_ROLES[0], monthly_salary: 0, email: '', password: randomPassword() })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const isPlayer = kind === 'player'

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { lineup_id, avatar_url, title, ...rest } = f
    const body = isPlayer
      ? { ...rest, monthly_salary: Number(f.monthly_salary) || 0 }
      : { full_name: f.full_name, phone: f.phone, ign: '', game_uid: '', player_role: title, monthly_salary: 0, password: f.password }
    const r = await callFn({ action: 'create', ...body, email: f.email.trim() })
    if (r.error) { setBusy(false); return setErr(r.error) }
    const extra = {}
    if (!isPlayer) extra.role = kind
    if (isPlayer && lineup_id) extra.lineup_id = lineup_id
    if (avatar_url) extra.avatar_url = avatar_url
    if (r.profile?.id && Object.keys(extra).length) {
      const u = await supabase.from('profiles').update(extra).eq('id', r.profile.id)
      if (u.error) { setBusy(false); return setErr(`Account created, but the type could not be saved: ${u.error.message}. Did you run the account-types SQL?`) }
    }
    setBusy(false)
    onCreated({ email: f.email.trim(), password: f.password })
  }

  return (
    <Modal title="Create account" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <span className="label">Account type</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {ACCOUNT_TYPES.map((t) => (
              <button key={t.key} type="button" onClick={() => setKind(t.key)}
                className={`rounded-lg border p-3 text-left transition ${kind === t.key ? 'border-accent bg-accent/15' : 'border-ink-600 bg-ink-850 hover:bg-ink-800'}`}>
                <div className="text-sm font-semibold text-white">{t.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {isPlayer ? (
          <>
            <PlayerFields f={f} set={set} />
            <Field label="Lineup" hint="Which team this player belongs to.">
              <LineupSelect value={f.lineup_id} onChange={(v) => setF({ ...f, lineup_id: v })} />
            </Field>
          </>
        ) : <StaffFields f={f} set={set} />}
        <ImageField label="Profile picture (optional)" folder="player" value={f.avatar_url} onChange={(v) => setF({ ...f, avatar_url: v })} hint="Shown on the home page lineup." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Login e-mail (Gmail)"><input className="input" type="email" required value={f.email} onChange={set('email')} /></Field>
          <Field label="Password" hint="Auto-generated. You can type your own (8+ characters).">
            <input className="input font-mono" required minLength={8} value={f.password} onChange={set('password')} />
          </Field>
        </div>
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : `Create ${ACCOUNT_TYPES.find((t) => t.key === kind).label.toLowerCase()} account`}</button>
        </div>
      </form>
    </Modal>
  )
}

function EditForm({ player, onClose, onSaved }) {
  const { profile: me } = useAuth()
  const isSelf = me?.id === player.id
  const [f, setF] = useState({ ...player, phone: player.phone || '', ign: player.ign || '', game_uid: player.game_uid || '', player_role: player.player_role || PLAYER_ROLES[0] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    if (f.email !== player.email) {
      const r = await callFn({ action: 'update_email', id: player.id, email: f.email.trim() })
      if (r.error) { setBusy(false); return setErr(r.error) }
    }
    const { error } = await supabase.from('profiles').update({
      full_name: f.full_name, ign: f.ign, game_uid: f.game_uid, phone: f.phone, player_role: f.player_role,
      monthly_salary: Number(f.monthly_salary) || 0, status: f.status, lineup_id: f.lineup_id || null, avatar_url: f.avatar_url || null, role: f.role,
    }).eq('id', player.id)
    setBusy(false)
    if (error) return setErr(error.message)
    onSaved()
  }

  return (
    <Modal title={`Edit ${player.full_name}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <PlayerFields f={f} set={set} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Account type" hint={isSelf ? 'You cannot change your own account type.' : undefined}>
            <select className="input" value={f.role} disabled={isSelf} onChange={set('role')}>
              <option value="player">Player</option><option value="admin">Admin</option><option value="management">Management</option>
            </select>
          </Field>
          <Field label="Lineup"><LineupSelect value={f.lineup_id} allowShared sharedLabel="No lineup" onChange={(v) => setF({ ...f, lineup_id: v })} /></Field>
        </div>
        <ImageField label="Profile picture" folder="player" value={f.avatar_url} onChange={(v) => setF({ ...f, avatar_url: v })} hint="Shown on the home page lineup." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Login e-mail"><input className="input" type="email" required value={f.email || ''} onChange={set('email')} /></Field>
          <Field label="Status">
            <select className="input" value={f.status} onChange={set('status')}>
              <option value="active">Active</option><option value="benched">Benched</option><option value="inactive">Inactive (no reminders)</option>
            </select>
          </Field>
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

function PasswordForm({ player, onClose }) {
  const [pw, setPw] = useState(randomPassword())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const r = await callFn({ action: 'reset_password', id: player.id, password: pw })
    setBusy(false)
    if (r.error) setErr(r.error)
    else setDone(true)
  }

  return (
    <Modal title={`Reset password — ${player.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="New password"><input className="input font-mono" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <ErrorBox>{err}</ErrorBox>
        {done && <Notice>Password changed. Send it to the player: <b className="font-mono">{pw}</b></Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" disabled={busy || done}>{busy ? 'Saving…' : 'Set password'}</button>
        </div>
      </form>
    </Modal>
  )
}

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { COUNTRIES } from '../lib/countries'
import { ErrorBox, Field, Modal } from './ui'

/** Public team registration form for a tournament. */
export default function RegisterModal({ tournament, onClose }) {
  const [f, setF] = useState({ team_name: '', tag: '', country: '', contact: '' })
  const [players, setPlayers] = useState(['', '', '', ''])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    const list = players.map((p) => p.trim()).filter(Boolean)
    if (list.length < 4) return setErr('Please add at least 4 player names.')
    setBusy(true)
    const { error } = await supabase.from('treg_entries').insert({
      tournament_id: tournament.id, team_name: f.team_name.trim(), tag: f.tag.trim().toUpperCase() || null,
      country: f.country || null, contact: f.contact.trim(), players: list,
    })
    setBusy(false)
    if (error) return setErr(/row-level security|policy/i.test(error.message) ? 'Registration is closed for this tournament.' : error.message)
    setDone(true)
  }

  return (
    <Modal title={`Register — ${tournament.title}`} onClose={onClose}>
      {done ? (
        <div className="space-y-3 py-4 text-center">
          <div className="text-lg font-bold text-white">Registration received ✓</div>
          <p className="text-sm text-slate-400">Thank you! The organizers will review your team and contact you.</p>
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Team name"><input className="input" required value={f.team_name} onChange={set('team_name')} /></Field>
            <Field label="Team tag (short)"><input className="input" maxLength={8} value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value.toUpperCase() })} /></Field>
          </div>
          {tournament.scope === 'international' && (
            <Field label="Country">
              <select className="input" required value={f.country} onChange={set('country')}>
                <option value="">— choose —</option>
                {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </Field>
          )}
          <Field label="Contact (Discord / WhatsApp / e-mail of the team leader)"><input className="input" required value={f.contact} onChange={set('contact')} /></Field>
          <div>
            <div className="label">Players (in-game names, at least 4)</div>
            <div className="space-y-1.5">
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="input" placeholder={`Player ${i + 1}`} value={p} onChange={(e) => setPlayers(players.map((x, k) => (k === i ? e.target.value : x)))} />
                  {players.length > 4 && <button type="button" className="btn-ghost btn-sm text-red-300" onClick={() => setPlayers(players.filter((_, k) => k !== i))}><Trash2 size={13} /></button>}
                </div>
              ))}
            </div>
            {players.length < 7 && <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => setPlayers([...players, ''])}><Plus size={13} /> Add substitute</button>}
          </div>
          <ErrorBox>{err}</ErrorBox>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit registration'}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}

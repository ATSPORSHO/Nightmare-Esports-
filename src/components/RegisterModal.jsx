import { useState } from 'react'
import { Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { COUNTRIES } from '../lib/countries'
import { printConfirmation } from '../lib/regForm'
import { ErrorBox, Field, Modal } from './ui'

/** Public team registration: 4 players + 2 optional, a Google Drive link with their photos, then a printable confirmation with a code. */
export default function RegisterModal({ tournament, onClose }) {
  const [tab, setTab] = useState('register')
  const [f, setF] = useState({ team_name: '', tag: '', country: '', contact: '', drive: '' })
  const [players, setPlayers] = useState(['', '', '', '', '', ''])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [code, setCode] = useState('')
  const [found, setFound] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    const list = players.map((p) => p.trim()).filter(Boolean)
    if (players.slice(0, 4).some((p) => !p.trim())) return setErr('Players 1 to 4 are required. Players 5 and 6 are optional.')
    if (!/^https?:\/\/(drive|docs)\.google\.com\//i.test(f.drive.trim())) return setErr('Please add a Google Drive link (drive.google.com) with the player photos.')
    setBusy(true)
    const { data, error } = await supabase.rpc('submit_registration', {
      p_tournament: tournament.id, p_team: f.team_name, p_tag: f.tag, p_country: f.country, p_contact: f.contact, p_players: list, p_drive: f.drive.trim(),
    })
    setBusy(false)
    if (error) return setErr(/submit_registration|schema cache/i.test(error.message) ? 'Registration is not set up yet (the organizer must run supabase/registration.sql).' : error.message)
    const res = typeof data === 'string' ? JSON.parse(data) : data
    setDone({ code: res.code, created: res.created_at, tournament: tournament.title, team: f.team_name, tag: f.tag, country: COUNTRIES.find(([c]) => c === f.country)?.[1] || '', contact: f.contact, players: list, drive: f.drive.trim() })
  }

  const check = async (e) => {
    e.preventDefault(); setErr(''); setFound(null)
    const { data, error } = await supabase.rpc('registration_status', { p_code: Number(code) })
    if (error) return setErr(error.message)
    setFound((data || [])[0] || 'none')
  }

  return (
    <Modal title={`Register — ${tournament.title}`} onClose={onClose}>
      {done ? (
        <div className="space-y-3 py-2 text-center">
          <div className="text-lg font-bold text-white">Registration received ✓</div>
          <div className="rounded-xl border border-red-700/60 bg-black/40 py-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Your confirmation code</div>
            <div className="font-display text-5xl font-extrabold tracking-widest text-white">#{done.code}</div>
          </div>
          <p className="text-sm text-slate-400">Print or save the confirmation form and keep the code. Your registration is confirmed only when the organizers approve it, and they will ask for this code.</p>
          <div className="flex justify-center gap-2">
            <button className="btn-primary" onClick={() => printConfirmation(done)}><Printer size={15} /> Print confirmation</button>
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex overflow-hidden rounded-lg border border-ink-600">
            {[['register', 'Register team'], ['check', 'Check my registration']].map(([k, l]) => (
              <button type="button" key={k} onClick={() => { setTab(k); setErr('') }} className={`flex-1 px-3 py-2 text-xs font-semibold ${tab === k ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-700'}`}>{l}</button>
            ))}
          </div>
          {tab === 'check' ? (
            <form onSubmit={check} className="space-y-3">
              <Field label="Confirmation code (e.g. 101)"><input className="input" type="number" required value={code} onChange={(e) => setCode(e.target.value)} /></Field>
              <button className="btn-primary">Check</button>
              {found === 'none' && <div className="text-sm text-red-300">No registration found with this code.</div>}
              {found && found !== 'none' && (
                <div className="rounded-lg border border-ink-600 p-3 text-sm text-slate-200">
                  <b className="text-white">{found.team_name}</b> · {found.tournament_title}<br />
                  Status: <b className={found.status === 'approved' ? 'text-emerald-300' : found.status === 'rejected' ? 'text-red-300' : 'text-amber-300'}>{found.status === 'approved' ? 'Confirmed ✓' : found.status === 'rejected' ? 'Rejected' : 'Pending'}</b>
                </div>
              )}
              <ErrorBox>{err}</ErrorBox>
            </form>
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
                <div className="label">Players (in-game names): 4 required, 2 optional</div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {players.map((p, i) => (
                    <input key={i} className="input" required={i < 4} placeholder={i < 4 ? `Player ${i + 1}` : `Player ${i + 1} (optional)`} value={p} onChange={(e) => setPlayers(players.map((x, k) => (k === i ? e.target.value : x)))} />
                  ))}
                </div>
              </div>
              <Field label="Google Drive link with the player photos" hint="Upload the photos of your players to one Google Drive folder, set sharing to “Anyone with the link can view”, and paste the link here.">
                <input className="input" required placeholder="https://drive.google.com/…" value={f.drive} onChange={set('drive')} />
              </Field>
              <ErrorBox>{err}</ErrorBox>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit registration'}</button>
              </div>
            </form>
          )}
        </>
      )}
    </Modal>
  )
}

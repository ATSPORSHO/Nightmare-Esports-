import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { ErrorBox, Field, Modal, Spinner } from '../../components/ui'
import ImageField from '../../components/ImageField'
import LogoPick from '../../components/LogoPick'

/** Edit one tournament team: name, tag, logo, "invited" flag and its players (name + photo). */
export default function TeamEditor({ team, onClose, onChanged }) {
  const [f, setF] = useState({ name: team.name, tag: team.tag || '', logo_url: team.logo_url || null, photo_url: team.photo_url || null, invited: !!team.invited })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [np, setNp] = useState({ name: '', photo: null })
  const players = useData(() => supabase.from('tournament_team_players').select('*').eq('team_id', team.id).order('sort').order('name'), [team.id])
  const P = players.data || []

  const saveTeam = async () => {
    if (!f.name.trim()) return setErr('Team name is required.')
    setBusy(true); setErr('')
    const { error } = await supabase.from('tournament_teams').update({ name: f.name.trim(), tag: f.tag.trim() || null, logo_url: f.logo_url || null, photo_url: f.photo_url || null, invited: f.invited }).eq('id', team.id)
    setBusy(false)
    if (error) return setErr(error.message)
    onChanged(); onClose()
  }
  // logo / team photo are saved the moment they are uploaded (no need to press "Save team")
  const saveImg = async (key, v) => {
    setF((o) => ({ ...o, [key]: v }))
    setErr('')
    const { error } = await supabase.from('tournament_teams').update({ [key]: v || null }).eq('id', team.id)
    if (error) return setErr(error.message)
    onChanged()
  }
  const addPlayer = async () => {
    const name = np.name.trim()
    if (!name) return
    setErr('')
    const { error } = await supabase.from('tournament_team_players').insert({ team_id: team.id, tournament_id: team.tournament_id, name, photo_url: np.photo || null, sort: P.length + 1 })
    if (error) return setErr(error.message)
    setNp({ name: '', photo: null }); players.reload()
  }
  const patchPlayer = async (p, patch) => {
    const { error } = await supabase.from('tournament_team_players').update(patch).eq('id', p.id)
    if (error) return setErr(error.message)
    players.reload()
  }
  const removePlayer = async (p) => {
    await supabase.from('tournament_team_players').delete().eq('id', p.id)
    players.reload()
  }

  return (
    <Modal title={`Team — ${team.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Team name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Team tag (short, e.g. NMR)"><input className="input" maxLength={8} value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value.toUpperCase() })} placeholder="NMR" /></Field>
        </div>
        <ImageField label="Team logo" folder="team" value={f.logo_url} onChange={(v) => saveImg('logo_url', v)} />
        <ImageField label="Team photo (squad picture, shown big on the current-standings page when the team is #1)" folder="teamphoto" value={f.photo_url} onChange={(v) => saveImg('photo_url', v)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.invited} onChange={(e) => setF({ ...f, invited: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--accent))]" />
          Invited team (skips the first draw and joins a later round you choose)
        </label>

        <div>
          <div className="label">Players</div>
          {players.loading ? <Spinner /> : (
            <ul className="space-y-1.5">
              {P.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <LogoPick size={40} value={p.photo_url} onChange={(u) => patchPlayer(p, { photo_url: u })} title="Player photo" />
                  <input className="input" defaultValue={p.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.name) patchPlayer(p, { name: v }) }} />
                  <button type="button" className="btn-ghost btn-sm text-red-300" onClick={() => removePlayer(p)}><Trash2 size={13} /></button>
                </li>
              ))}
              {!P.length && <li className="text-xs text-slate-500">No players added yet.</li>}
            </ul>
          )}
          <div className="mt-2 flex items-center gap-2">
            <LogoPick size={40} value={np.photo} onChange={(u) => setNp({ ...np, photo: u })} title="Player photo (optional)" />
            <input className="input" placeholder="Player name" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPlayer() } }} />
            <button type="button" className="btn-primary btn-sm shrink-0" disabled={!np.name.trim()} onClick={addPlayer}><Plus size={14} /> Add player</button>
          </div>
        </div>

        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
          <button type="button" className="btn-primary" disabled={busy} onClick={saveTeam}>{busy ? 'Saving…' : 'Save team'}</button>
        </div>
      </div>
    </Modal>
  )
}

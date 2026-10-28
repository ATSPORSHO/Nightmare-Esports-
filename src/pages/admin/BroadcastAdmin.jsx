import { useEffect, useRef, useState } from 'react'
import { Radio, Copy, Undo2, RotateCcw, Square, Minus, Plus, Trash2, Play } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { Card, ErrorBox, Field, Notice, Spinner } from '../../components/ui'
import LiveScorecard from '../../components/LiveScorecard'
import { computeRows, LIVE_THEMES } from '../../lib/live'

const linkOf = (id, theme) => `${window.location.origin}${window.location.pathname}#/live/${id}${theme ? `?theme=${theme}` : ''}`

/**
 * Broadcast: every session gets its own link. While it is live the scorecard updates by itself on the link.
 * Automatic = one-click buttons (kill +1, Eliminate), placement and points are worked out for you.
 * Manual = you type kills / placement / point adjustments yourself.
 * End = the live data is deleted from the broadcast, only the final result is kept in "Final reports".
 */
export default function BroadcastAdmin() {
  const tours = useData(() => supabase.from('tournaments').select('id, title').order('start_date', { ascending: false }))
  const sessions = useData(() => supabase.from('tbroadcast_sessions').select('*').eq('status', 'live').order('created_at', { ascending: false }))
  const finals = useData(() => supabase.from('tbroadcast_finals').select('*').order('ended_at', { ascending: false }))
  const [openId, setOpenId] = useState(null)
  const [msg, setMsg] = useState('')
  const open = (sessions.data || []).find((s) => s.id === openId)

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Create a broadcast session, copy its link into OBS (Browser Source) or open it in a browser, and run the scorecard from here. When you press <b>End</b> the live data disappears from the link and only the final result is saved under <b>Final reports</b>.</p>
      {msg && <Notice>{msg}</Notice>}
      {open
        ? <Control key={open.id} session={open} onClose={() => setOpenId(null)} onEnded={(m) => { setMsg(m); setOpenId(null); sessions.reload(); finals.reload() }} />
        : (
          <>
            <NewSession tours={tours.data || []} onCreated={(id) => { sessions.reload(); setOpenId(id) }} />
            <Card title="Live sessions" icon={Radio}>
              {sessions.loading ? <Spinner /> : !(sessions.data || []).length ? <div className="py-4 text-center text-sm text-slate-500">No live session. Create one above.</div> : (
                <ul className="divide-y divide-ink-700/60">
                  {sessions.data.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                      <div className="min-w-[160px] flex-1"><div className="font-medium text-white">{s.title}</div><div className="text-xs text-slate-500">{s.mode === 'auto' ? 'Automatic' : 'Manual'} · {(s.state?.teams || []).length} teams · started {new Date(s.created_at).toLocaleString('en-GB')}</div></div>
                      <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(linkOf(s.id, s.theme))}><Copy size={13} /> Copy link</button>
                      <button className="btn-primary btn-sm" onClick={() => setOpenId(s.id)}><Play size={13} /> Open controls</button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      <FinalReports finals={finals} />
    </div>
  )
}

function NewSession({ tours, onCreated }) {
  const [tid, setTid] = useState('')
  const [rid, setRid] = useState('')
  const [gid, setGid] = useState('')
  const [mode, setMode] = useState('auto')
  const [theme, setTheme] = useState('blue')
  const [title, setTitle] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const rounds = useData(() => (tid ? supabase.from('tournament_rounds').select('*').eq('tournament_id', tid).order('sort') : Promise.resolve({ data: [] })), [tid])
  const groups = useData(() => (tid ? supabase.from('tournament_groups').select('*').eq('tournament_id', tid).order('sort') : Promise.resolve({ data: [] })), [tid])
  const R = rounds.data || []
  const G = (groups.data || []).filter((g) => !rid || g.round_id === rid)
  const group = G.find((g) => g.id === gid)

  const create = async () => {
    setErr('')
    if (!tid || !group) return setErr('Choose the tournament and the group first.')
    setBusy(true)
    const gt = await supabase.from('tournament_group_teams').select('team_id, slot').eq('group_id', group.id)
    const ids = (gt.data || []).map((x) => x.team_id)
    const tm = ids.length ? await supabase.from('tournament_teams').select('*').in('id', ids) : { data: [] }
    const slotOf = Object.fromEntries((gt.data || []).map((x) => [x.team_id, x.slot || 99]))
    const teams = (tm.data || []).sort((a, b) => slotOf[a.id] - slotOf[b.id]).map((t) => ({ id: t.id, name: t.name, tag: t.tag || '', logo: t.logo_url || '', country: t.country || '', kills: 0, placement: null, adj: 0, pl: ['a', 'a', 'a', 'a'] }))
    if (!teams.length) { setBusy(false); return setErr('This group has no teams yet.') }
    const ttl = tours.find((t) => t.id === tid)?.title
    const { data, error } = await supabase.from('tbroadcast_sessions').insert({
      tournament_id: tid, group_id: group.id, title: title.trim() || `${ttl} · ${group.name}`, mode, theme, state: { teams, history: [], group: group.name },
    }).select('id').single()
    setBusy(false)
    if (error) return setErr(/tbroadcast_sessions|schema cache/i.test(error.message) ? 'Run supabase/broadcast.sql once in Supabase (SQL Editor), then try again.' : error.message)
    onCreated(data.id)
  }

  return (
    <Card title="New broadcast session" icon={Radio}>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Tournament"><select className="input" value={tid} onChange={(e) => { setTid(e.target.value); setRid(''); setGid('') }}><option value="">— choose —</option>{tours.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></Field>
        <Field label="Round"><select className="input" value={rid} onChange={(e) => { setRid(e.target.value); setGid('') }} disabled={!tid}><option value="">All rounds</option>{R.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        <Field label="Group (its teams play this match)"><select className="input" value={gid} onChange={(e) => setGid(e.target.value)} disabled={!tid}><option value="">— choose —</option>{G.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
        <Field label="Title on the scorecard (optional)"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nightmare Invitational · Group A · Match 1" /></Field>
        <Field label="Theme"><select className="input" value={theme} onChange={(e) => setTheme(e.target.value)}>{Object.entries(LIVE_THEMES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></Field>
        <Field label="Broadcast mode">
          <div className="flex overflow-hidden rounded-lg border border-ink-600">
            {[['auto', 'Automatic'], ['manual', 'Manual']].map(([k, l]) => <button type="button" key={k} onClick={() => setMode(k)} className={`flex-1 px-3 py-2 text-sm font-semibold ${mode === k ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-700'}`}>{l}</button>)}
          </div>
        </Field>
      </div>
      <p className="mt-2 text-[11px] text-slate-500"><b>Automatic:</b> click “+1 kill” and “Eliminate”; placements and points are worked out for you (alive teams already count the placement points they are guaranteed). <b>Manual:</b> you type kills, placement and point adjustments yourself. You can switch while live.</p>
      <ErrorBox>{err}</ErrorBox>
      <div className="mt-3"><button className="btn-primary" disabled={busy} onClick={create}><Radio size={15} /> {busy ? 'Creating…' : 'Create session & get link'}</button></div>
    </Card>
  )
}

/** Number box that only changes the live scoreboard when you press Enter (Esc cancels). */
function EnterNum({ value, onCommit, className = '', ...rest }) {
  const [d, setD] = useState(null)
  const shown = d ?? (value ?? '')
  return <input {...rest} type="number" className={`${className} ${d !== null ? '!border-amber-400' : ''}`} value={shown}
    onChange={(e) => setD(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter') { onCommit(d ?? shown); setD(null); e.target.blur() } if (e.key === 'Escape') { setD(null); e.target.blur() } }}
    onBlur={() => setD(null)} title="Type, then press Enter to send to the live scoreboard" />
}

function Control({ session, onClose, onEnded }) {
  const [st, setSt] = useState(session.state || { teams: [], history: [] })
  const [mode, setMode] = useState(session.mode)
  const [theme, setTheme] = useState(session.theme)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)
  const latest = useRef({ st, mode, theme })
  latest.current = { st, mode, theme }

  // push every change to the live link (small delay so fast clicks are sent together)
  const dirty = useRef(false)
  const push = () => {
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const { st: s, mode: m, theme: t } = latest.current
      const { error } = await supabase.from('tbroadcast_sessions').update({ state: s, mode: m, theme: t, updated_at: new Date().toISOString() }).eq('id', session.id)
      if (error) setErr(error.message); else { setErr(''); dirty.current = false }
    }, 250)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  const update = (fn) => { setSt((o) => fn(o)); push() }

  const alive = st.teams.filter((t) => t.placement == null || t.placement === '').length
  const patch = (id, p) => update((o) => ({ ...o, teams: o.teams.map((t) => (t.id === id ? { ...t, ...p } : t)) }))
  const kill = (id, d) => patch(id, { kills: Math.max(0, (Number(st.teams.find((t) => t.id === id).kills) || 0) + d) })
  const [pend, setPend] = useState(null) // { id, value } — rank typed when eliminating
  const eliminate = (id, rank) => update((o) => ({ ...o, teams: o.teams.map((t) => (t.id === id ? { ...t, placement: Number(rank) || alive, pl: ['d', 'd', 'd', 'd'] } : t)), history: [...(o.history || []), id] }))
  const undo = () => update((o) => {
    const h = [...(o.history || [])]; const last = h.pop()
    return last ? { ...o, history: h, teams: o.teams.map((t) => (t.id === last ? { ...t, placement: null, pl: ['a', 'a', 'a', 'a'] } : t)) } : o
  })
  const reset = () => { if (window.confirm('Reset kills, eliminations and adjustments for all teams?')) update((o) => ({ ...o, history: [], teams: o.teams.map((t) => ({ ...t, kills: 0, placement: null, adj: 0, pl: ['a', 'a', 'a', 'a'] })) })) }
  const setMd = (m) => { setMode(m); push() }
  const setTh = (t) => { setTheme(t); push() }
  const link = linkOf(session.id, theme)

  const end = async () => {
    if (!window.confirm('End this broadcast?\n\nThe live scorecard and its link are deleted. Only the final result is saved in Final reports.')) return
    setBusy(true); setErr('')
    clearTimeout(timer.current)
    // teams still alive at the end get the best placements, ordered by kills
    const fin = { ...st, teams: st.teams.map((t) => ({ ...t })) }
    const stillAlive = fin.teams.filter((t) => t.placement == null || t.placement === '').sort((a, b) => (Number(b.kills) || 0) - (Number(a.kills) || 0))
    stillAlive.forEach((t, i) => { t.placement = i + 1 })
    const rows = computeRows(fin, 'manual').map((r) => ({ rank: r.rank, team: r.name, tag: r.tag, country: r.country, placement: r.placement, kills: r.kills, pp: r.pp, adj: Number(r.adj) || 0, tp: r.tp }))
    const tr = session.tournament_id ? await supabase.from('tournaments').select('title').eq('id', session.tournament_id).maybeSingle() : { data: null }
    const ins = await supabase.from('tbroadcast_finals').insert({ tournament_id: session.tournament_id, tournament_title: tr.data?.title || null, group_name: st.group || null, title: session.title, mode, final: rows, started_at: session.created_at })
    if (ins.error) { setBusy(false); return setErr(/tbroadcast_finals|schema cache/i.test(ins.error.message) ? 'Run supabase/broadcast.sql once in Supabase (SQL Editor).' : ins.error.message) }
    const del = await supabase.from('tbroadcast_sessions').delete().eq('id', session.id)
    setBusy(false)
    if (del.error) return setErr(`The final result was saved, but the live session could not be deleted: ${del.error.message}`)
    onEnded(`Broadcast “${session.title}” ended. The live data was deleted and the final result is saved in Final reports.`)
  }

  const rows = computeRows(st, mode)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-600 bg-ink-850 p-3">
        <span className="flex items-center gap-2 font-semibold text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> {session.title}</span>
        <input readOnly className="input !w-auto min-w-[260px] flex-1 !py-1 text-xs" value={link} onFocus={(e) => e.target.select()} />
        <button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }}><Copy size={13} /> {copied ? 'Copied ✓' : 'Copy link'}</button>
        <div className="flex overflow-hidden rounded-lg border border-ink-600">
          {[['auto', 'Automatic'], ['manual', 'Manual']].map(([k, l]) => <button key={k} onClick={() => setMd(k)} className={`px-3 py-1.5 text-xs font-semibold ${mode === k ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-700'}`}>{l}</button>)}
        </div>
        <select className="input !w-auto !py-1 text-xs" value={theme} onChange={(e) => setTh(e.target.value)}>{Object.entries(LIVE_THEMES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select>
        <button className="btn-ghost btn-sm" onClick={onClose}>Back</button>
        <button className="btn-primary btn-sm !bg-red-700" disabled={busy} onClick={end}><Square size={13} /> End broadcast</button>
      </div>
      <ErrorBox>{err}</ErrorBox>
      <div className="grid gap-4 xl:grid-cols-[1fr_580px]">
        <div className="rounded-xl border border-ink-700">
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-950 px-3 py-2 text-xs text-slate-400">
            <span>{alive} of {st.teams.length} alive</span>
            <span className="ml-auto flex gap-2">
              {mode === 'auto' && <button className="btn-ghost btn-sm" onClick={undo} disabled={!(st.history || []).length}><Undo2 size={13} /> Undo last elimination</button>}
              <button className="btn-ghost btn-sm" onClick={reset}><RotateCcw size={13} /> Reset</button>
            </span>
          </div>
          <div className="max-h-[640px] divide-y divide-ink-700/60 overflow-y-auto">
            {st.teams.map((t) => {
              const isAlive = t.placement == null || t.placement === ''
              return (
                <div key={t.id} className={`flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm ${isAlive ? '' : 'opacity-60'}`}>
                  <span className="flex min-w-[130px] flex-1 items-center gap-2">
                    {t.logo ? <img src={t.logo} alt="" className="h-6 w-6 rounded-full bg-white object-contain" /> : <span className="h-6 w-6 rounded-full bg-ink-700" />}
                    <span className="truncate font-medium text-white">{t.tag || t.name}</span>
                  </span>
                  {mode === 'auto' ? (
                    <>
                      <button className="btn-ghost btn-sm !px-2" onClick={() => kill(t.id, -1)}><Minus size={12} /></button>
                      <span className="w-8 text-center font-display text-lg font-extrabold text-white">{Number(t.kills) || 0}</span>
                      <button className="btn-primary btn-sm !px-2" onClick={() => kill(t.id, 1)}><Plus size={12} /> kill</button>
                      {isAlive
                        ? (pend?.id === t.id
                          ? <span className="flex w-40 items-center gap-1"><span className="text-[10px] text-slate-400">Rank</span><input autoFocus className="input !w-12 !px-1 !py-0.5 text-center" type="number" min="1" max="25" value={pend.value} onChange={(e) => setPend({ id: t.id, value: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { eliminate(t.id, pend.value); setPend(null) } if (e.key === 'Escape') setPend(null) }} /><button className="btn-primary btn-sm !px-2 !bg-red-700" onClick={() => { eliminate(t.id, pend.value); setPend(null) }}>OK</button><button className="btn-ghost btn-sm !px-1" onClick={() => setPend(null)}>✕</button></span>
                          : <button className="btn-ghost btn-sm w-28 text-red-300" onClick={() => setPend({ id: t.id, value: alive })}>Eliminate</button>)
                        : <span className="w-28 text-center text-xs font-bold text-red-400">OUT · #{t.placement}</span>}
                    </>
                  ) : (
                    <>
                      <label className="text-[10px] text-slate-500">Kills <EnterNum className="input !w-14 !px-1 !py-0.5 text-center" min="0" value={t.kills ?? 0} onCommit={(v) => patch(t.id, { kills: Math.max(0, Number(v) || 0) })} /></label>
                      <label className="text-[10px] text-slate-500">Place <EnterNum className="input !w-14 !px-1 !py-0.5 text-center" min="1" max="25" placeholder="alive" value={t.placement ?? ''} onCommit={(v) => patch(t.id, { placement: v === '' ? null : Number(v), pl: v === '' ? undefined : ['d', 'd', 'd', 'd'] })} /></label>
                      <label className="text-[10px] text-slate-500">± pts <EnterNum className="input !w-14 !px-1 !py-0.5 text-center" value={t.adj ?? 0} onCommit={(v) => patch(t.id, { adj: Number(v) || 0 })} /></label>
                    </>
                  )}
                  {isAlive && <span className="flex gap-0.5" title="Players: click to change alive → knocked → out">{[0, 1, 2, 3].map((i) => { const c = (t.pl || [])[i] || 'a'; return <button key={i} type="button" onClick={() => patch(t.id, { pl: [0, 1, 2, 3].map((j) => (j === i ? { a: 'k', k: 'd', d: 'a' }[c] : (t.pl || [])[j] || 'a')) })} className="h-5 w-2.5 rounded-sm" style={{ background: c === 'a' ? '#22c55e' : c === 'k' ? '#ef4444' : '#5b6270' }} /> })}</span>}
                  <span className="w-10 text-right font-display text-lg font-extrabold text-amber-300" title="Points">{rows.find((r) => r.id === t.id)?.tp}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-950 p-3">
          <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">Preview (what viewers see)</div>
          <div className="overflow-x-auto"><LiveScorecard title={session.title} state={st} mode={mode} theme={theme} width={540} /></div>
        </div>
      </div>
    </div>
  )
}

function FinalReports({ finals }) {
  const [openId, setOpenId] = useState(null)
  const list = finals.data || []
  const remove = async (f) => { if (window.confirm(`Delete the final report “${f.title}”?`)) { await supabase.from('tbroadcast_finals').delete().eq('id', f.id); finals.reload() } }
  return (
    <Card title="Final reports (saved when a broadcast ends)">
      {finals.loading ? <Spinner /> : !list.length ? <div className="py-4 text-center text-sm text-slate-500">No final reports yet.</div> : (
        <ul className="divide-y divide-ink-700/60">
          {list.map((f) => (
            <li key={f.id} className="py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[180px] flex-1"><div className="font-medium text-white">{f.title}</div><div className="text-xs text-slate-500">{f.tournament_title || ''} {f.group_name ? `· ${f.group_name}` : ''} · {new Date(f.ended_at).toLocaleString('en-GB')} · {f.mode === 'auto' ? 'Automatic' : 'Manual'}</div></div>
                <button className="btn-ghost btn-sm" onClick={() => setOpenId(openId === f.id ? null : f.id)}>{openId === f.id ? 'Hide' : 'View'}</button>
                <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(f)}><Trash2 size={13} /></button>
              </div>
              {openId === f.id && (
                <div className="mt-2 overflow-x-auto rounded-lg border border-ink-700">
                  <table className="w-full text-sm">
                    <thead className="bg-ink-950 text-[11px] uppercase tracking-wider text-slate-400"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Team</th><th className="px-2 py-2">Place</th><th className="px-2 py-2">Elims</th><th className="px-2 py-2">PP</th><th className="px-2 py-2">± </th><th className="px-2 py-2">Total</th></tr></thead>
                    <tbody>{(f.final || []).map((r) => (
                      <tr key={r.rank} className="border-t border-ink-700/60"><td className="px-3 py-1.5 font-bold text-slate-300">{r.rank}</td><td className="px-3 py-1.5">{r.team}{r.tag ? ` [${r.tag}]` : ''}</td><td className="px-2 py-1.5 text-center">{r.placement}</td><td className="px-2 py-1.5 text-center">{r.kills}</td><td className="px-2 py-1.5 text-center">{r.pp}</td><td className="px-2 py-1.5 text-center">{r.adj || 0}</td><td className="px-2 py-1.5 text-center font-bold text-white">{r.tp}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

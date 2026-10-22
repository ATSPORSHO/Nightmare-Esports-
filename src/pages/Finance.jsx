import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/hooks'
import { useAuth } from '../context/AuthContext'
import { useLineup } from '../context/LineupContext'
import LineupSelect from '../components/LineupSelect'
import { useSettings } from '../context/SettingsContext'
import { EXPENSE_CATEGORIES, INCOME_TYPES } from '../lib/constants'
import { num, todayStr } from '../lib/format'
import { Card, ErrorBox, Field, Modal, PageHeader, Spinner } from '../components/ui'

/**
 * Finance.  Everyone logged in can VIEW.  Only the admin sees the
 * add / edit / delete buttons (and the database enforces it too).
 */
export default function Finance() {
  const { isAdmin } = useAuth()
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const { activeLineups, lineupName } = useLineup()
  const multi = activeLineups.length > 1
  const [lineupFilter, setLineupFilter] = useState('all')
  const [tab, setTab] = useState('expenses')
  const [editing, setEditing] = useState(null)

  const exp = useData(() => supabase.from('expenses').select('*').order('spent_on', { ascending: false }))
  const inc = useData(() => supabase.from('income').select('*').order('received_on', { ascending: false }))

  useEffect(() => {
    if (isAdmin && params.get('new')) { setEditing({}); setParams({}, { replace: true }) }
  }, [params, isAdmin, setParams])

  const isExp = tab === 'expenses'
  const cur = isExp ? exp : inc
  const pick = (arr) => (arr || []).filter((r) => lineupFilter === 'all' || r.lineup_id === lineupFilter)
  const rows = pick(cur.data)
  const total = (arr) => pick(arr).reduce((t, r) => t + Number(r.amount), 0)

  const remove = async (r) => {
    if (!window.confirm('Delete this entry?')) return
    await supabase.from(tab === 'expenses' ? 'expenses' : 'income').delete().eq('id', r.id)
    cur.reload()
  }

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle={isAdmin ? 'Only you (admin) can add, change or delete entries.' : 'View only — finance entries can only be changed by the admin.'}
        actions={isAdmin && <button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add {isExp ? 'expense' : 'income'}</button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card"><div className="text-xs text-slate-400">Total income ({settings.currency})</div><div className="font-display text-3xl font-bold text-white">{num(total(inc.data))}</div></div>
        <div className="card"><div className="text-xs text-slate-400">Total expenses ({settings.currency})</div><div className="font-display text-3xl font-bold text-white">{num(total(exp.data))}</div></div>
        <div className="card"><div className="text-xs text-slate-400">Net balance ({settings.currency})</div><div className="font-display text-3xl font-bold text-emerald-400">{num(total(inc.data) - total(exp.data))}</div></div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {['expenses', 'income'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`btn btn-sm capitalize ${tab === t ? 'bg-accent text-white' : 'border border-ink-600 text-slate-300'}`}>{t}</button>
        ))}
        {multi && (
          <select className="input !w-auto" value={lineupFilter} onChange={(e) => setLineupFilter(e.target.value)}>
            <option value="all">All lineups</option>
            {activeLineups.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
      </div>

      <ErrorBox>{cur.error}</ErrorBox>
      <Card className="overflow-x-auto">
        {cur.loading ? <Spinner /> : (
          <table className="tbl">
            <thead><tr><th>Date</th>{multi && <th>Lineup</th>}<th>{isExp ? 'Category' : 'Type'}</th><th>Description</th><th className="text-right">Amount ({settings.currency})</th>{isAdmin && <th />}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.spent_on || r.received_on}</td>{multi && <td>{lineupName(r.lineup_id)}</td>}<td>{r.category || r.type}</td><td>{r.description}</td>
                  <td className="text-right font-semibold text-white">{num(r.amount)}</td>
                  {isAdmin && (
                    <td className="text-right">
                      <button className="btn-ghost btn-sm mr-1" onClick={() => setEditing(r)}><Pencil size={13} /></button>
                      <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(r)}><Trash2 size={13} /></button>
                    </td>
                  )}
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Nothing recorded yet.</td></tr>}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <EntryForm kind={tab} row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); cur.reload() }} />
      )}
    </div>
  )
}

function EntryForm({ kind, row, onClose, onSaved }) {
  const isExp = kind === 'expenses'
  const { activeLineups } = useLineup()
  const [f, setF] = useState({
    lineup_id: row.id ? (row.lineup_id || '') : (activeLineups[0]?.id || ''),
    date: row.spent_on || row.received_on || todayStr(),
    cat: row.category || row.type || (isExp ? EXPENSE_CATEGORIES[0] : INCOME_TYPES[0]),
    description: row.description || '',
    amount: row.amount ?? '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const payload = isExp
      ? { spent_on: f.date, category: f.cat, description: f.description, amount: Number(f.amount), lineup_id: f.lineup_id || null }
      : { received_on: f.date, type: f.cat, description: f.description, amount: Number(f.amount), lineup_id: f.lineup_id || null }
    const q = supabase.from(kind)
    const { error } = row.id ? await q.update(payload).eq('id', row.id) : await q.insert(payload)
    setBusy(false)
    if (error) setErr(error.message)
    else onSaved()
  }

  return (
    <Modal title={`${row.id ? 'Edit' : 'Add'} ${isExp ? 'expense' : 'income'}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date"><input className="input" type="date" required value={f.date} onChange={set('date')} /></Field>
          <Field label={isExp ? 'Category' : 'Type'}>
            <select className="input" value={f.cat} onChange={set('cat')}>
              {(isExp ? EXPENSE_CATEGORIES : INCOME_TYPES).map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label={isExp ? 'Which lineup is this cost for?' : 'Which lineup is this income for?'}>
          <LineupSelect value={f.lineup_id} allowShared sharedLabel="Organization (shared)" onChange={(v) => setF({ ...f, lineup_id: v })} />
        </Field>
        <Field label="Description"><input className="input" value={f.description} onChange={set('description')} /></Field>
        <Field label="Amount"><input className="input" type="number" min="0" step="any" required value={f.amount} onChange={set('amount')} /></Field>
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

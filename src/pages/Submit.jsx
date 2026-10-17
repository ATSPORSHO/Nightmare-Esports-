import { useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ImagePlus, X, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useData } from '../lib/hooks'
import { timeAgo } from '../lib/format'
import { Card, ErrorBox, Field, PageHeader } from '../components/ui'

const KINDS = {
  screenshot: {
    kind: 'pubg_screenshot',
    title: 'Analyze PUBG Screenshot',
    subtitle: 'Upload your match result / scoreboard screenshots. They are saved straight into the admin panel.',
    noteLabel: 'Match / tournament (optional)',
  },
  training: {
    kind: 'training_screenshot',
    title: 'Add Training Screenshot',
    subtitle: 'Upload all your screenshots from today\'s training. They are saved straight into the admin panel.',
    noteLabel: 'Session name (optional)',
  },
}

const MAX_FILES = 12
const MAX_MB = 10

export default function Submit() {
  const { kind: param } = useParams()
  const cfg = KINDS[param]
  const { session } = useAuth()
  const input = useRef(null)
  const [files, setFiles] = useState([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const mine = useData(() => cfg
    ? supabase.from('submissions').select('*').eq('user_id', session.user.id).eq('kind', cfg.kind).order('created_at', { ascending: false }).limit(8)
    : Promise.resolve({ data: [] }), [param])

  if (!cfg) return <Navigate to="/" replace />

  const pick = (e) => {
    const list = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'))
    const merged = [...files, ...list].slice(0, MAX_FILES)
    setFiles(merged)
    setDone(false)
    e.target.value = ''
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!files.length) return setErr('Choose at least one screenshot.')
    if (files.some((f) => f.size > MAX_MB * 1024 * 1024)) return setErr(`Each image must be under ${MAX_MB} MB.`)
    setBusy(true); setErr('')
    const uid = session.user.id
    const paths = []
    for (const f of files) {
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage.from('submissions').upload(path, f, { contentType: f.type })
      if (error) { setErr(`Upload failed: ${error.message}`); setBusy(false); return }
      paths.push(path)
    }
    const { error } = await supabase.from('submissions').insert({ kind: cfg.kind, file_paths: paths, note: note || null })
    setBusy(false)
    if (error) return setErr(error.message)
    setFiles([]); setNote(''); setDone(true)
    mine.reload()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={cfg.title} subtitle={cfg.subtitle} />
      <form onSubmit={submit} className="space-y-4">
        <Card>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-600 py-10 text-slate-300 transition hover:border-accent hover:bg-accent/5"
          >
            <ImagePlus size={32} className="text-accent" />
            <span className="font-semibold text-white">Tap to choose screenshots</span>
            <span className="text-xs text-slate-500">Up to {MAX_FILES} images · {MAX_MB} MB each</span>
          </button>
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={pick} />

          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {files.map((f, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-ink-600">
                  <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Field label={cfg.noteLabel}><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <ErrorBox>{err}</ErrorBox>
        {done && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            <CheckCircle2 size={18} /> Submitted! Your admin can now see it.
          </div>
        )}
        <button className="btn-primary w-full py-3" disabled={busy || !files.length}>
          {busy ? 'Uploading…' : `Submit ${files.length || ''} screenshot${files.length === 1 ? '' : 's'}`}
        </button>
      </form>

      {mine.data?.length > 0 && (
        <Card title="Your recent submissions" className="mt-6">
          <ul className="divide-y divide-ink-700/60 text-sm">
            {mine.data.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span>{s.file_paths.length} image{s.file_paths.length === 1 ? '' : 's'}{s.note ? ` · ${s.note}` : ''}</span>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  {timeAgo(s.created_at)}
                  <span className={s.status === 'reviewed' ? 'badge-green' : 'badge-amber'}>{s.status === 'reviewed' ? 'Reviewed' : 'Sent'}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

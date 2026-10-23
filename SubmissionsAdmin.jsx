import { useEffect, useState } from 'react'
import { CheckCheck, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/hooks'
import { timeAgo } from '../../lib/format'
import { Card, Empty, ErrorBox, Spinner } from '../../components/ui'

const KIND_LABEL = { pubg_screenshot: 'PUBG screenshot', training_screenshot: 'Training screenshot' }

/** Everything players upload lands here. Files live in a private bucket, so we sign short-lived URLs. */
export default function SubmissionsAdmin() {
  const [filter, setFilter] = useState('all')
  const { data, loading, error, reload } = useData(() =>
    supabase.from('submissions').select('*, profiles(full_name, ign)').order('created_at', { ascending: false }).limit(100))
  const [urls, setUrls] = useState({})
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    const paths = (data || []).flatMap((s) => s.file_paths).filter((p) => !urls[p])
    if (!paths.length) return
    supabase.storage.from('submissions').createSignedUrls(paths, 3600).then(({ data: signed }) => {
      const next = { ...urls }
      ;(signed || []).forEach((x) => { if (x.signedUrl) next[x.path] = x.signedUrl })
      setUrls(next)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const rows = (data || []).filter((s) => filter === 'all' || (filter === 'new' ? s.status === 'new' : s.kind === filter))

  const markReviewed = async (s) => {
    await supabase.from('submissions').update({ status: s.status === 'new' ? 'reviewed' : 'new' }).eq('id', s.id)
    reload()
  }
  const remove = async (s) => {
    if (!window.confirm('Delete this submission and its images?')) return
    await supabase.storage.from('submissions').remove(s.file_paths)
    await supabase.from('submissions').delete().eq('id', s.id)
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[['all', 'All'], ['new', 'Not reviewed'], ['pubg_screenshot', 'PUBG screenshots'], ['training_screenshot', 'Training screenshots']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`btn btn-sm ${filter === k ? 'bg-accent text-white' : 'border border-ink-600 text-slate-300'}`}>{l}</button>
        ))}
      </div>
      <ErrorBox>{error}</ErrorBox>
      {loading ? <Spinner /> : !rows.length ? <Card><Empty>No submissions yet.</Empty></Card> : (
        <div className="space-y-3">
          {rows.map((s) => (
            <Card key={s.id}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{s.profiles?.ign || s.profiles?.full_name || 'Player'}</span>
                <span className="badge-accent">{KIND_LABEL[s.kind]}</span>
                <span className="text-xs text-slate-500">{timeAgo(s.created_at)} · {new Date(s.created_at).toLocaleString()}</span>
                {s.note && <span className="text-sm text-slate-300">· {s.note}</span>}
                <div className="ml-auto flex items-center gap-2">
                  <span className={s.status === 'new' ? 'badge-amber' : 'badge-green'}>{s.status === 'new' ? 'New' : 'Reviewed'}</span>
                  <button className="btn-ghost btn-sm" onClick={() => markReviewed(s)}><CheckCheck size={13} /> {s.status === 'new' ? 'Mark reviewed' : 'Mark new'}</button>
                  <button className="btn-ghost btn-sm text-red-300" onClick={() => remove(s)}><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                {s.file_paths.map((p) => (
                  <button key={p} onClick={() => urls[p] && setLightbox(urls[p])} className="aspect-square overflow-hidden rounded-lg border border-ink-600 bg-ink-950">
                    {urls[p] ? <img src={urls[p]} alt="" className="h-full w-full object-cover" /> : <Spinner className="mx-auto mt-8" />}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="dark-scope fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"><X /></button>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}

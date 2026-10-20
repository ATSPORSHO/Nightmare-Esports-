import { useState } from 'react'
import { Upload, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ErrorBox } from './ui'

/** Upload an image into the public "branding" bucket (admin only) and return its URL via onChange. */
export default function ImageField({ label, value, folder, onChange, hint }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr('')
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${folder}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('branding').upload(path, file, { contentType: file.type })
    setBusy(false)
    if (error) return setErr(error.message)
    onChange(supabase.storage.from('branding').getPublicUrl(path).data.publicUrl)
  }
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-850 p-2">
        <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded bg-ink-950">
          {value ? <img src={value} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-slate-600">none</span>}
        </div>
        <label className="btn-ghost btn-sm cursor-pointer">
          <Upload size={13} /> {busy ? 'Uploading…' : 'Upload'}
          <input type="file" accept="image/*" className="hidden" onChange={upload} />
        </label>
        {value && <button type="button" className="btn-ghost btn-sm text-red-300" onClick={() => onChange(null)}><Trash2 size={13} /></button>}
      </div>
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
      <ErrorBox>{err}</ErrorBox>
    </div>
  )
}

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'

/** Small square button: click to upload a (team) logo into the public "branding" bucket. Calls onChange(url). */
export default function LogoPick({ value, onChange, size = 28, title = 'Add / change logo' }) {
  const [busy, setBusy] = useState(false)
  const upload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `team-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
    const { error } = await supabase.storage.from('branding').upload(path, file, { contentType: file.type })
    setBusy(false)
    if (error) return window.alert(error.message)
    onChange(supabase.storage.from('branding').getPublicUrl(path).data.publicUrl)
  }
  return (
    <label title={title} className="flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed border-ink-600 bg-ink-950 hover:border-accent" style={{ width: size, height: size }}>
      {value ? <img src={value} alt="" className="max-h-full max-w-full object-contain" /> : <Plus size={Math.round(size / 2)} className={busy ? 'animate-pulse text-accent' : 'text-slate-500'} />}
      <input type="file" accept="image/*" className="hidden" onChange={upload} />
    </label>
  )
}

import { useState } from 'react'
import { Upload, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSettings } from '../../context/SettingsContext'
import { Card, ErrorBox, Field, Notice } from '../../components/ui'

const TIMEZONES = ['Asia/Dhaka', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Kathmandu', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Manila', 'Europe/Lisbon', 'Europe/London', 'America/New_York', 'UTC']

function ImageField({ label, value, folder, onChange, hint }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr('')
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
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

export default function Branding() {
  const { settings, reload } = useSettings()
  const [f, setF] = useState({ ...settings })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(''); setOk(false)
    const { id, ...rest } = f
    const { error } = await supabase.from('settings').upsert({ id: 1, ...rest })
    setBusy(false)
    if (error) return setErr(error.message)
    await reload()
    setOk(true)
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Card title="Team identity">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Team name"><input className="input" required value={f.team_name} onChange={set('team_name')} /></Field>
          <Field label="Header title (game / product)"><input className="input" value={f.app_title} onChange={set('app_title')} /></Field>
          <Field label="Header subtitle"><input className="input" value={f.app_subtitle} onChange={set('app_subtitle')} /></Field>
          <Field label="Dashboard sub-heading"><input className="input" value={f.dashboard_subtitle} onChange={set('dashboard_subtitle')} /></Field>
          <Field label="Footer text"><input className="input" value={f.footer_text} onChange={set('footer_text')} /></Field>
          <Field label="Accent colour">
            <div className="flex items-center gap-2">
              <input type="color" value={f.accent_color} onChange={set('accent_color')} className="h-10 w-14 cursor-pointer rounded border border-ink-600 bg-transparent" />
              <input className="input" value={f.accent_color} onChange={set('accent_color')} />
            </div>
          </Field>
          <Field label="Motivation quote (dashboard)"><input className="input" value={f.quote_text} onChange={set('quote_text')} /></Field>
          <Field label="Quote author"><input className="input" value={f.quote_author} onChange={set('quote_author')} /></Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <ImageField label="Team logo" folder="logo" value={f.logo_url} onChange={(v) => setF({ ...f, logo_url: v })} hint="Square PNG with transparent background works best." />
          <ImageField label="Header banner image" folder="banner" value={f.banner_url} onChange={(v) => setF({ ...f, banner_url: v })} hint="Wide image shown behind the header." />
          <ImageField label="Game logo (optional)" folder="game" value={f.game_logo_url} onChange={(v) => setF({ ...f, game_logo_url: v })} />
        </div>
      </Card>

      <Card title="Organization (home page)">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Organization name" hint="First word is shown big, the rest in red letters."><input className="input" value={f.org_name ?? ''} onChange={set('org_name')} placeholder="Nightmare Esports Organization" /></Field>
          <Field label="Welcome line"><input className="input" value={f.org_tagline ?? ''} onChange={set('org_tagline')} /></Field>
        </div>
        <div className="mt-4"><Field label="About the organization"><textarea className="input min-h-[90px]" value={f.org_about ?? ''} onChange={set('org_about')} /></Field></div>
      </Card>

      <Card title="Social media (shown on the home page, everyone can click them)">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Facebook link"><input className="input" placeholder="https://facebook.com/yourpage" value={f.social_facebook ?? ''} onChange={set('social_facebook')} /></Field>
          <Field label="Instagram link"><input className="input" placeholder="https://instagram.com/yourhandle" value={f.social_instagram ?? ''} onChange={set('social_instagram')} /></Field>
          <Field label="YouTube link"><input className="input" placeholder="https://youtube.com/@yourchannel" value={f.social_youtube ?? ''} onChange={set('social_youtube')} /></Field>
          <Field label="Discord invite link"><input className="input" placeholder="https://discord.gg/yourinvite" value={f.social_discord ?? ''} onChange={set('social_discord')} /></Field>
        </div>
        <p className="mt-2 text-xs text-slate-500">Leave a box empty to hide that icon. Run supabase/social-links.sql once before saving.</p>
      </Card>

      <Card title="Regional & links">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Currency code"><input className="input" value={f.currency} onChange={set('currency')} /></Field>
          <Field label="Team timezone" hint="Used for the clock and for reminder timing.">
            <select className="input" value={f.timezone} onChange={set('timezone')}>
              {[...new Set([f.timezone, ...TIMEZONES])].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Website URL" hint="Your GitHub Pages address. Needed for the one-click e-mail button.">
            <input className="input" placeholder="https://username.github.io/repo" value={f.app_url || ''} onChange={set('app_url')} />
          </Field>
        </div>
      </Card>

      <Card title="Guest access (people who are not logged in)">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.guest_enabled} onChange={set('guest_enabled')} />
          Allow guests to view the dashboard (guests can never see any other page)
        </label>
        <label className="mt-3 flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.guest_show_finance} disabled={!f.guest_enabled} onChange={set('guest_show_finance')} />
          Also show the finance widgets (income, expenses, balance) to guests
        </label>
        <p className="mt-2 text-xs text-slate-500">Guests never see phone numbers, e-mails, salaries or training costs. These switches are enforced in the database, not just on screen.</p>
      </Card>

      <ErrorBox>{err}</ErrorBox>
      {ok && <Notice>Saved. The whole site has been updated.</Notice>}
      <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    </form>
  )
}

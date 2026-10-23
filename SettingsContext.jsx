import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { hexToRgbTriplet } from '../lib/format'

const SettingsCtx = createContext(null)
export const useSettings = () => useContext(SettingsCtx)

const DEFAULTS = {
  team_name: 'Team Hub',
  app_title: 'PUBG MOBILE',
  app_subtitle: 'Team Management & Analytics',
  dashboard_subtitle: "Overview of your team's performance, finances and training progress.",
  logo_url: null,
  game_logo_url: null,
  banner_url: null,
  accent_color: '#c8102e',
  footer_text: 'All rights reserved.',
  quote_text: '',
  quote_author: '',
  currency: 'BDT',
  timezone: 'Asia/Dhaka',
  app_url: '',
  guest_enabled: true,
  guest_show_finance: false,
  reminder_enabled: false,
  reminder_hours_before: 2,
  reminder_subject: '',
  reminder_message: '',
}

/** Everything you edit in Admin Panel → Branding flows through here into the whole site. */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [ready, setReady] = useState(false)

  const reload = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle()
    if (data) setSettings({ ...DEFAULTS, ...data })
    setReady(true)
  }, [])

  useEffect(() => { reload() }, [reload])

  // apply accent colour, tab title and favicon
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', hexToRgbTriplet(settings.accent_color))
    document.title = `${settings.team_name} · ${settings.app_title}`
    if (settings.logo_url) document.getElementById('favicon')?.setAttribute('href', settings.logo_url)
  }, [settings])

  return <SettingsCtx.Provider value={{ settings, ready, reload }}>{children}</SettingsCtx.Provider>
}

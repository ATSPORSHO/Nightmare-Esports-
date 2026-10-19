import { createClient } from '@supabase/supabase-js'

// Clean up common copy/paste mistakes: quotes, spaces, trailing slash, extra path like /rest/v1
function cleanUrl(raw) {
  let v = String(raw || '').trim().replace(/^["']|["']$/g, '').trim()
  try {
    const u = new URL(v)
    return u.origin // keeps only https://xxxx.supabase.co
  } catch {
    return v
  }
}
const cleanKey = (raw) => String(raw || '').trim().replace(/^["']|["']$/g, '').trim()

const url = cleanUrl(import.meta.env.VITE_SUPABASE_URL)
const key = cleanKey(import.meta.env.VITE_SUPABASE_ANON_KEY)

export const configured = Boolean(url && key)
export const supabaseHost = url ? url.replace(/^https?:\/\//, '') : ''

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit', // needed so the one-click e-mail link can sign players in
  },
})

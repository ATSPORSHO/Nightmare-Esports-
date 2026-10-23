// Edge function: send-training-reminder
//
// Sends a reminder e-mail through YOUR Gmail account to the players.
// Every e-mail contains a ONE-CLICK button: it signs the player in automatically
// (magic link) and opens the "Add Training Screenshot" upload page.
//
// Two ways to trigger it
//   1) Manual   – Admin Panel → Reminders → "Send now"  (needs an admin login)
//   2) Scheduled – a cron job calls it every 15 min with header  x-cron-secret
//
// Secrets (supabase secrets set ...):
//   GMAIL_USER          your.team@gmail.com
//   GMAIL_APP_PASSWORD  16-character Google "App password"
//   CRON_SECRET         any long random string (only for scheduled mode)
//
// Deploy:  supabase functions deploy send-training-reminder --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')

/** current weekday / minutes-since-midnight / date string in a given IANA timezone */
function localNow(tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const hour = Number(get('hour')) % 24
  return { dow, minutes: hour * 60 + Number(get('minute')), date: `${get('year')}-${get('month')}-${get('day')}` }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const gmailUser = Deno.env.get('GMAIL_USER')
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!gmailUser || !gmailPass) return json({ error: 'GMAIL_USER / GMAIL_APP_PASSWORD secrets are not set' }, 500)

  const admin = createClient(url, service)
  let body: any = {}
  try { body = await req.json() } catch { /* empty body is fine */ }

  // ---- who is calling? -------------------------------------------------
  const isCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret
  if (!isCron) {
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not signed in' }, 401)
    const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (me?.role !== 'admin') return json({ error: 'Admins only' }, 403)
  }

  const { data: settings } = await admin.from('settings').select('*').eq('id', 1).single()
  if (!settings) return json({ error: 'Settings row missing' }, 500)
  const appUrl = (settings.app_url ?? '').replace(/\/+$/, '')
  if (!appUrl) return json({ error: 'Set the website URL in Admin Panel → Branding first' }, 400)

  // ---- decide WHICH reminders to send ---------------------------------
  type Job = { title: string; when: string; scheduleId: string | null }
  const jobs: Job[] = []
  let playerFilter: string[] | null = null

  if (isCron) {
    if (!settings.reminder_enabled) return json({ ok: true, skipped: 'reminders disabled' })
    const now = localNow(settings.timezone)
    const lead = settings.reminder_hours_before * 60
    const { data: schedules } = await admin.from('schedules').select('*').eq('active', true).eq('day_of_week', now.dow)
    for (const s of schedules ?? []) {
      const [h, m] = String(s.start_time).split(':').map(Number)
      const diff = h * 60 + m - now.minutes            // minutes until start
      if (diff > 0 && diff <= lead && diff > lead - 15) { // inside this 15-minute window
        const { data: already } = await admin.from('reminder_log').select('id')
          .eq('schedule_id', s.id).eq('sent_for', now.date).eq('mode', 'scheduled').maybeSingle()
        if (!already) jobs.push({ title: s.title, when: String(s.start_time).slice(0, 5), scheduleId: s.id })
      }
    }
    if (!jobs.length) return json({ ok: true, sent: 0 })
  } else {
    if (!body.title) return json({ error: 'title is required' }, 400)
    jobs.push({ title: String(body.title), when: String(body.when ?? ''), scheduleId: body.schedule_id ?? null })
    playerFilter = Array.isArray(body.player_ids) && body.player_ids.length ? body.player_ids : null
  }

  // ---- recipients ------------------------------------------------------
  let q = admin.from('profiles').select('id, full_name, ign, email').eq('role', 'player').eq('status', 'active').not('email', 'is', null)
  if (playerFilter) q = q.in('id', playerFilter)
  const { data: players } = await q
  if (!players?.length) return json({ error: 'No active players with an e-mail address' }, 400)

  const smtp = new SMTPClient({
    connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: gmailUser, password: gmailPass } },
  })

  let sent = 0
  const failures: string[] = []
  for (const job of jobs) {
    for (const p of players) {
      try {
        // One-click link: signs the player in, then lands on the training screenshot upload page
        const { data: link, error } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: p.email!,
          options: { redirectTo: `${appUrl}/?next=submit/training` },
        })
        if (error) throw error
        const button = link.properties.action_link

        const vars = { name: p.ign || p.full_name, session: job.title, time: job.when, team: settings.team_name }
        const subject = fill(settings.reminder_subject, vars)
        const message = fill(settings.reminder_message, vars)
        const html = `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0a1030;color:#e5e7ff;border-radius:14px;padding:28px">
  <h2 style="margin:0 0 6px;color:#fff">${esc(settings.team_name)}</h2>
  <p style="margin:0 0 18px;color:#9aa4d6;font-size:13px">Training reminder</p>
  <p style="font-size:15px;line-height:1.6">${esc(message).replace(/\n/g, "<br>")}</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${button}" style="background:${esc(settings.accent_color)};color:#fff;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:10px;display:inline-block">
      Add Training Screenshot
    </a>
  </p>
  <p style="font-size:12px;color:#7d87bb">One tap signs you in and opens the upload page. If the button has expired, open <a style="color:#a99bff" href="${appUrl}">${esc(appUrl)}</a> and log in normally.</p>
</div>`
        await smtp.send({ from: `${settings.team_name} <${gmailUser}>`, to: p.email!, subject, content: message, html })
        sent++
      } catch (e) {
        failures.push(`${p.email}: ${(e as Error).message}`)
      }
    }
    await admin.from('reminder_log').insert({
      schedule_id: job.scheduleId,
      sent_for: localNow(settings.timezone).date,
      mode: isCron ? 'scheduled' : 'manual',
      recipients: sent,
    })
  }
  await smtp.close()

  return json({ ok: true, sent, failures })
})

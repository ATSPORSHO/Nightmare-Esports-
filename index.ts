// Edge function: create-player
// Admin-only. Creates / resets / deletes player login accounts.
// Creating an account fires a database trigger that saves the player's
// name, e-mail, phone, IGN and UID into the Players dashboard automatically.
//
// Deploy:  supabase functions deploy create-player
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1) who is calling?
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Not signed in' }, 401)

  // 2) must be admin
  const admin = createClient(url, service)
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return json({ error: 'Admins only' }, 403)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  // ---- create -------------------------------------------------------
  if (body.action === 'create') {
    const { email, password, full_name, phone, ign, game_uid, player_role, monthly_salary } = body
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'A valid e-mail is required' }, 400)
    if (!password || String(password).length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
    if (!full_name) return json({ error: 'Player name is required' }, 400)

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone, ign, game_uid, player_role, monthly_salary },
    })
    if (error) return json({ error: error.message }, 400)

    const { data: profile } = await admin.from('profiles').select('*').eq('id', data.user.id).single()
    return json({ ok: true, profile })
  }

  // ---- reset password ----------------------------------------------
  if (body.action === 'reset_password') {
    if (!body.id || !body.password || String(body.password).length < 8)
      return json({ error: 'Player id and a password of 8+ characters are required' }, 400)
    const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password })
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  // ---- change login e-mail ------------------------------------------
  if (body.action === 'update_email') {
    if (!body.id || !body.email) return json({ error: 'id and email required' }, 400)
    const { error } = await admin.auth.admin.updateUserById(body.id, { email: body.email, email_confirm: true })
    if (error) return json({ error: error.message }, 400)
    await admin.from('profiles').update({ email: body.email }).eq('id', body.id)
    return json({ ok: true })
  }

  // ---- delete -------------------------------------------------------
  if (body.action === 'delete') {
    if (!body.id) return json({ error: 'id required' }, 400)
    if (body.id === user.id) return json({ error: 'You cannot delete your own admin account' }, 400)
    const { error } = await admin.auth.admin.deleteUser(body.id)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  return json({ error: 'Unknown action' }, 400)
})

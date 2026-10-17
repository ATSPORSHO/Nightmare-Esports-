# Esports Team Hub

Team management & analytics dashboard (React + Vite + Tailwind) with a Supabase backend.

| Role | What they can do |
|---|---|
| **Admin** (you) | Change everything: branding, players, schedules, quick actions, finance, matches, reminders, submissions |
| **Player** (accounts you create) | **View** every panel, cannot change anything. Can use only **Analyze PUBG Screenshot** and **Add Training Screenshot** — uploads land in your Admin Panel |
| **Guest** (not logged in) | **Dashboard only** (finance widgets hidden unless you switch them on) |

Security is enforced in the database (Row Level Security), not just by hiding buttons.

---

## 1. Run it locally

```bash
npm install
cp .env.example .env.local      # then fill in the two Supabase values (step 2)
npm run dev
```

## 2. Create the Supabase project (free)

1. Go to <https://supabase.com> → **New project**.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
3. **Project Settings → API**: copy the *Project URL* and the *anon public key* into `.env.local`.

## 3. Create YOUR admin account

1. Supabase → **Authentication → Users → Add user → Create new user** (tick *Auto Confirm*).
2. The **first user ever created becomes the admin automatically.** Everyone after is a player.
3. Then go to **Authentication → Sign In / Providers → Email** and **turn OFF “Allow new users to sign up”**, so nobody can register themselves. Players are only created by you.
4. Run the site, log in, and open **Admin Panel**.

## 4. Deploy the two edge functions (player accounts + e-mail reminders)

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF

supabase functions deploy create-player
supabase functions deploy send-training-reminder --no-verify-jwt
```

### Gmail reminders (one-click e-mails)

1. Google Account → **Security** → turn on **2-Step Verification**.
2. Google Account → **App passwords** → create one (name it “Team Hub”) → copy the 16 characters.
3. Set the secrets:

```bash
supabase secrets set GMAIL_USER=your.team@gmail.com
supabase secrets set GMAIL_APP_PASSWORD=abcdefghijklmnop
supabase secrets set CRON_SECRET=any-long-random-string
```

4. Supabase → **Authentication → URL Configuration**:
   - **Site URL** = your website URL (step 5)
   - **Redirect URLs** → add the same URL followed by `/**`
5. Supabase → **Authentication → Sign In / Providers → Email → Email OTP Expiration** → set to `86400` (24 h) so the one-click button still works hours after the e-mail is sent.
6. In the site: **Admin Panel → Branding → Website URL** → paste your site address.
7. *(Optional – fully automatic reminders)* In the SQL editor run the following, using your own values. It checks every 15 minutes and e-mails players the configured number of hours before each active schedule:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'training-reminders', '*/15 * * * *',
  $$ select net.http_post(
       url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-training-reminder',
       headers := '{"Content-Type":"application/json","x-cron-secret":"SAME-AS-CRON_SECRET"}'::jsonb,
       body    := '{"mode":"scheduled"}'::jsonb) $$
);
```

Then in **Admin Panel → Reminders** tick *Send a reminder automatically*. You can always press **Send now** instead.

> Gmail allows roughly 500 e-mails per day from one account — plenty for a team.

## 5. Put it on GitHub and publish

```bash
git init
git add .
git commit -m "Team hub"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

On GitHub:

1. **Settings → Secrets and variables → Actions → New repository secret**, add:
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. **Settings → Pages → Source: GitHub Actions**
3. Push again (or **Actions → Deploy → Run workflow**). Your site appears at
   `https://YOUR-USERNAME.github.io/YOUR-REPO/`

The anon key is meant to be public; your data is protected by the database rules in `schema.sql`.
**Never** put the service-role key in GitHub secrets or in the front-end — it only lives inside Supabase edge functions.

## 6. Day-to-day use

| I want to… | Where |
|---|---|
| Change team name, logo, banner, colours, quote, currency | Admin Panel → **Branding & Access** |
| Turn guest access on/off, show/hide finance for guests | Admin Panel → **Branding & Access** |
| Create a player (name, e-mail, phone, IGN, UID are saved to Players automatically) | Admin Panel → **Players & Accounts** |
| Reset a player's password, bench them, delete them | Admin Panel → **Players & Accounts** |
| Edit the regular weekly schedule | Admin Panel → **Schedules** |
| Add/remove/rename dashboard buttons, set which role sees each | Admin Panel → **Quick Actions** |
| Set up / send training reminders to Gmail | Admin Panel → **Reminders** |
| See screenshots players uploaded | Admin Panel → **Submissions** (the bell in the header shows new ones) |
| Add or change expenses & income | **Finance** (only admin sees the buttons) |
| Add matches, per-player kills/points | **Match Results** |

## Project layout

```
src/
  App.jsx                    routes + role guards + one-click e-mail redirect
  context/                   AuthContext (admin|player|guest), SettingsContext (branding)
  components/                Layout (header/sidebar), charts, ui
  pages/                     Dashboard, Players, Matches, Finance, Training, Reports, Submit, Profile, Admin
  pages/admin/               Branding, PlayersAdmin, SchedulesAdmin, QuickActionsAdmin, RemindersAdmin, SubmissionsAdmin
supabase/
  schema.sql                 tables, roles, row-level security, storage buckets, seed data
  functions/create-player    admin-only: create / reset / delete player logins
  functions/send-training-reminder   Gmail one-click reminder e-mails
```

## Notes

- The dashboard loads whole tables and filters in the browser — fine for a team's data volume (thousands of rows).
- “Analyze PUBG Screenshot” stores the screenshots for you to review. Automatic OCR/AI reading of scoreboards is not included.

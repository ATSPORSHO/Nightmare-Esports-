-- =====================================================================
--  ESPORTS TEAM HUB — Supabase schema
--  Run this whole file once in: Supabase Dashboard → SQL Editor → New query
--
--  Roles
--    admin  : you. Can change everything.
--    player : accounts you create. Can VIEW every panel, and can submit
--             screenshots (PUBG screenshot / training screenshot).
--    guest  : not logged in. Can only view the dashboard
--             (finance widgets hidden unless you switch them on).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           text not null default 'player' check (role in ('admin','player')),
  full_name      text not null default '',
  email          text,
  phone          text,
  ign            text,
  game_uid       text,
  player_role    text,                         -- IGL, Assaulter, Support, Fragger, Sniper ...
  status         text not null default 'active' check (status in ('active','inactive','benched')),
  monthly_salary numeric not null default 0,
  avatar_url     text,
  created_at     timestamptz not null default now()
);

create table public.settings (
  id                   int primary key default 1 check (id = 1),
  team_name            text not null default 'Nightmare Esports',
  app_title            text not null default 'PUBG MOBILE',
  app_subtitle         text not null default 'Team Management & Analytics',
  dashboard_subtitle   text not null default 'Overview of your team''s performance, finances and training progress.',
  logo_url             text,
  game_logo_url        text,
  banner_url           text,
  accent_color         text not null default '#6d4aff',
  footer_text          text not null default 'All rights reserved.',
  quote_text           text not null default 'Discipline today, championship tomorrow.',
  quote_author         text not null default 'Nightmare Esports',
  currency             text not null default 'BDT',
  timezone             text not null default 'Asia/Dhaka',
  app_url              text,                   -- public URL of the website (used in reminder e-mails)
  guest_enabled        boolean not null default true,
  guest_show_finance   boolean not null default false,
  reminder_enabled     boolean not null default false,
  reminder_hours_before int not null default 2,
  reminder_subject     text not null default 'Training reminder: {session} at {time}',
  reminder_message     text not null default 'Hi {name}, training "{session}" starts at {time}. After the session please upload your training screenshot using the button below.'
);
insert into public.settings (id) values (1);

create table public.matches (
  id        uuid primary key default gen_random_uuid(),
  played_on date not null default current_date,
  tournament text not null default '',
  map       text,
  placement int,
  points    int not null default 0,
  kills     int not null default 0,
  notes     text
);

create table public.match_player_stats (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  kills     int not null default 0,
  points    int not null default 0
);

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  spent_on    date not null default current_date,
  category    text not null,
  description text,
  amount      numeric not null check (amount >= 0)
);

create table public.income (
  id          uuid primary key default gen_random_uuid(),
  received_on date not null default current_date,
  type        text not null,
  description text,
  amount      numeric not null check (amount >= 0)
);

create table public.training_sessions (
  id            uuid primary key default gen_random_uuid(),
  held_on       date not null default current_date,
  name          text not null,
  attendees     int not null default 0,
  total_players int not null default 5,
  cost          numeric not null default 0,
  notes         text
);

-- Regular weekly schedule (day_of_week: 0 = Sunday ... 6 = Saturday)
create table public.schedules (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  day_of_week  int not null check (day_of_week between 0 and 6),
  start_time   time not null default '20:00',
  duration_min int not null default 120,
  notes        text,
  active       boolean not null default true
);

create table public.quick_actions (
  id       uuid primary key default gen_random_uuid(),
  label    text not null,
  icon     text not null default 'Zap',
  color    text not null default '#6d4aff',
  target   text not null,                      -- route inside the app, e.g. /submit/training
  roles    text[] not null default '{admin}',  -- who sees the button: admin / player
  sort     int not null default 0,
  enabled  boolean not null default true
);

create table public.submissions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('pubg_screenshot','training_screenshot')),
  file_paths text[] not null default '{}',
  note       text,
  status     text not null default 'new' check (status in ('new','reviewed')),
  created_at timestamptz not null default now()
);

create table public.updates (
  id         uuid primary key default gen_random_uuid(),
  message    text not null,
  detail     text,
  scope      text not null default 'private' check (scope in ('public','private')),
  created_at timestamptz not null default now()
);

create table public.reminder_log (
  id         uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.schedules(id) on delete set null,
  sent_for   date not null default current_date,
  mode       text not null default 'manual',
  recipients int not null default 0,
  created_at timestamptz not null default now()
);
create unique index reminder_log_once on public.reminder_log (schedule_id, sent_for) where mode = 'scheduled';

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.guest_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select guest_enabled from public.settings where id = 1), true);
$$;

create or replace function public.guest_finance_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select guest_enabled and guest_show_finance from public.settings where id = 1), false);
$$;

-- ---------------------------------------------------------------------
-- New auth user  ->  profile row (this is how player details are saved
-- automatically into the Players dashboard).
-- The very first user ever created becomes the admin; everyone after is a player.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, role, full_name, email, phone, ign, game_uid, player_role, monthly_salary)
  values (
    new.id,
    case when exists (select 1 from public.profiles where role = 'admin') then 'player' else 'admin' end,
    coalesce(m->>'full_name', ''),
    new.email,
    m->>'phone',
    m->>'ign',
    m->>'game_uid',
    m->>'player_role',
    coalesce(nullif(m->>'monthly_salary', '')::numeric, 0)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Activity feed ("Latest Updates") written by triggers
-- ---------------------------------------------------------------------
create or replace function public.log_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare msg text; det text; sc text := 'private';
begin
  if TG_TABLE_NAME = 'matches' then
    msg := 'Match result added'; det := coalesce(NEW.tournament, '') || ' - ' || NEW.played_on; sc := 'public';
  elsif TG_TABLE_NAME = 'training_sessions' then
    msg := 'Training session recorded'; det := NEW.name || ' - ' || NEW.held_on; sc := 'public';
  elsif TG_TABLE_NAME = 'expenses' then
    msg := 'Expense added'; det := NEW.category || ' - ' || NEW.amount;
  elsif TG_TABLE_NAME = 'income' then
    msg := 'Income added'; det := NEW.type || ' - ' || NEW.amount;
  elsif TG_TABLE_NAME = 'submissions' then
    msg := case when NEW.kind = 'pubg_screenshot' then 'PUBG screenshot submitted' else 'Training screenshot submitted' end;
    det := (select coalesce(nullif(ign, ''), full_name) from public.profiles where id = NEW.user_id);
  elsif TG_TABLE_NAME = 'profiles' then
    if NEW.role = 'admin' then return NEW; end if;
    msg := 'Player account created'; det := coalesce(nullif(NEW.ign, ''), NEW.full_name);
  end if;
  insert into public.updates (message, detail, scope) values (msg, det, sc);
  return NEW;
end $$;

create trigger log_matches   after insert on public.matches           for each row execute function public.log_update();
create trigger log_training  after insert on public.training_sessions for each row execute function public.log_update();
create trigger log_expenses  after insert on public.expenses          for each row execute function public.log_update();
create trigger log_income    after insert on public.income            for each row execute function public.log_update();
create trigger log_subs      after insert on public.submissions       for each row execute function public.log_update();
create trigger log_profiles  after insert on public.profiles          for each row execute function public.log_update();

-- ---------------------------------------------------------------------
-- Guest-safe roster view (no phone / e-mail / salary / UID)
-- ---------------------------------------------------------------------
create or replace view public.public_roster with (security_invoker = false) as
  select id, full_name, ign, player_role, status, avatar_url
  from public.profiles
  where role = 'player' and (public.guest_ok() or auth.uid() is not null);
grant select on public.public_roster to anon, authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.settings            enable row level security;
alter table public.matches             enable row level security;
alter table public.match_player_stats  enable row level security;
alter table public.expenses            enable row level security;
alter table public.income              enable row level security;
alter table public.training_sessions   enable row level security;
alter table public.schedules           enable row level security;
alter table public.quick_actions       enable row level security;
alter table public.submissions         enable row level security;
alter table public.updates             enable row level security;
alter table public.reminder_log        enable row level security;

-- profiles: any logged-in member can read; only admin writes
create policy "profiles read members" on public.profiles for select to authenticated using (true);
create policy "profiles admin write"  on public.profiles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- settings: everyone can read (login page needs the team name/logo); only admin writes
create policy "settings read all"     on public.settings for select to anon, authenticated using (true);
create policy "settings admin write"  on public.settings for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- tables that guests may read on the dashboard (only if guest access is enabled)
do $$
declare t text;
begin
  foreach t in array array['matches','match_player_stats','training_sessions','schedules'] loop
    execute format('create policy "%1$s read members" on public.%1$s for select to authenticated using (true)', t);
    execute format('create policy "%1$s read guest"   on public.%1$s for select to anon using (public.guest_ok())', t);
    execute format('create policy "%1$s admin write"  on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- training cost is finance data: hide that column from guests
revoke select on public.training_sessions from anon;
grant select (id, held_on, name, attendees, total_players, notes) on public.training_sessions to anon;

-- finance: members read, guests only if you enabled "show finance to guests", ONLY ADMIN changes
do $$
declare t text;
begin
  foreach t in array array['expenses','income'] loop
    execute format('create policy "%1$s read members" on public.%1$s for select to authenticated using (true)', t);
    execute format('create policy "%1$s read guest"   on public.%1$s for select to anon using (public.guest_finance_ok())', t);
    execute format('create policy "%1$s admin write"  on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- quick actions: members read, admin edits
create policy "qa read members" on public.quick_actions for select to authenticated using (true);
create policy "qa admin write"  on public.quick_actions for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- submissions: a player inserts + reads their own, admin reads/changes/deletes everything
create policy "subs insert own" on public.submissions for insert to authenticated with check (user_id = auth.uid());
create policy "subs read own"   on public.submissions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "subs admin upd"  on public.submissions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "subs admin del"  on public.submissions for delete to authenticated using (public.is_admin());

-- activity feed
create policy "updates read members" on public.updates for select to authenticated using (true);
create policy "updates read guest"   on public.updates for select to anon using (scope = 'public' and public.guest_ok());
create policy "updates admin del"    on public.updates for delete to authenticated using (public.is_admin());

-- reminder log: admin only
create policy "reminder admin" on public.reminder_log for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Storage buckets
--   branding    (public)  : logo / banner, only admin uploads
--   submissions (private) : players upload into their own folder, admin sees all
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('branding', 'branding', true),
  ('submissions', 'submissions', false)
on conflict (id) do nothing;

create policy "branding read"         on storage.objects for select using (bucket_id = 'branding');
create policy "branding admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'branding' and public.is_admin());
create policy "branding admin update" on storage.objects for update to authenticated using (bucket_id = 'branding' and public.is_admin());
create policy "branding admin delete" on storage.objects for delete to authenticated using (bucket_id = 'branding' and public.is_admin());

create policy "submissions upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "submissions read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "submissions admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'submissions' and public.is_admin());

-- ---------------------------------------------------------------------
-- Seed data: quick actions + a sample weekly schedule
--   (edit or delete all of these later from Admin Panel)
-- ---------------------------------------------------------------------
insert into public.quick_actions (label, icon, color, target, roles, sort) values
  ('Analyze PUBG Screenshot', 'Image',        '#5b4bff', '/submit/screenshot', '{admin,player}', 1),
  ('Add Training Screenshot', 'Upload',       '#14a67a', '/submit/training',   '{admin,player}', 2),
  ('Add Training Session',    'CalendarPlus', '#2563eb', '/training?new=1',    '{admin}',        3),
  ('Add Finance Entry',       'Wallet',       '#16a34a', '/finance?new=1',     '{admin}',        4),
  ('Generate Report',         'BarChart3',    '#f08a24', '/reports',           '{admin}',        5);

insert into public.schedules (title, day_of_week, start_time, duration_min, notes) values
  ('TDM Practice',  1, '20:00', 120, 'Warm-up + TDM scrims'),
  ('Scrim',         3, '21:00', 180, 'Full custom room'),
  ('IGL Review',    5, '19:00',  90, 'VOD review'),
  ('Strategy Session', 6, '18:00', 90, 'Map rotations and drops');

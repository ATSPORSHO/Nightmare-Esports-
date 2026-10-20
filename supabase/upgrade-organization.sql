-- =====================================================================
--  UPGRADE: Nightmare Esports Organization
--  Run ONCE in Supabase -> SQL Editor -> New query (empty box!) -> Run.
--  Safe to run again: it will not duplicate or delete anything.
-- =====================================================================

-- 1) Lineups --------------------------------------------------------
create table if not exists public.lineups (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique,
  name      text not null,
  tagline   text,
  logo_url  text,
  sort      int not null default 0,
  active    boolean not null default true
);

insert into public.lineups (slug, name, tagline, sort) values
  ('nightmare-esports',  'Nightmare Esports',  'Main competitive lineup', 1),
  ('nightmare-official', 'Nightmare Official', 'Official lineup',         2)
on conflict (slug) do nothing;

-- 2) Lineup column on every table that belongs to a lineup ------------
alter table public.profiles          add column if not exists lineup_id uuid references public.lineups(id) on delete set null;
alter table public.matches           add column if not exists lineup_id uuid references public.lineups(id) on delete set null;
alter table public.training_sessions add column if not exists lineup_id uuid references public.lineups(id) on delete set null;
alter table public.schedules         add column if not exists lineup_id uuid references public.lineups(id) on delete set null;
alter table public.expenses          add column if not exists lineup_id uuid references public.lineups(id) on delete set null;
alter table public.income            add column if not exists lineup_id uuid references public.lineups(id) on delete set null;

do $$
begin
  if to_regclass('public.match_schedule') is not null then
    alter table public.match_schedule add column if not exists lineup_id uuid references public.lineups(id) on delete set null;
  end if;
end $$;

-- Everything you already entered belongs to Nightmare Esports.
-- (Expenses/income with no lineup = "Organization (shared)" -- you can change any entry later.)
do $$
declare esports uuid := (select id from public.lineups where slug = 'nightmare-esports');
begin
  update public.profiles          set lineup_id = esports where role = 'player' and lineup_id is null;
  update public.matches           set lineup_id = esports where lineup_id is null;
  update public.training_sessions set lineup_id = esports where lineup_id is null;
  update public.schedules         set lineup_id = esports where lineup_id is null;
  update public.expenses          set lineup_id = esports where lineup_id is null;
  update public.income            set lineup_id = esports where lineup_id is null;
  if to_regclass('public.match_schedule') is not null then
    execute format('update public.match_schedule set lineup_id = %L where lineup_id is null', esports);
  end if;
end $$;

-- 3) Successful events (managed in Admin Panel -> Events) ---------------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  event_date  date not null default current_date,
  placement   text,
  prize       text,
  description text,
  image_url   text,
  lineup_id   uuid references public.lineups(id) on delete set null,
  featured    boolean not null default false
);

-- 4) Google Sheets connection (admin only) -----------------------------
create table if not exists public.integrations (
  id           int primary key default 1 check (id = 1),
  sheets_url   text,
  sheets_token text
);
insert into public.integrations (id) values (1) on conflict (id) do nothing;

-- 5) Organization texts + red theme -------------------------------------
alter table public.settings add column if not exists org_name    text not null default 'Nightmare Esports Organization';
alter table public.settings add column if not exists org_tagline text not null default 'Dream. Train. Compete. Win.';
alter table public.settings add column if not exists org_about   text not null default '';

update public.settings set accent_color = '#c8102e' where id = 1;

update public.quick_actions set color = case label
  when 'Analyze PUBG Screenshot' then '#c8102e'
  when 'Add Training Screenshot' then '#8f1020'
  when 'Add Training Session'    then '#b91c1c'
  when 'Add Finance Entry'       then '#7f1d1d'
  when 'Generate Report'         then '#d97706'
  else color end;

-- 6) Access rules ---------------------------------------------------------
alter table public.lineups      enable row level security;
alter table public.events       enable row level security;
alter table public.integrations enable row level security;

drop policy if exists "lineups read members" on public.lineups;
drop policy if exists "lineups read guest"   on public.lineups;
drop policy if exists "lineups admin write"  on public.lineups;
create policy "lineups read members" on public.lineups for select to authenticated using (true);
create policy "lineups read guest"   on public.lineups for select to anon using (public.guest_ok());
create policy "lineups admin write"  on public.lineups for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "events read members" on public.events;
drop policy if exists "events read guest"   on public.events;
drop policy if exists "events admin write"  on public.events;
create policy "events read members" on public.events for select to authenticated using (true);
create policy "events read guest"   on public.events for select to anon using (public.guest_ok());
create policy "events admin write"  on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "integrations admin only" on public.integrations;
create policy "integrations admin only" on public.integrations for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.lineups, public.events to anon;
grant select, insert, update, delete on public.lineups, public.events, public.integrations to authenticated;
grant select (lineup_id) on public.training_sessions to anon;

-- Guest-safe roster now also tells which lineup a player is in
create or replace view public.public_roster with (security_invoker = false) as
  select id, full_name, ign, player_role, status, avatar_url, lineup_id
  from public.profiles
  where role = 'player' and (public.guest_ok() or auth.uid() is not null);
grant select on public.public_roster to anon, authenticated;

-- 7) Training attendance now works per lineup -----------------------------
create or replace function public.sync_training_attendance() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tz text; d date; sname text; sid uuid; lid uuid; active_players int;
begin
  if NEW.kind <> 'training_screenshot' then return NEW; end if;

  if NEW.status = 'reviewed' and OLD.status is distinct from 'reviewed' then
    if not exists (select 1 from profiles where id = NEW.user_id and role = 'player') then
      return NEW;
    end if;
    select lineup_id into lid from profiles where id = NEW.user_id;
    select timezone into tz from settings where id = 1;
    d := (NEW.created_at at time zone coalesce(tz, 'UTC'))::date;

    sname := nullif(trim(NEW.note), '');
    if sname is null then
      select title into sname from schedules
      where active and day_of_week = extract(dow from d)::int
        and (lineup_id is not distinct from lid or lineup_id is null)
      order by (lineup_id is null), start_time limit 1;
    end if;
    sname := coalesce(sname, 'Training Session');

    select count(*) into active_players from profiles
    where role = 'player' and status = 'active' and lineup_id is not distinct from lid;

    select id into sid from training_sessions
    where held_on = d and lower(name) = lower(sname) and lineup_id is not distinct from lid limit 1;
    if sid is null then
      insert into training_sessions (held_on, name, attendees, total_players, cost, notes, lineup_id)
      values (d, sname, 0, greatest(active_players, 1), 0, 'Auto-created from submitted screenshots', lid)
      returning id into sid;
    end if;

    insert into training_attendance (session_id, player_id, submission_id)
    values (sid, NEW.user_id, NEW.id)
    on conflict do nothing;

    update training_sessions
    set attendees = (select count(*) from training_attendance where session_id = sid),
        total_players = greatest(total_players, active_players)
    where id = sid;

  elsif OLD.status = 'reviewed' and NEW.status <> 'reviewed' then
    select session_id into sid from training_attendance where submission_id = NEW.id;
    delete from training_attendance where submission_id = NEW.id;
    if sid is not null then
      update training_sessions
      set attendees = (select count(*) from training_attendance where session_id = sid)
      where id = sid;
    end if;
  end if;

  return NEW;
end $$;

notify pgrst, 'reload schema';

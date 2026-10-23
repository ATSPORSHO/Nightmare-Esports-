-- =====================================================================
--  Nightmare Esports Organization  (run ONCE: SQL Editor -> new tab -> paste -> Run)
--  Safe to run again. Creates lineups (only "Nightmare Esports" for now) and events.
-- =====================================================================
create table if not exists public.lineups (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique,
  name      text not null,
  tagline   text,
  logo_url  text,
  sort      int not null default 0,
  active    boolean not null default true
);

insert into public.lineups (slug, name, tagline, sort)
values ('nightmare-esports', 'Nightmare Esports', 'PUBG MOBILE TEAM', 1)
on conflict (slug) do nothing;

alter table public.profiles add column if not exists lineup_id uuid references public.lineups(id) on delete set null;
alter table public.matches  add column if not exists lineup_id uuid references public.lineups(id) on delete set null;

-- everything you already have belongs to Nightmare Esports
update public.profiles set lineup_id = (select id from public.lineups where slug = 'nightmare-esports')
  where role = 'player' and lineup_id is null;
update public.matches set lineup_id = (select id from public.lineups where slug = 'nightmare-esports')
  where lineup_id is null;

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  event_date  date not null default current_date,
  kind        text,
  placement   text,
  prize       text,
  description text,
  image_url   text,
  lineup_id   uuid references public.lineups(id) on delete set null,
  featured    boolean not null default false
);
alter table public.events add column if not exists kind text;

alter table public.settings add column if not exists org_name    text not null default 'Nightmare Esports Organization';
alter table public.settings add column if not exists org_tagline text not null default 'A home for dreamers, fighters and the next generation of esports legends.';
alter table public.settings add column if not exists org_about   text not null default '';

alter table public.lineups enable row level security;
alter table public.events  enable row level security;

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

grant select on public.lineups, public.events to anon;
grant select, insert, update, delete on public.lineups, public.events to authenticated;

create or replace view public.public_roster with (security_invoker = false) as
  select id, full_name, ign, player_role, status, avatar_url, sort_order, game_uid, lineup_id
  from public.profiles
  where role = 'player' and (public.guest_ok() or auth.uid() is not null);
grant select on public.public_roster to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

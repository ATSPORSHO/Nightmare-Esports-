-- Team registration (opening time, countdown, public form, confirmation CODE from 101 that is re-used after a cancellation,
-- admin list of ALL registrations). Run once in Supabase -> SQL Editor (new tab). Safe to run again.
alter table public.tournaments add column if not exists reg_enabled boolean not null default false;
alter table public.tournaments add column if not exists reg_start   timestamptz;
alter table public.tournaments add column if not exists reg_end     timestamptz;

create table if not exists public.treg_entries (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete set null,
  team_name     text not null,
  tag           text,
  country       text,
  contact       text not null,
  players       jsonb not null default '[]'::jsonb,
  status        text not null default 'pending',   -- pending | approved | rejected | cancelled
  created_at    timestamptz not null default now()
);
alter table public.treg_entries add column if not exists reg_code         int;
alter table public.treg_entries add column if not exists cancelled_code   int;   -- the code a cancelled registration used to have
alter table public.treg_entries add column if not exists drive_url        text;  -- player photos
alter table public.treg_entries add column if not exists logo_drive_url   text;  -- team logo
alter table public.treg_entries add column if not exists leader_name      text;
alter table public.treg_entries add column if not exists tournament_title text;
-- the code is now handed out by the function below (lowest free number from 101), not by a counter
alter table public.treg_entries alter column reg_code drop not null;
alter table public.treg_entries alter column reg_code drop default;
alter table public.treg_entries alter column tournament_id drop not null;
alter table public.treg_entries drop constraint if exists treg_entries_tournament_id_fkey;
alter table public.treg_entries add constraint treg_entries_tournament_id_fkey foreign key (tournament_id) references public.tournaments(id) on delete set null;
drop index if exists public.treg_entries_code_idx;
create unique index treg_entries_code_idx on public.treg_entries (reg_code);   -- cancelled rows have no code, so it can be used again

alter table public.treg_entries enable row level security;
drop policy if exists "treg_entries public insert" on public.treg_entries;
drop policy if exists "treg_entries admin all"     on public.treg_entries;
create policy "treg_entries admin all" on public.treg_entries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke insert on public.treg_entries from anon;
grant select, insert, update, delete on public.treg_entries to authenticated;

drop function if exists public.submit_registration(uuid, text, text, text, text, jsonb, text);
create or replace function public.submit_registration(
  p_tournament uuid, p_team text, p_tag text, p_country text, p_leader text, p_contact text, p_players jsonb, p_logo_drive text, p_drive text
) returns json language plpgsql security definer set search_path = public as $$
declare t public.tournaments; r public.treg_entries; n int; v_code int;
begin
  select * into t from public.tournaments where id = p_tournament;
  if not found then raise exception 'Tournament not found'; end if;
  if not (t.reg_enabled and (t.reg_start is null or t.reg_start <= now()) and (t.reg_end is null or t.reg_end >= now())) then
    raise exception 'Registration is closed for this tournament.';
  end if;
  if coalesce(trim(p_team), '') = '' or coalesce(trim(p_contact), '') = '' or coalesce(trim(p_leader), '') = '' then
    raise exception 'Team name, team leader name and contact are required.';
  end if;
  n := coalesce(jsonb_array_length(p_players), 0);
  if n < 4 or n > 6 then raise exception 'Please add 4 to 6 players.'; end if;
  if p_logo_drive is null or p_logo_drive !~* '^https?://(drive|docs)\.google\.com/' then raise exception 'Please add a Google Drive link with the team logo.'; end if;
  if p_drive is null or p_drive !~* '^https?://(drive|docs)\.google\.com/' then raise exception 'Please add a Google Drive link with the player photos.'; end if;
  lock table public.treg_entries in share row exclusive mode;
  -- lowest free code from 101 (a cancelled registration gives its code back)
  select g into v_code from generate_series(101, coalesce((select max(reg_code) from public.treg_entries), 100) + 1) g
   where not exists (select 1 from public.treg_entries e where e.reg_code = g) order by g limit 1;
  insert into public.treg_entries (reg_code, tournament_id, tournament_title, team_name, tag, country, leader_name, contact, players, logo_drive_url, drive_url)
  values (v_code, p_tournament, t.title, trim(p_team), nullif(trim(p_tag), ''), nullif(p_country, ''), trim(p_leader), trim(p_contact), p_players, trim(p_logo_drive), trim(p_drive))
  returning * into r;
  return json_build_object('code', r.reg_code, 'created_at', r.created_at);
end $$;
grant execute on function public.submit_registration(uuid, text, text, text, text, text, jsonb, text, text) to anon, authenticated;

create or replace function public.registration_status(p_code int)
returns table (team_name text, tournament_title text, status text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select team_name, tournament_title, status, created_at from public.treg_entries where reg_code = p_code;
$$;
grant execute on function public.registration_status(int) to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

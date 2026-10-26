-- Team registration (opening time, countdown, public form with confirmation CODE from 101, admin list of ALL registrations).
-- Run once in Supabase -> SQL Editor (new tab). Safe to run again.
alter table public.tournaments add column if not exists reg_enabled boolean not null default false;
alter table public.tournaments add column if not exists reg_start   timestamptz;
alter table public.tournaments add column if not exists reg_end     timestamptz;

create sequence if not exists public.treg_code_seq start 101 minvalue 101;

create table if not exists public.treg_entries (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete set null,
  team_name     text not null,
  tag           text,
  country       text,
  contact       text not null,
  players       jsonb not null default '[]'::jsonb,
  status        text not null default 'pending',   -- pending | approved | rejected
  created_at    timestamptz not null default now()
);
alter table public.treg_entries add column if not exists reg_code         int  not null default nextval('public.treg_code_seq');
alter table public.treg_entries add column if not exists drive_url        text;
alter table public.treg_entries add column if not exists tournament_title text;
-- registrations are kept even if the tournament is deleted later
alter table public.treg_entries alter column tournament_id drop not null;
alter table public.treg_entries drop constraint if exists treg_entries_tournament_id_fkey;
alter table public.treg_entries add constraint treg_entries_tournament_id_fkey foreign key (tournament_id) references public.tournaments(id) on delete set null;
create unique index if not exists treg_entries_code_idx on public.treg_entries (reg_code);

alter table public.treg_entries enable row level security;
drop policy if exists "treg_entries public insert" on public.treg_entries;
drop policy if exists "treg_entries admin all"     on public.treg_entries;
create policy "treg_entries admin all" on public.treg_entries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke insert on public.treg_entries from anon;
grant select, insert, update, delete on public.treg_entries to authenticated;

-- the public form calls this function (it checks that registration is open and returns the code)
create or replace function public.submit_registration(
  p_tournament uuid, p_team text, p_tag text, p_country text, p_contact text, p_players jsonb, p_drive text
) returns json language plpgsql security definer set search_path = public as $$
declare t public.tournaments; r public.treg_entries; n int;
begin
  select * into t from public.tournaments where id = p_tournament;
  if not found then raise exception 'Tournament not found'; end if;
  if not (t.reg_enabled and (t.reg_start is null or t.reg_start <= now()) and (t.reg_end is null or t.reg_end >= now())) then
    raise exception 'Registration is closed for this tournament.';
  end if;
  if coalesce(trim(p_team), '') = '' or coalesce(trim(p_contact), '') = '' then raise exception 'Team name and contact are required.'; end if;
  n := coalesce(jsonb_array_length(p_players), 0);
  if n < 4 or n > 6 then raise exception 'Please add 4 to 6 players.'; end if;
  if p_drive is null or p_drive !~* '^https?://(drive|docs)\.google\.com/' then raise exception 'Please add a Google Drive link with the player photos.'; end if;
  insert into public.treg_entries (tournament_id, tournament_title, team_name, tag, country, contact, players, drive_url)
  values (p_tournament, t.title, trim(p_team), nullif(trim(p_tag), ''), nullif(p_country, ''), trim(p_contact), p_players, trim(p_drive))
  returning * into r;
  return json_build_object('code', r.reg_code, 'created_at', r.created_at);
end $$;
grant execute on function public.submit_registration(uuid, text, text, text, text, jsonb, text) to anon, authenticated;

-- "check my registration": code -> team + status
create or replace function public.registration_status(p_code int)
returns table (team_name text, tournament_title text, status text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select team_name, tournament_title, status, created_at from public.treg_entries where reg_code = p_code;
$$;
grant execute on function public.registration_status(int) to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

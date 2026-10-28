-- Live broadcast (scorecard). Run once in Supabase -> SQL Editor (new tab). Safe to run again.
create table if not exists public.tbroadcast_sessions (
  id            uuid primary key default gen_random_uuid(),   -- the id is the secret part of the viewer link
  tournament_id uuid references public.tournaments(id) on delete set null,
  group_id      uuid,
  title         text not null default 'Live',
  mode          text not null default 'auto',                  -- auto | manual
  theme         text not null default 'blue',
  state         jsonb not null default '{}'::jsonb,
  status        text not null default 'live',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- what is kept after a broadcast has ended (the live session itself is deleted)
create table if not exists public.tbroadcast_finals (
  id               uuid primary key default gen_random_uuid(),
  tournament_id    uuid references public.tournaments(id) on delete set null,
  tournament_title text,
  group_name       text,
  title            text not null,
  mode             text,
  final            jsonb not null default '[]'::jsonb,
  started_at       timestamptz,
  ended_at         timestamptz not null default now()
);

alter table public.tbroadcast_sessions enable row level security;
alter table public.tbroadcast_finals   enable row level security;
drop policy if exists "tbroadcast_sessions admin" on public.tbroadcast_sessions;
drop policy if exists "tbroadcast_finals admin"   on public.tbroadcast_finals;
create policy "tbroadcast_sessions admin" on public.tbroadcast_sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "tbroadcast_finals admin"   on public.tbroadcast_finals   for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.tbroadcast_sessions to authenticated;
grant select, insert, update, delete on public.tbroadcast_finals   to authenticated;

-- viewers (the OBS / browser page) can only read ONE session if they know its link
create or replace function public.broadcast_state(p_id uuid) returns json
language sql security definer set search_path = public as $$
  select json_build_object('title', title, 'mode', mode, 'theme', theme, 'state', state, 'status', status, 'updated_at', updated_at)
  from public.tbroadcast_sessions where id = p_id and status = 'live';
$$;
grant execute on function public.broadcast_state(uuid) to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

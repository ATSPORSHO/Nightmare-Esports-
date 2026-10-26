-- Team registration for tournaments: opening time, countdown, public sign-up form, admin approval.
-- Run once in Supabase -> SQL Editor (new tab).
alter table public.tournaments add column if not exists reg_enabled boolean not null default false;
alter table public.tournaments add column if not exists reg_start   timestamptz;
alter table public.tournaments add column if not exists reg_end     timestamptz;

create table if not exists public.treg_entries (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_name     text not null,
  tag           text,
  country       text,
  contact       text not null,
  players       jsonb not null default '[]'::jsonb,
  status        text not null default 'pending',   -- pending | approved | rejected
  created_at    timestamptz not null default now()
);
alter table public.treg_entries enable row level security;
drop policy if exists "treg_entries public insert" on public.treg_entries;
drop policy if exists "treg_entries admin all"     on public.treg_entries;
-- anybody can register, but only while registration is open for that tournament
create policy "treg_entries public insert" on public.treg_entries for insert to anon, authenticated
  with check (
    status = 'pending' and exists (
      select 1 from public.tournaments t
       where t.id = tournament_id and t.reg_enabled
         and (t.reg_start is null or t.reg_start <= now())
         and (t.reg_end   is null or t.reg_end   >= now())
    )
  );
create policy "treg_entries admin all" on public.treg_entries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant insert on public.treg_entries to anon;
grant select, insert, update, delete on public.treg_entries to authenticated;
select pg_notify('pgrst', 'reload schema');

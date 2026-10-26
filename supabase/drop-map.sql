-- Drop map: where each team drops on the map. Run once in Supabase -> SQL Editor (new tab).
create table if not exists public.tdrop_spots (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_id      uuid not null references public.tournament_groups(id) on delete cascade,
  map           text not null,
  team_id       uuid not null references public.tournament_teams(id) on delete cascade,
  x             numeric not null,   -- 0..100 (% from the left of the map)
  y             numeric not null,   -- 0..100 (% from the top of the map)
  unique (group_id, map, team_id)
);
alter table public.tdrop_spots enable row level security;
drop policy if exists "tdrop_spots read all"   on public.tdrop_spots;
drop policy if exists "tdrop_spots admin write" on public.tdrop_spots;
create policy "tdrop_spots read all"    on public.tdrop_spots for select to anon, authenticated using (true);
create policy "tdrop_spots admin write" on public.tdrop_spots for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.tdrop_spots to anon;
grant select, insert, update, delete on public.tdrop_spots to authenticated;
select pg_notify('pgrst', 'reload schema');

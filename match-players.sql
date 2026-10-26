-- Which players played each match (and their eliminations) -> "playing 4" and the MVP list.
-- Run once in Supabase -> SQL Editor (new tab).
create table if not exists public.tmatch_player_stats (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references public.tournament_matches(id) on delete cascade,
  team_id   uuid not null references public.tournament_teams(id) on delete cascade,
  player_id uuid not null references public.tournament_team_players(id) on delete cascade,
  kills     int  not null default 0,
  unique (match_id, player_id)
);
alter table public.tmatch_player_stats enable row level security;
drop policy if exists "tmatch_player_stats read all"   on public.tmatch_player_stats;
drop policy if exists "tmatch_player_stats admin write" on public.tmatch_player_stats;
create policy "tmatch_player_stats read all"    on public.tmatch_player_stats for select to anon, authenticated using (true);
create policy "tmatch_player_stats admin write" on public.tmatch_player_stats for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.tmatch_player_stats to anon;
grant select, insert, update, delete on public.tmatch_player_stats to authenticated;
select pg_notify('pgrst', 'reload schema');

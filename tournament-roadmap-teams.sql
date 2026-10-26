-- Tournament roadmap, invited teams, team tags and players. Run once in Supabase -> SQL Editor (new tab).
alter table public.tournaments      add column if not exists roadmap  jsonb   not null default '[]'::jsonb;
alter table public.tournament_teams add column if not exists logo_url text;
alter table public.tournament_teams add column if not exists tag      text;
alter table public.tournament_teams add column if not exists invited  boolean not null default false;

create table if not exists public.tournament_team_players (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references public.tournament_teams(id) on delete cascade,
  name      text not null,
  photo_url text,
  sort      int  not null default 0
);

alter table public.tournament_team_players enable row level security;
drop policy if exists "tournament_team_players read all"   on public.tournament_team_players;
drop policy if exists "tournament_team_players admin write" on public.tournament_team_players;
create policy "tournament_team_players read all"    on public.tournament_team_players for select to anon, authenticated using (true);
create policy "tournament_team_players admin write" on public.tournament_team_players for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.tournament_team_players to anon;
grant select, insert, update, delete on public.tournament_team_players to authenticated;

select pg_notify('pgrst', 'reload schema');

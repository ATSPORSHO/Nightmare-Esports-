-- Results + leaderboards. Run once, after tournament-rounds.sql.
alter table public.tournament_group_teams add column if not exists wwcd      int not null default 0;
alter table public.tournament_group_teams add column if not exists place_pts int not null default 0;
alter table public.tournament_group_teams add column if not exists kill_pts  int not null default 0;

-- 'open' = slot list is shown, 'ended' = the same page shows the results / leaderboard
alter table public.tournament_rounds add column if not exists status text not null default 'open';

select pg_notify('pgrst', 'reload schema');

-- Lets you add chicken dinners (CD) by hand for each team. Run once in Supabase -> SQL Editor (new tab).
alter table public.tournament_group_teams add column if not exists cd_extra int not null default 0;
select pg_notify('pgrst', 'reload schema');

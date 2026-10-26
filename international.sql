-- Regional / international tournaments + team country flags. Run once in Supabase -> SQL Editor (new tab).
alter table public.tournaments      add column if not exists scope   text not null default 'regional';
alter table public.tournament_teams add column if not exists country text;
select pg_notify('pgrst', 'reload schema');

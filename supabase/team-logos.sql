-- Team logos for tournament participants. Run once in Supabase -> SQL Editor.
alter table public.tournament_teams add column if not exists logo_url text;
select pg_notify('pgrst','reload schema');

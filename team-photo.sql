-- Team photo (squad picture) for the current-standings page. Run once in Supabase -> SQL Editor (new tab).
alter table public.tournament_teams add column if not exists photo_url text;
select pg_notify('pgrst','reload schema');

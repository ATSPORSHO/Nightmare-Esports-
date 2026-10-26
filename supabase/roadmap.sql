-- Fixes the tournament roadmap not saving (the column exists with the wrong type).
-- Run once in Supabase -> SQL Editor (new tab). Nothing useful is lost: roadmaps could not be saved before.
alter table public.tournaments drop column if exists roadmap;
alter table public.tournaments add column roadmap jsonb not null default '[]'::jsonb;
select pg_notify('pgrst', 'reload schema');
select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'tournaments' and column_name = 'roadmap';

-- Tournament roadmap column. Run once in Supabase -> SQL Editor (new tab).
alter table public.tournaments add column if not exists roadmap jsonb not null default '[]'::jsonb;
select pg_notify('pgrst', 'reload schema');
select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'tournaments' and column_name = 'roadmap';

-- Background picture for each lineup card. Run once.
alter table public.lineups add column if not exists banner_url text;
select pg_notify('pgrst', 'reload schema');

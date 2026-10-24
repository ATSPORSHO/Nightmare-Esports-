-- Sponsor image for the A4 slot-list report. Run once.
alter table public.tournaments add column if not exists sponsor_url text;
select pg_notify('pgrst', 'reload schema');

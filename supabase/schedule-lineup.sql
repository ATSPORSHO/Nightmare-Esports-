-- Lets each scheduled match belong to a lineup. Run once (needs organization.sql first).
alter table public.match_schedule
  add column if not exists lineup_id uuid references public.lineups(id) on delete set null;

update public.match_schedule
  set lineup_id = (select id from public.lineups where slug = 'nightmare-esports')
  where lineup_id is null;

select pg_notify('pgrst', 'reload schema');

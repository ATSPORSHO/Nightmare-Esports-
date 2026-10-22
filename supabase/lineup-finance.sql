-- Lineup for costs, income and training sessions. Run once (after organization.sql).
alter table public.expenses          add column if not exists lineup_id uuid references public.lineups(id) on delete set null;
alter table public.income            add column if not exists lineup_id uuid references public.lineups(id) on delete set null;
alter table public.training_sessions add column if not exists lineup_id uuid references public.lineups(id) on delete set null;

-- everything entered so far belongs to Nightmare Esports
update public.expenses          set lineup_id = (select id from public.lineups where slug = 'nightmare-esports') where lineup_id is null;
update public.income            set lineup_id = (select id from public.lineups where slug = 'nightmare-esports') where lineup_id is null;
update public.training_sessions set lineup_id = (select id from public.lineups where slug = 'nightmare-esports') where lineup_id is null;

select pg_notify('pgrst', 'reload schema');

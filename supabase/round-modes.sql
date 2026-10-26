-- Per round: qualify by group or overall, and what visitors see (per group / overall / both).
-- Run once in Supabase -> SQL Editor (new tab).
alter table public.tournament_rounds add column if not exists qualify_mode    text not null default 'group';
alter table public.tournament_rounds add column if not exists qualify_overall int  not null default 0;
alter table public.tournament_rounds add column if not exists result_view     text not null default 'both';
select pg_notify('pgrst', 'reload schema');

-- Fixes: null value in column "reg_code" of relation "treg_entries" violates not-null constraint
-- (lets a cancelled registration give its token number back). Run in Supabase -> SQL Editor (new tab).
alter table public.treg_entries add column if not exists cancelled_code int;
alter table public.treg_entries alter column reg_code drop not null;
alter table public.treg_entries alter column reg_code drop default;
select column_name, is_nullable, column_default from information_schema.columns
 where table_schema = 'public' and table_name = 'treg_entries' and column_name in ('reg_code', 'cancelled_code');
select pg_notify('pgrst', 'reload schema');

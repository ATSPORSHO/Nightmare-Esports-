-- Players only see finance + training of THEIR OWN lineup (admin and management see all).
-- Run once, after organization.sql and lineup-finance.sql.

create or replace function public.my_lineup() returns uuid
language sql stable security definer set search_path = public as $$
  select lineup_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'management'));
$$;

grant execute on function public.my_lineup() to anon, authenticated;
grant execute on function public.is_staff()  to anon, authenticated;

drop policy if exists "expenses read members" on public.expenses;
create policy "expenses read members" on public.expenses for select to authenticated
  using (public.is_staff() or lineup_id is null or lineup_id = public.my_lineup());

drop policy if exists "income read members" on public.income;
create policy "income read members" on public.income for select to authenticated
  using (public.is_staff() or lineup_id is null or lineup_id = public.my_lineup());

drop policy if exists "training_sessions read members" on public.training_sessions;
create policy "training_sessions read members" on public.training_sessions for select to authenticated
  using (public.is_staff() or lineup_id is null or lineup_id = public.my_lineup());

-- guests (not logged in) may read which lineup a training session belongs to
grant select (lineup_id) on public.training_sessions to anon;

select pg_notify('pgrst', 'reload schema');

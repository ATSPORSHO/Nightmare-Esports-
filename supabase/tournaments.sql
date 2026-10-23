-- Active tournaments organized by the organization (shown on the home page).
-- Run once: SQL Editor -> new tab -> paste -> Run.
create table if not exists public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  logo_url    text,
  prize_pool  text,
  start_date  date not null default current_date,
  end_date    date,
  teams       int,
  description text,
  link_url    text,
  active      boolean not null default true,
  sort        int not null default 0
);

alter table public.tournaments enable row level security;

drop policy if exists "tournaments read members" on public.tournaments;
drop policy if exists "tournaments read guest"   on public.tournaments;
drop policy if exists "tournaments admin write"  on public.tournaments;
create policy "tournaments read members" on public.tournaments for select to authenticated using (true);
create policy "tournaments read guest"   on public.tournaments for select to anon using (true);
create policy "tournaments admin write"  on public.tournaments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.tournaments to anon;
grant select, insert, update, delete on public.tournaments to authenticated;

select pg_notify('pgrst', 'reload schema');

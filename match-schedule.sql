-- Upcoming match schedule. Run once in Supabase -> SQL Editor.
create table if not exists public.match_schedule (
  id          uuid primary key default gen_random_uuid(),
  match_date  date not null,
  match_time  time not null default '20:00',
  tournament  text not null,
  stage       text,
  map         text,
  notes       text
);

alter table public.match_schedule enable row level security;

create policy "match_schedule read members" on public.match_schedule for select to authenticated using (true);
create policy "match_schedule read guest"   on public.match_schedule for select to anon using (public.guest_ok());
create policy "match_schedule admin write"  on public.match_schedule for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.match_schedule to anon;
grant select, insert, update, delete on public.match_schedule to authenticated;

-- Tournament teams, random group draw and slot lists. Run once (after tournaments.sql).
create table if not exists public.tournament_groups (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null,
  match_date    date,
  match_time    time,
  match_note    text,
  qualify       int  not null default 8,
  slot_start    int  not null default 2 check (slot_start between 2 and 25),
  sort          int  not null default 0
);

create table if not exists public.tournament_teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null,
  is_ours       boolean not null default false,
  group_id      uuid references public.tournament_groups(id) on delete set null,
  slot          int check (slot between 2 and 25)
);

alter table public.tournament_groups enable row level security;
alter table public.tournament_teams  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tournament_groups','tournament_teams'] loop
    execute format('drop policy if exists "%1$s read all" on public.%1$s', t);
    execute format('drop policy if exists "%1$s admin write" on public.%1$s', t);
    execute format('create policy "%1$s read all" on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('create policy "%1$s admin write" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('grant select on public.%1$s to anon', t);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', t);
  end loop;
end $$;

select pg_notify('pgrst', 'reload schema');

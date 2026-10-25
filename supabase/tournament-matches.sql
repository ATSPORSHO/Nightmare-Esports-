-- Match-by-match results for tournaments. Run once in Supabase -> SQL Editor (new tab),
-- after tournament-results.sql.
alter table public.tournament_group_teams add column if not exists mp int not null default 0;  -- matches played

create table if not exists public.tournament_matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_id      uuid not null references public.tournament_groups(id) on delete cascade,
  number        int  not null,
  created_at    timestamptz not null default now(),
  unique (group_id, number)
);

create table if not exists public.tournament_match_results (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references public.tournament_matches(id) on delete cascade,
  team_id   uuid not null references public.tournament_teams(id) on delete cascade,
  placement int check (placement between 1 and 25),
  kills     int not null default 0,
  unique (match_id, team_id)
);

alter table public.tournament_matches        enable row level security;
alter table public.tournament_match_results  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tournament_matches','tournament_match_results'] loop
    execute format('drop policy if exists "%1$s read all" on public.%1$s', t);
    execute format('drop policy if exists "%1$s admin write" on public.%1$s', t);
    execute format('create policy "%1$s read all" on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('create policy "%1$s admin write" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('grant select on public.%1$s to anon', t);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', t);
  end loop;
end $$;

select pg_notify('pgrst', 'reload schema');

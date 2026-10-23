-- Multiple rounds per tournament (Round 1 -> qualified teams -> Round 2 ...). Run once,
-- after tournament-groups.sql. Existing groups are moved into a round automatically.

create table if not exists public.tournament_rounds (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null,
  sort          int  not null default 0
);

alter table public.tournament_groups add column if not exists round text;
alter table public.tournament_groups add column if not exists round_id uuid references public.tournament_rounds(id) on delete cascade;

create table if not exists public.tournament_group_teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_id      uuid not null references public.tournament_groups(id) on delete cascade,
  team_id       uuid not null references public.tournament_teams(id) on delete cascade,
  slot          int check (slot between 2 and 25),
  qualified     boolean not null default false
);

alter table public.tournament_rounds      enable row level security;
alter table public.tournament_group_teams enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tournament_rounds','tournament_group_teams'] loop
    execute format('drop policy if exists "%1$s read all" on public.%1$s', t);
    execute format('drop policy if exists "%1$s admin write" on public.%1$s', t);
    execute format('create policy "%1$s read all" on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('create policy "%1$s admin write" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('grant select on public.%1$s to anon', t);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', t);
  end loop;
end $$;

-- move already drawn groups into rounds + keep their teams
do $$
declare r record; rid uuid;
begin
  for r in
    select distinct tournament_id, coalesce(nullif(round, ''), 'Round 1') as rname
    from public.tournament_groups where round_id is null
  loop
    insert into public.tournament_rounds (tournament_id, name, sort)
    values (r.tournament_id, r.rname, 1) returning id into rid;
    update public.tournament_groups
       set round_id = rid
     where tournament_id = r.tournament_id and round_id is null
       and coalesce(nullif(round, ''), 'Round 1') = r.rname;
  end loop;

  insert into public.tournament_group_teams (tournament_id, group_id, team_id, slot)
  select t.tournament_id, t.group_id, t.id, t.slot
  from public.tournament_teams t
  where t.group_id is not null
    and not exists (select 1 from public.tournament_group_teams x where x.team_id = t.id and x.group_id = t.group_id);
end $$;

select pg_notify('pgrst', 'reload schema');

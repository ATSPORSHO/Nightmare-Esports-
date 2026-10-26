-- Fixes "null value in column ... of relation tournament_team_players" (old table with extra required columns).
-- Run once in Supabase -> SQL Editor (new tab).
alter table public.tournament_team_players add column if not exists team_id uuid;
alter table public.tournament_team_players add column if not exists name text;
alter table public.tournament_team_players add column if not exists photo_url text;
alter table public.tournament_team_players add column if not exists sort int not null default 0;
alter table public.tournament_team_players add column if not exists tournament_id uuid;

-- make every OTHER column optional (tournament_id, player_id, ...), keep id/team_id/name as they are
do $$
declare c record;
begin
  for c in
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'tournament_team_players'
       and is_nullable = 'NO' and column_default is null
       and column_name not in ('id', 'team_id', 'name')
  loop
    execute format('alter table public.tournament_team_players alter column %I drop not null', c.column_name);
  end loop;
end $$;

-- fill tournament_id automatically
create or replace function public.set_player_tournament() returns trigger language plpgsql as $$
begin
  if new.tournament_id is null then
    select tournament_id into new.tournament_id from public.tournament_teams where id = new.team_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_set_player_tournament on public.tournament_team_players;
create trigger trg_set_player_tournament before insert on public.tournament_team_players
  for each row execute function public.set_player_tournament();

-- show the final columns so we can double-check
select column_name, is_nullable, column_default from information_schema.columns
 where table_schema = 'public' and table_name = 'tournament_team_players' order by ordinal_position;

select pg_notify('pgrst', 'reload schema');

-- make sure everybody can SEE players (public tournament page) and admins can edit them
alter table public.tournament_team_players enable row level security;
drop policy if exists "tournament_team_players read all"   on public.tournament_team_players;
drop policy if exists "tournament_team_players admin write" on public.tournament_team_players;
create policy "tournament_team_players read all"    on public.tournament_team_players for select to anon, authenticated using (true);
create policy "tournament_team_players admin write" on public.tournament_team_players for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.tournament_team_players to anon;
grant select, insert, update, delete on public.tournament_team_players to authenticated;
select pg_notify('pgrst', 'reload schema');

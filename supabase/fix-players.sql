-- Fixes "null value in column tournament_id of relation tournament_team_players".
-- Run once in Supabase -> SQL Editor (new tab).
alter table public.tournament_team_players add column if not exists tournament_id uuid;
alter table public.tournament_team_players add column if not exists photo_url text;
alter table public.tournament_team_players add column if not exists sort int not null default 0;
alter table public.tournament_team_players alter column tournament_id drop not null;

-- fill the tournament id for players that already exist
update public.tournament_team_players p
   set tournament_id = t.tournament_id
  from public.tournament_teams t
 where t.id = p.team_id and p.tournament_id is null;

-- and fill it automatically for every new player
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

select pg_notify('pgrst', 'reload schema');

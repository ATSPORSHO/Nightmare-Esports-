-- Each player only sees information of THEIR OWN lineup (the one chosen when the account was created).
-- Admin and Management see everything. Run once, after lineup-privacy.sql.

-- players list: yourself + your lineup mates (staff see all)
drop policy if exists "profiles read members" on public.profiles;
create policy "profiles read members" on public.profiles for select to authenticated
  using (public.is_staff() or id = auth.uid() or lineup_id = public.my_lineup());

-- match results
drop policy if exists "matches read members" on public.matches;
create policy "matches read members" on public.matches for select to authenticated
  using (public.is_staff() or lineup_id is null or lineup_id = public.my_lineup());

-- per-player stats follow the match (matches already filtered by the rule above)
drop policy if exists "match_player_stats read members" on public.match_player_stats;
create policy "match_player_stats read members" on public.match_player_stats for select to authenticated
  using (exists (select 1 from public.matches m where m.id = match_player_stats.match_id));

-- upcoming match schedule
do $$
begin
  if to_regclass('public.match_schedule') is not null then
    drop policy if exists "match_schedule read members" on public.match_schedule;
    create policy "match_schedule read members" on public.match_schedule for select to authenticated
      using (public.is_staff() or lineup_id is null or lineup_id = public.my_lineup());
  end if;
end $$;

-- roster view used on the public home page: no other lineup's players for logged-in players
drop view if exists public.public_roster;
create view public.public_roster with (security_invoker = false) as
  select p.id, p.full_name, p.ign, p.player_role, p.status, p.avatar_url, p.sort_order, p.lineup_id,
         case when public.guest_ok() or auth.uid() is not null then p.game_uid end as game_uid
  from public.profiles p
  where p.role = 'player'
    and (
      (auth.uid() is not null and (public.is_staff() or p.lineup_id = public.my_lineup()))
      or exists (select 1 from public.lineups l where l.id = p.lineup_id and l.is_public and l.active)
    );
grant select on public.public_roster to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

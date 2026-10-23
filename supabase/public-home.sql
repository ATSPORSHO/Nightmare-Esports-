-- Public home page rules. Run once (after organization.sql).
--  * each lineup can be hidden from the public (visitors who are not logged in)
--  * the home page (lineups, player pictures + names, events) stays visible even when
--    "Allow guests to view the dashboard" is switched off. Nothing else does.

alter table public.lineups add column if not exists is_public boolean not null default false;
-- Nightmare Esports is public; every other lineup is hidden until you tick "public" in Admin -> Lineups
update public.lineups set is_public = (slug = 'nightmare-esports');

drop policy if exists "lineups read guest" on public.lineups;
create policy "lineups read guest" on public.lineups for select to anon using (is_public);

drop policy if exists "events read guest" on public.events;
create policy "events read guest" on public.events for select to anon using (true);

-- public roster: names + pictures only. UID only when guests are allowed to see the dashboard.
drop view if exists public.public_roster;
create view public.public_roster with (security_invoker = false) as
  select p.id, p.full_name, p.ign, p.player_role, p.status, p.avatar_url, p.sort_order, p.lineup_id,
         case when public.guest_ok() or auth.uid() is not null then p.game_uid end as game_uid
  from public.profiles p
  where p.role = 'player'
    and (auth.uid() is not null
         or exists (select 1 from public.lineups l where l.id = p.lineup_id and l.is_public and l.active));
grant select on public.public_roster to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

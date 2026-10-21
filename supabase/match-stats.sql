-- Extra per-player match stats + who played. Run once in Supabase -> SQL Editor.
alter table public.match_player_stats add column if not exists damage          numeric not null default 0;
alter table public.match_player_stats add column if not exists assists         int     not null default 0;
alter table public.match_player_stats add column if not exists rating          numeric;
alter table public.match_player_stats add column if not exists survival_minutes numeric not null default 0;

create or replace view public.public_roster with (security_invoker = false) as
  select id, full_name, ign, player_role, status, avatar_url, sort_order, game_uid
  from public.profiles
  where role = 'player' and (public.guest_ok() or auth.uid() is not null);
grant select on public.public_roster to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

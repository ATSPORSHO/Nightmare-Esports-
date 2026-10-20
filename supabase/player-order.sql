-- Roster order controlled by the admin. Run once in Supabase -> SQL Editor.
alter table public.profiles add column if not exists sort_order int not null default 9999;

-- give everyone a starting position (oldest account first), only if never ordered
with ranked as (
  select id, row_number() over (order by created_at) as rn
  from public.profiles where role = 'player' and sort_order = 9999
)
update public.profiles p set sort_order = r.rn from ranked r where p.id = r.id;

create or replace view public.public_roster with (security_invoker = false) as
  select id, full_name, ign, player_role, status, avatar_url, sort_order
  from public.profiles
  where role = 'player' and (public.guest_ok() or auth.uid() is not null);
grant select on public.public_roster to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

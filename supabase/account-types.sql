-- Adds the "management" account type. Run once: SQL Editor -> new tab -> paste -> Run.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%(role = %'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'player', 'management'));

select pg_notify('pgrst', 'reload schema');

-- Fixes "null value in column ... of relation tournament_match_results / tournament_matches".
-- (An older table with the same name has extra required columns.) Run once in Supabase -> SQL Editor (new tab).
alter table public.tournament_matches add column if not exists tournament_id uuid;
alter table public.tournament_matches add column if not exists group_id uuid;
alter table public.tournament_matches add column if not exists number int;
alter table public.tournament_matches add column if not exists created_at timestamptz not null default now();
alter table public.tournament_match_results add column if not exists match_id uuid;
alter table public.tournament_match_results add column if not exists team_id uuid;
alter table public.tournament_match_results add column if not exists placement int;
alter table public.tournament_match_results add column if not exists kills int not null default 0;
alter table public.tournament_group_teams add column if not exists mp int not null default 0;

-- make every column we do not use optional
do $$
declare c record;
begin
  for c in
    select table_name, column_name from information_schema.columns
     where table_schema = 'public' and table_name in ('tournament_matches', 'tournament_match_results')
       and is_nullable = 'NO' and column_default is null
       and column_name not in ('id', 'match_id', 'team_id', 'tournament_id', 'group_id', 'number')
  loop
    execute format('alter table public.%I alter column %I drop not null', c.table_name, c.column_name);
  end loop;
end $$;

-- permissions
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

-- show the final columns
select table_name, column_name, is_nullable, column_default from information_schema.columns
 where table_schema = 'public' and table_name in ('tournament_matches', 'tournament_match_results')
 order by table_name, ordinal_position;

select pg_notify('pgrst', 'reload schema');

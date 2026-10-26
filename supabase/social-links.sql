-- Social media links for the home page. Run once in Supabase -> SQL Editor (new tab).
alter table public.settings add column if not exists social_facebook  text;
alter table public.settings add column if not exists social_instagram text;
alter table public.settings add column if not exists social_youtube   text;
alter table public.settings add column if not exists social_discord   text;
select pg_notify('pgrst', 'reload schema');

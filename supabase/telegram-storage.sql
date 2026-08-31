create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  course integer default 1,
  faculty text,
  xp integer default 0,
  streak integer default 0,
  last_active timestamptz default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists handle text;
alter table public.profiles add column if not exists tg_id text;
alter table public.profiles add column if not exists language_code text;
alter table public.profiles add column if not exists is_premium boolean default false;
alter table public.profiles add column if not exists photo_url text;
alter table public.profiles add column if not exists created_at timestamptz default now();

update public.profiles
set tg_id = substring(lower(email) from '^tg([0-9]+)@(users\.)?anatomapp\.ru$')
where tg_id is null
  and lower(email) ~ '^tg[0-9]+@(users\.)?anatomapp\.ru$'
  and not exists (
    select 1 from public.profiles existing
    where existing.tg_id = substring(lower(profiles.email) from '^tg([0-9]+)@(users\.)?anatomapp\.ru$')
  );
create unique index if not exists profiles_tg_id_unique
  on public.profiles (tg_id) where tg_id is not null;

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.user_state enable row level security;

-- RLS was enabled above with no policies defined, which denies all access
-- by default to anything but the service role. The server-side api/*.js
-- functions use the service role key and are unaffected, but the client
-- (AnatomDB in index.html, used for direct email/password auth) reads and
-- writes these tables with the user's own session and needs explicit
-- policies -- without these, getProfile/saveState/leaderboard would
-- silently return nothing rather than error.

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- The rating screen reads other users' name/xp/streak/course/faculty via
-- the client (AnatomDB.leaderboard()/allUsers() in index.html). It must
-- NOT be able to read email/username/handle/tg_id for other users, so
-- this is deliberately not a blanket "authenticated can read all of
-- profiles" policy -- that would leak every user's email to every other
-- logged-in user. Instead, expose only the safe columns through a view,
-- pre-deduplicated/filtered the same way the client used to do it with
-- the raw email (matching legacy tg-placeholder accounts and the
-- user999 test account) so the client can drop that logic once it
-- queries this view instead of the table directly.
create or replace view public.leaderboard_public
with (security_invoker = false) as
select distinct on (dedup_key)
  id, name, xp, streak, course, faculty, last_active
from (
  select p.*,
    coalesce(nullif(lower(trim(p.email)), ''), 'id:' || p.id::text) as dedup_key
  from public.profiles p
  where lower(coalesce(p.email, '')) !~ '^tg[0-9]+@(mail\.ru|yandex\.ru)$'
    and lower(coalesce(p.email, '')) <> 'user999@anatomapp.ru'
) ranked
order by dedup_key, xp desc nulls last;

grant select on public.leaderboard_public to authenticated;

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "user_state_select_own" on public.user_state;
create policy "user_state_select_own" on public.user_state
  for select using (auth.uid() = user_id);

drop policy if exists "user_state_insert_own" on public.user_state;
create policy "user_state_insert_own" on public.user_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_state_update_own" on public.user_state;
create policy "user_state_update_own" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

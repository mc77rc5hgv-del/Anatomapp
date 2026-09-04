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
-- policies -- without these, getProfile/saveState/saveProfile would
-- silently return nothing rather than error.

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- The rating screen deliberately does NOT read profiles for other users --
-- profiles_select_own above is intentionally own-row-only, so it can't leak
-- other users' emails. AnatomDB.leaderboard()/allUsers() in index.html
-- instead reads the separate public.leaderboard table, which was created
-- directly in Supabase (not by this file) and never had an email column to
-- begin with -- see it in the dashboard's table editor if it needs
-- changes; there's nothing to add here for it.

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

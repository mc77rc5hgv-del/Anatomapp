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
set tg_id = substring(lower(email) from '^tg([0-9]+)@users\.anatomapp\.ru$')
where tg_id is null
  and lower(email) ~ '^tg[0-9]+@users\.anatomapp\.ru$'
  and not exists (
    select 1 from public.profiles existing
    where existing.tg_id = substring(lower(profiles.email) from '^tg([0-9]+)@users\.anatomapp\.ru$')
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

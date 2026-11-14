-- Our Little Universe: database schema.
-- Run this whole file once in the Supabase SQL editor.
-- Then add the two email addresses (see the bottom of this file or the README).
--
-- Security model: every table has Row Level Security (RLS) turned on, and every policy
-- requires public.is_allowed(), which is true only for the two emails in allowed_users.
-- The anon key in config.js is public by design; RLS is what protects the data.

-- ---------------------------------------------------------------------------
-- 1. The guest list: exactly two emails.
-- ---------------------------------------------------------------------------
create table if not exists public.allowed_users (
  email text primary key check (email = lower(email))
);
-- RLS on with NO policies: the API can never read or edit this table.
-- Only the SQL editor (and the security-definer function below) can.
alter table public.allowed_users enable row level security;

-- True when the signed-in user's email is on the guest list.
-- security definer lets it read allowed_users even though API roles cannot.
create or replace function public.is_allowed()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_allowed() from public, anon;
grant execute on function public.is_allowed() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. profiles: display name, which character (her|him) and settings (jsonb).
--    Both people can read both rows; each can only write their own.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  character text not null unique check (character in ('her', 'him')),
  display_name text not null default '',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles read" on public.profiles for select to authenticated using (public.is_allowed());
create policy "profiles insert own" on public.profiles for insert to authenticated with check (public.is_allowed() and user_id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using (public.is_allowed() and user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles delete own" on public.profiles for delete to authenticated using (public.is_allowed() and user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. last_seen: the pretend place and activity of each person.
--    visibility = live | lastSeenOnly | offline. When offline the app stores null location/activity.
-- ---------------------------------------------------------------------------
create table if not exists public.last_seen (
  user_id uuid primary key references auth.users(id) on delete cascade,
  character text not null check (character in ('her', 'him')),
  location text,
  activity text,
  visibility text not null default 'live' check (visibility in ('live', 'lastSeenOnly', 'offline')),
  updated_at timestamptz not null default now()
);
alter table public.last_seen enable row level security;
create policy "last_seen read" on public.last_seen for select to authenticated using (public.is_allowed());
create policy "last_seen insert own" on public.last_seen for insert to authenticated with check (public.is_allowed() and user_id = auth.uid());
create policy "last_seen update own" on public.last_seen for update to authenticated using (public.is_allowed() and user_id = auth.uid()) with check (user_id = auth.uid());
create policy "last_seen delete own" on public.last_seen for delete to authenticated using (public.is_allowed() and user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. letters: left at a pretend location. read_at is the reader's own bookkeeping;
--    the app never shows it to the sender and never notifies anyone when a letter is read.
-- ---------------------------------------------------------------------------
create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references auth.users(id) on delete cascade,
  from_char text not null check (from_char in ('her', 'him')),
  to_char text not null check (to_char in ('her', 'him')),
  location text not null,
  body text not null check (char_length(body) between 1 and 5000),
  seal text not null default 'star' check (seal in ('star', 'heart', 'chip')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.letters enable row level security;
create policy "letters read" on public.letters for select to authenticated using (public.is_allowed());
create policy "letters insert own" on public.letters for insert to authenticated with check (public.is_allowed() and sender = auth.uid());
-- Only the person who did NOT write a letter may update it (that is how it gets marked as read).
create policy "letters mark read" on public.letters for update to authenticated using (public.is_allowed() and sender <> auth.uid());
create policy "letters delete own" on public.letters for delete to authenticated using (public.is_allowed() and sender = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. xo_game: ONE shared row (id = 1). rev is used for optimistic concurrency.
-- ---------------------------------------------------------------------------
create table if not exists public.xo_game (
  id int primary key default 1 check (id = 1),
  board jsonb not null default '[null,null,null,null,null,null,null,null,null]'::jsonb,
  turn text not null default 'X' check (turn in ('X', 'O')),
  winner text check (winner in ('X', 'O', 'draw')),
  line jsonb,
  scores jsonb not null default '{"X":0,"O":0,"draw":0}'::jsonb,
  rev int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.xo_game enable row level security;
create policy "xo read" on public.xo_game for select to authenticated using (public.is_allowed());
create policy "xo insert" on public.xo_game for insert to authenticated with check (public.is_allowed());
create policy "xo update" on public.xo_game for update to authenticated using (public.is_allowed()) with check (public.is_allowed());

-- ---------------------------------------------------------------------------
-- 6. plants and plant_log (the care log). Plants droop but never die: the water
--    meter is computed in the app from watered_at.
-- ---------------------------------------------------------------------------
create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('lavender', 'sunflower', 'moon-cactus', 'fern', 'violet-orchid', 'lemon-tree')),
  label text not null,
  pot_color text not null default '#F6C945',
  by_char text not null check (by_char in ('her', 'him')),
  planted_at timestamptz not null default now(),
  watered_at timestamptz not null default now(),
  sun_at timestamptz,
  sung_at timestamptz
);
alter table public.plants enable row level security;
create policy "plants read" on public.plants for select to authenticated using (public.is_allowed());
create policy "plants insert" on public.plants for insert to authenticated with check (public.is_allowed());
create policy "plants update" on public.plants for update to authenticated using (public.is_allowed()) with check (public.is_allowed());
create policy "plants delete" on public.plants for delete to authenticated using (public.is_allowed());

create table if not exists public.plant_log (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references public.plants(id) on delete set null, -- the log outlives a removed plant
  plant_name text not null,
  by_char text not null check (by_char in ('her', 'him')),
  action text not null check (action in ('plant', 'water', 'sun', 'sing', 'remove')),
  at timestamptz not null default now()
);
alter table public.plant_log enable row level security;
create policy "plant_log read" on public.plant_log for select to authenticated using (public.is_allowed());
create policy "plant_log insert" on public.plant_log for insert to authenticated with check (public.is_allowed());

-- ---------------------------------------------------------------------------
-- 7. Realtime: broadcast row changes for the tables the app watches.
--    (If a line errors with "already member of publication", that table is already on; skip it.)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.last_seen;
alter publication supabase_realtime add table public.letters;
alter publication supabase_realtime add table public.xo_game;
alter publication supabase_realtime add table public.plants;
alter publication supabase_realtime add table public.plant_log;

-- ---------------------------------------------------------------------------
-- 8. Realtime Presence + wave events use a PRIVATE channel named "universe".
--    These policies let only the two allowed users join it. Also open
--    Project Settings > Realtime and turn OFF "Allow public access".
-- ---------------------------------------------------------------------------
create policy "universe channel read" on realtime.messages for select to authenticated
  using (public.is_allowed() and realtime.topic() = 'universe');
create policy "universe channel write" on realtime.messages for insert to authenticated
  with check (public.is_allowed() and realtime.topic() = 'universe');

-- ---------------------------------------------------------------------------
-- 9. The guest list. Replace with your two emails (lowercase), then run:
-- ---------------------------------------------------------------------------
-- insert into public.allowed_users (email) values ('her@example.com'), ('him@example.com');

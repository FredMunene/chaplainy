-- Chaplain Supabase Schema (MVP)
-- Run this in Supabase SQL Editor

-- ============================================
-- TABLES
-- ============================================

-- Profiles
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  privy_id text unique,
  display_name text,
  created_at timestamptz default now()
);

-- Sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  host_wallet text not null,
  title text not null,
  source text not null,
  status text not null default 'draft',
  entry_cap int,
  prize_pool_wei numeric(78,0),
  chain_id bigint not null,
  created_at timestamptz default now()
);

-- Questions
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  question text not null,
  choices jsonb not null,
  correct_hash text not null,
  index_in_session int not null
);

-- Submissions
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  player_wallet text not null,
  question_id uuid references questions(id) on delete cascade,
  answer_choice text not null,
  submitted_at timestamptz default now(),
  proof_hash text,
  workflow_run_id text
);

-- Scores
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  player_wallet text not null,
  total_score int not null,
  proof_hash text not null,
  tx_hash text,
  updated_at timestamptz default now()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on tables
alter table profiles enable row level security;
alter table sessions enable row level security;
alter table questions enable row level security;
alter table submissions enable row level security;
alter table scores enable row level security;

-- Profiles: owner can read/write their own profile
create policy "profiles_select_own"
on profiles for select
using (wallet_address = auth.jwt()->>'wallet');

create policy "profiles_upsert_own"
on profiles for insert
with check (wallet_address = auth.jwt()->>'wallet');

create policy "profiles_update_own"
on profiles for update
using (wallet_address = auth.jwt()->>'wallet');

-- Sessions: host can create and update; everyone can read public sessions
create policy "sessions_select_all"
on sessions for select
using (true);

create policy "sessions_insert_host"
on sessions for insert
with check (host_wallet = auth.jwt()->>'wallet');

create policy "sessions_update_host"
on sessions for update
using (host_wallet = auth.jwt()->>'wallet');

-- DEV ONLY: allow anon inserts while auth wiring is in progress
create policy "sessions_insert_anon_dev"
on sessions for insert
with check (true);

-- Questions: read-only for all; write from service role in workflows
create policy "questions_select_all"
on questions for select
using (true);

-- Submissions: player can insert/select their own
create policy "submissions_select_own"
on submissions for select
using (player_wallet = auth.jwt()->>'wallet');

create policy "submissions_insert_own"
on submissions for insert
with check (player_wallet = auth.jwt()->>'wallet');

-- Scores: read-only for all; write via service role or contract sync
create policy "scores_select_all"
on scores for select
using (true);

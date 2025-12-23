-- Chaplain Supabase schema (MVP)

-- Enable extensions if needed
-- create extension if not exists "pgcrypto";

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

-- RLS policies to add in Supabase:
-- profiles.wallet_address = auth.jwt()->>'wallet'
-- sessions.host_wallet = auth.jwt()->>'wallet' for write access
-- submissions.player_wallet = auth.jwt()->>'wallet' for insert/select

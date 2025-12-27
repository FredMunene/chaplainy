# Chaplain – Product & Technical Spec

## Goal
Build a Kahoot-like on-chain quiz game that uses KRNL workflows to privately verify answers, while recording transparent scores and distributing rewards on-chain.

## User stories
- As a **player**, I can join a quiz using a Privy-managed wallet (smart account via EIP-7702) without worrying about gas.
- As a **host**, I can start a quiz lobby, pick a trivia source, set entry rules (time limit, participant cap, prize pot), and publish the game link.
- As a **player**, I can answer timed questions; my responses are verified privately and attested on-chain to update the leaderboard.
- As a **viewer**, I can see a live leaderboard and final results with verifiable proofs.
- As an **admin**, I can moderate trivia sources, manage reward pools, and audit proofs.

## Functional requirements
- Fetch questions dynamically from a trivia API (default: Open Trivia DB) via KRNL workflow `quiz_fetch` (JSON workflow config).
- Validate answers off-chain via KRNL workflow `quiz_verify`; return an attested proof with score metadata.
- Contract `QuizSCA.sol` must:
  - Verify KRNL attestation signature, nonce, and expiration.
  - Update on-chain leaderboard (scores per session, per player).
  - Emit events for frontend consumption.
- Gas abstraction: all player actions should run through delegated smart accounts (EIP-7702) with sponsor support.
- Frontend:
  - Lobby creation/join, countdown, question UI, answer submission, progress state.
  - Leaderboard view with proof hashes/links.
  - Wallet onboarding via Privy and KRNL SDK hooks.
- Data layer (Supabase):
  - `profiles` (user metadata + wallet binding),
  - `sessions` (quiz metadata, host, prize info),
  - `questions` (cached fetched questions per session),
  - `submissions` (off-chain answers, timestamps, proof refs),
  - `scores` (per player, per session, stored once proof is accepted).
- Observability: capture audit events for workflow runs and contract transactions.
- Admin tooling: toggle trivia sources, view failed attestations, regenerate leaderboards.

## Non-functional requirements
- Security: replay protection, attestation expiry, per-session nonces, signature domain separation.
- Privacy: answers verified off-chain; only proof hashes and scores are on-chain.
- Availability: tolerate trivia API downtime with cached questions and retry.
- Performance: <200ms median workflow latency for verification; frontend optimistic updates with proof confirmation.
- Compliance: rate-limit APIs; enforce Supabase RLS per user/session.
- Testability: unit tests for contract and workflows; integration tests across workflow + contract; E2E for frontend flows.

## System design (summary)
- Frontend (React/Vite) -> calls `quiz_fetch.krnl` to start session and cache questions in Supabase -> players answer -> frontend calls `quiz_verify.krnl` with answer + session nonce -> workflow returns attestation -> frontend submits proof to `QuizSCA.sol` -> contract validates and updates leaderboard -> events push to frontend via provider or Supabase realtime. (Target chain: Sepolia)

## Data model (Supabase, draft)
```sql
-- Profiles
create table profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  privy_id text unique,
  display_name text,
  created_at timestamptz default now()
);

-- Sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  host_wallet text not null,
  title text not null,
  source text not null, -- trivia api name
  status text not null default 'draft', -- draft|live|closed
  entry_cap int,
  prize_pool_wei numeric(78,0),
  chain_id bigint not null,
  created_at timestamptz default now()
);

-- Questions (cached per session)
create table questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  question text not null,
  choices jsonb not null,
  correct_hash text not null, -- hashed correct answer, not exposed to client
  index_in_session int not null
);

-- Submissions (off-chain answers)
create table submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  player_wallet text not null,
  question_id uuid references questions(id) on delete cascade,
  answer_choice text not null,
  submitted_at timestamptz default now(),
  proof_hash text, -- attestation hash from KRNL
  workflow_run_id text
);

-- Scores (once proof accepted on-chain)
create table scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  player_wallet text not null,
  total_score int not null,
  proof_hash text not null,
  tx_hash text,
  updated_at timestamptz default now()
);
```

RLS: `profiles.wallet_address = auth.jwt()->>'wallet'`; `sessions.host_wallet = current user` for writes; `submissions.player_wallet = current user` for insert/select.

## APIs/workflows
- `quiz_fetch(input: {source, count, difficulty}) -> {questions[], sessionNonce}`  
  - Calls trivia API, hashes correct answers, returns question payload for client, stores hashed answers in Supabase.
- `quiz_verify(input: {sessionId, questionId, answer, sessionNonce, player}) -> {attestation}`  
  - Checks nonce freshness, compares hashed answers, outputs attestation payload: `{sessionId, player, questionId, correct, scoreDelta, nonce, expiry, proofHash}` signed by attestor.

### KRNL doc notes (latest)
- KRNL defines a workflow as a **DAG**: "A **workflow** is a **directed acyclic graph (DAG)** of execution steps that combine Web2 services, blockchain interactions, and AI logic into a single verifiable process."  
  - Source: https://docs.krnl.xyz/core-concepts/workflows
- Workflows are represented as **JSON configs** in the docs (see "Structure of a Workflow" example). The docs do not specify a file extension, so name the files based on KRNL Studio/CLI output (commonly JSON).  
  - Source: https://docs.krnl.xyz/core-concepts/workflows
- The SDK requires Privy for account abstraction: "The KRNL SDK requires **Privy** for wallet integration and must be used with `@privy-io/react-auth`."  
  - Source: https://docs.krnl.xyz/krnl-sdk/usage

## Smart contract responsibilities
- Validate attestation (attestor address, expiry, nonce, session binding).
- Prevent replay by tracking `(sessionId, player, questionId)` and `nonce`.
- Accumulate scores per session; emit `ScoreUpdated(sessionId, player, total, proofHash)`.
- Optionally escrow/release prize pool to winners (phase 2).

## Frontend flows
- **Host creates session**: select trivia source -> call `quiz_fetch.krnl` to seed questions -> session stored in Supabase -> share lobby link.
- **Player joins**: connect via Privy -> receive session context and nonce -> watch countdown.
- **Answer**: choose option -> call `quiz_verify.krnl` -> show optimistic progress -> once attestation returned, call contract -> display confirmed score.
- **Leaderboard**: subscribe to contract events or Supabase `scores` updates; display proof links.

## Implementation steps (actionable)
1) Supabase: create project, run SQL above, enable RLS and JWT for wallet binding.
2) Contracts: scaffold Hardhat/Foundry; implement `QuizSCA.sol` with attestation verification helper; add tests for replay and invalid signer.
3) KRNL: configure node + attestor; write `quiz_fetch.krnl` and `quiz_verify.krnl`; set secrets for trivia API.
4) Frontend: set up Vite + Tailwind (or CSS modules); add Privy + KRNL SDK; implement lobby, quiz player, leaderboard.
5) Integration: connect frontend to workflows; wire contract submission; handle proof confirmation and retries.
6) Observability: log workflow runs, push to Supabase audit table; surface errors in UI.
7) Deployment: deploy contract to KRNL Testnet; host frontend (Vercel/Netlify); set env vars.
8) QA: run unit + integration + E2E; test fallback when trivia API fails.

## Acceptance criteria (MVP)
- Player can join with Privy wallet, answer at least 5 questions, receive on-chain score with attested proof.
- Contract rejects tampered proofs and replays.
- Leaderboard updates in near real time from contract events.
- Supabase enforces per-user isolation; trivia failures do not crash game (uses cached questions).

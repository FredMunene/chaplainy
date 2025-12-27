# Chaplain – On-Chain Quiz Game

Chaplain is a KRNL-powered quiz experience that brings Kahoot-style play to the blockchain. Quiz questions are fetched from external trivia APIs, verified off-chain through KRNL workflows, and finalized on-chain for transparent scoring. Wallet onboarding uses Privy and gas abstraction via EIP-7702 smart accounts.

## What you get
- React + Vite frontend with Privy onboarding and KRNL SDK hooks
- KRNL workflow templates to fetch questions and verify answers privately
- `QuizSCA.sol` contract to validate attestation proofs and update a leaderboard
- Supabase backing store for profiles, sessions, questions, submissions, and scores

## Quick outline
1) Read `docs/spec.md` for requirements and flows.  
2) See `docs/architecture.md` for system design and deployment topology.  
3) ADRs live in `docs/adr/`. Threat model in `docs/threat-model.md`.  
4) Implementation guide and task list are in `docs/implementation-plan.md` and `tasks.md`.

## Stack decisions (TL;DR)
- Frontend: React + Vite + TypeScript, Tailwind (or CSS modules), Privy for auth, @krnl-dev/sdk-react-7702 for attested calls.
- Workflows: `quiz_fetch.krnl` (pull questions), `quiz_verify.krnl` (check answers, emit attestation), KRNL node + attestor.
- Smart contracts: Solidity, EIP-7702 smart accounts for gas abstraction, attestation-aware `QuizSCA.sol`.
- Data: Supabase (Postgres + Row Level Security) for profiles, game sessions, audit events.
- Infra: Sepolia for contracts, hosted Supabase, static hosting (Vercel/Netlify) for the frontend.

## Development checklist
- [x] Stand up Supabase schema (`supabase/schema.sql`) and RLS (`supabase/rls.sql`).
- [x] Scaffold Vite + React + TypeScript app; add Privy + KRNL SDK and env wiring.
- [x] Draft `quiz_fetch` and `quiz_verify` workflow templates.
- [x] Implement `QuizSCA.sol`, tests, and deploy to Base Sepolia.
- [x] Build host/session UI, Supabase-backed session loading, and leaderboard view.
- [ ] Deploy workflows to KRNL node and verify Supabase writes.
- [ ] Submit proofs on-chain from the frontend in real workflow runs.
- [ ] Add E2E smoke tests and integration tests.
- [ ] Ship docs + demo; open source under MIT/Apache-2.0.

## Current progress
- Contract deployed: `QuizSCA` on Sepolia at `0x63cBcf35ea22FC674A23D453628398c60E1D05D5`
- Frontend routes: `/` (host), `/session/:id` (player session)
- Supabase integration: sessions, questions, submissions, scores
- KRNL workflow calls: `quiz_fetch` (host) and `quiz_verify` (session) wired in UI

## Environment (frontend)
Set values in `apps/web/.env`:
- `VITE_PRIVY_APP_ID`
- `VITE_KRNL_NODE_URL`
- `VITE_KRNL_DELEGATED_CONTRACT`
- `VITE_ATTESTOR_IMAGE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CONTRACT_ADDRESS`

## Build/run
```
pnpm install
pnpm dev
```
Contracts are managed via Foundry. Workflows are deployed via KRNL Studio/CLI; see `docs/architecture.md`.

## Roadmap (weeks align to the proposal)
- W1–2: Architecture, Supabase schema, contract skeleton, KRNL node setup.
- W3–4: Implement workflows and trivia adapter, contract-proof plumbing.
- W5: Deploy contract, connect workflows to on-chain registry.
- W6–7: Frontend experience, Privy onboarding, leaderboard UI.
- W8: Integration tests, KRNL Testnet deployment, docs.
- W9: Polish, demo, open-source release.

## Repo layout
- `apps/web/` – React frontend
- `contracts/` – Solidity + tests
- `workflows/` – KRNL workflow definitions
- `supabase/` – SQL migrations / seed data
- `docs/` – specs, ADRs, threat model

## Next actions
See `tasks.md` for current status and `docs/implementation-plan.md` for the build plan.

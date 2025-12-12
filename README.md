# Chaplain – On-Chain Quiz Game

Chaplain is a KRNL-powered quiz experience that brings Kahoot-style play to the blockchain. Quiz questions are fetched from external trivia APIs, verified off-chain through KRNL workflows, and finalized on-chain for transparent scoring. Wallet onboarding uses Privy and gas abstraction via EIP-7702 smart accounts.

## What you get
- React + Vite frontend with Privy onboarding and KRNL SDK hooks
- KRNL workflows to fetch questions and verify answers privately
- `QuizSCA.sol` contract to validate attestation proofs and update a leaderboard
- Supabase backing store for profiles, sessions, and analytics

## Quick outline
1) Read `docs/spec.md` for requirements and flows.  
2) See `docs/architecture.md` for system design and deployment topology.  
3) ADRs live in `docs/adr/`. Threat model in `docs/threat-model.md`.  
4) Implementation guide and task list are at the bottom of this file.

## Stack decisions (TL;DR)
- Frontend: React + Vite + TypeScript, Tailwind (or CSS modules), Privy for auth, @krnl-dev/sdk-react-7702 for attested calls.
- Workflows: `quiz_fetch.krnl` (pull questions), `quiz_verify.krnl` (check answers, emit attestation), KRNL node + attestor.
- Smart contracts: Solidity, EIP-7702 smart accounts for gas abstraction, attestation-aware `QuizSCA.sol`.
- Data: Supabase (Postgres + Row Level Security) for profiles, game sessions, audit events.
- Infra: KRNL Testnet for attestation registry, hosted Supabase, static hosting (Vercel/Netlify) for the frontend.

## Development checklist
- [ ] Stand up Supabase project; apply tables/SQL from `docs/spec.md`.
- [ ] Scaffold Vite + React + TypeScript app; add Privy + KRNL SDK and env wiring.
- [ ] Author `quiz_fetch.krnl` and `quiz_verify.krnl` workflows; connect to trivia API.
- [ ] Implement `QuizSCA.sol`; unit-test with Foundry/Hardhat; deploy to KRNL Testnet.
- [ ] Wire frontend flows (join lobby -> questions -> answer -> leaderboard).
- [ ] Add E2E smoke (Playwright/Cypress) and contract-workflow integration tests.
- [ ] Ship docs + demo; open source under MIT/Apache-2.0.

## Build/run (planned)
```
pnpm install
pnpm dev
```
Contracts and workflows will be run via Foundry/Hardhat and KRNL CLI respectively; see `docs/architecture.md` for commands and env vars once scaffolding is in place.

## Roadmap (weeks align to the proposal)
- W1–2: Architecture, Supabase schema, contract skeleton, KRNL node setup.
- W3–4: Implement workflows and trivia adapter, contract-proof plumbing.
- W5: Deploy contract, connect workflows to on-chain registry.
- W6–7: Frontend experience, Privy onboarding, leaderboard UI.
- W8: Integration tests, KRNL Testnet deployment, docs.
- W9: Polish, demo, open-source release.

## Repo layout (target)
- `apps/web/` – React frontend
- `contracts/` – Solidity + tests
- `workflows/` – KRNL workflow definitions
- `supabase/` – SQL migrations / seed data
- `docs/` – specs, ADRs, threat model

## Next actions
See the “Implementation steps” in `docs/spec.md` to start building.

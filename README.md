# Chaplainy – On-Chain Quiz Game

Chaplainy is a KRNL-powered quiz experience that brings Kahoot-style play to the blockchain. Quiz questions are fetched from external trivia APIs, verified off-chain through KRNL workflows and Supabase Edge Functions, and finalized on-chain for transparent scoring. Wallet onboarding uses Privy and gas abstraction via EIP-7702 smart accounts.

## What you get
- React + Vite frontend with Privy onboarding and KRNL SDK hooks
- KRNL workflow templates to fetch questions and verify answers privately
- Supabase Edge Functions for quiz logic (fetch, hash, verify)
- `QuizSCA.sol` contract to validate attestation proofs and update a leaderboard
- Supabase backing store for profiles, sessions, questions, submissions, and scores

## Quick outline
1) Watch `docs/video-walkthrough-script.md` for a complete demo flow.
2) Read `docs/spec.md` for requirements and flows.
3) See `docs/architecture.md` for system design and deployment topology.
4) ADRs live in `docs/adr/`. Threat model in `docs/threat-model.md`.
5) Implementation guide and task list are in `docs/implementation-plan.md`.

## Stack decisions (TL;DR)
- **Frontend:** React + Vite + TypeScript, Privy for auth, @krnl-dev/sdk-react-7702 for attested calls
- **Workflows:** `quiz_fetch` (pull questions), `quiz_verify` (check answers, emit attestation), KRNL node + attestor
- **Edge Functions:** Supabase Edge Functions handle transform/hash logic for quiz verification
- **Smart contracts:** Solidity, EIP-7702 smart accounts for gas abstraction, attestation-aware `QuizSCA.sol`
- **Data:** Supabase (Postgres + Row Level Security) for profiles, game sessions, audit events
- **Infra:** Sepolia for contracts, hosted Supabase, static hosting (Vercel/Netlify) for the frontend

## Development checklist
- [x] Stand up Supabase schema (`supabase/schema.sql`) and RLS (`supabase/rls.sql`)
- [x] Scaffold Vite + React + TypeScript app; add Privy + KRNL SDK and env wiring
- [x] Draft `quiz_fetch` and `quiz_verify` workflow templates
- [x] Implement `QuizSCA.sol`, tests, and deploy to Sepolia
- [x] Build host/session UI, Supabase-backed session loading, and leaderboard view
- [x] Create and deploy Supabase Edge Functions for quiz logic
- [x] Implement answer hashing and verification flow
- [x] Wire up complete quiz flow (host → player → leaderboard)
- [ ] Complete KRNL node integration for on-chain proof submission
- [ ] Add E2E smoke tests and integration tests
- [ ] Ship docs + demo; open source under MIT/Apache-2.0

## Current progress (v1.0.0)
- **Contract deployed:** `QuizSCA` on Sepolia at `0x63cBcf35ea22FC674A23D453628398c60E1D05D5`
- **Attestor image:** Built and pushed (`docker.io/fredgitonga/attestor-chaplainy:latest`)
- **Frontend routes:** `/` (host), `/session/:id` (player session)
- **Supabase Edge Functions:** `quiz-fetch` and `quiz-verify` deployed and working
- **Database:** Sessions, questions, submissions, scores tables with RLS
- **Quiz flow:** Complete end-to-end flow working (create quiz → join → answer → leaderboard)
- **KRNL workflows:** DSL definitions ready in `workflows/` directory

## Environment (frontend)
Set values in `apps/web/.env`:
```env
VITE_PRIVY_APP_ID=your-privy-app-id
VITE_KRNL_NODE_URL=https://node.krnl.xyz
VITE_KRNL_DELEGATED_CONTRACT=0xFFB5C2684532D8B24313Fc084d65DDaa0B946040
VITE_ATTESTOR_IMAGE=image://docker.io/fredgitonga/attestor-chaplainy:latest
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_CONTRACT_ADDRESS=0x63cBcf35ea22FC674A23D453628398c60E1D05D5
VITE_CHAIN_ID=11155111
```

## Build/run
```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Deploy Supabase Edge Functions
cd supabase
supabase functions deploy quiz-fetch --project-ref your-project-ref
supabase functions deploy quiz-verify --project-ref your-project-ref
```

Contracts are managed via Foundry. Workflows are deployed via KRNL Studio/CLI; see `docs/architecture.md`.

## Demo
See `docs/video-walkthrough-script.md` for a complete demo script and `docs/demo-script.md` for presentation notes.

## Repo layout
```
chaplainy/
├── apps/web/              # React frontend
│   ├── src/
│   │   ├── pages/         # HostPage, SessionPage
│   │   ├── workflows.ts   # KRNL workflow definitions
│   │   └── supabaseClient.ts
├── contracts/             # Solidity + Foundry tests
├── workflows/             # KRNL workflow DSL files
│   ├── quiz_fetch.json
│   └── quiz_verify.json
├── supabase/
│   ├── functions/         # Edge Functions
│   │   ├── quiz-fetch/    # Fetches & hashes questions
│   │   └── quiz-verify/   # Verifies answers & scores
│   ├── schema.sql
│   └── rls.sql
└── docs/                  # Specs, ADRs, demo scripts
```

## How it works

1. **Host creates quiz** → Edge Function fetches trivia, hashes answers, stores in DB
2. **Player joins** → Connects wallet via Privy, authorizes KRNL smart account
3. **Player answers** → Edge Function verifies hash, computes score, generates proof
4. **Score recorded** → Proof submitted on-chain via KRNL (gas sponsored)
5. **Leaderboard** → Displays immutable on-chain scores

## License
MIT

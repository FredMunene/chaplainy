# Chaplain – Architecture & Deployment

## Components
- **Frontend**: React + Vite + TypeScript; Privy for auth/onboarding; @krnl-dev/sdk-react-7702 for gasless flows; connects to Supabase and KRNL workflows.
- **KRNL Workflows**: `quiz_fetch.krnl` (ingest questions), `quiz_verify.krnl` (verify answers, emit attestation). Runs on KRNL node with attestor signing.
- **Smart Contracts**: `QuizSCA.sol` (attestation-aware quiz contract). Uses EIP-7702 smart accounts for gas abstraction.
- **Data Layer**: Supabase (Postgres) for profiles, sessions, cached questions, submissions, scores, and audit logs.
- **Infra**: KRNL Testnet (attestation registry), Supabase hosted instance, static hosting (Vercel/Netlify), CI (GitHub Actions).

## Data flow
1) Host creates lobby -> Frontend calls `quiz_fetch.krnl` with source + count.  
2) Workflow pulls trivia API, hashes correct answers, caches questions in Supabase, returns question payload + session nonce.  
3) Players join -> Frontend retrieves session questions (without correct hashes) from Supabase.  
4) Player answers -> Frontend calls `quiz_verify.krnl` with answer + nonce -> Workflow validates hash, signs attestation `{sessionId, player, questionId, scoreDelta, expiry, nonce, proofHash}`.  
5) Frontend submits attestation to `QuizSCA.sol` -> Contract verifies signature + nonce, updates score, emits `ScoreUpdated`.  
6) Leaderboard listens to contract events (or Supabase `scores` updates) to refresh UI.

## Contract design (`QuizSCA.sol`)
- **State**: mapping `(sessionId => mapping(player => uint256 totalScore))`; bitmap/set for `(sessionId, player, questionId)` consumed proofs; attestor address; nonce window; optional prize vault.
- **Functions**:
  - `submitProof(Attestation att)` -> verifies signer, expiry, nonce, replay; updates score; emits event.
  - `setAttestor(address)` (onlyOwner/host).
  - `startSession(params)` and optional `distributeRewards(sessionId)` (phase 2).
- **Tests**: invalid signer, expired attestation, replayed attestation, tampered sessionId, scoring accumulation.

## Workflow details
- `quiz_fetch.krnl`
  - Inputs: `source`, `count`, `difficulty`
  - Steps: call trivia API -> normalize -> hash correct answers (e.g., `keccak256(choice)`) -> store questions in Supabase with hashed answers -> return public payload (question + shuffled choices) and session nonce.
- `quiz_verify.krnl`
  - Inputs: `sessionId`, `questionId`, `answer`, `sessionNonce`, `player`
  - Steps: pull hashed answer from Supabase -> compare -> compute `scoreDelta` -> sign attestation with attestor key (expiry + nonce) -> push proof hash to Supabase submissions table.

## Environments & configuration
- Env vars: trivia API key, Supabase URL/anon + service keys, Privy app id, KRNL node URL, attestor private key, contract address, chain id, sponsor key for EIP-7702.
- Secrets only in workflow/CI vault; frontend uses public keys only.

## Deployment approach
- **Contracts**: Deploy to KRNL Testnet via Hardhat/Foundry; record address in `.env` and `docs/releases.md` (future).
- **Workflows**: Deploy to KRNL node; configure attestor; register workflow IDs.
- **Frontend**: Deploy Vercel/Netlify; set env vars for Privy, Supabase, KRNL endpoints, contract address.
- **Supabase**: Apply schema, enable RLS, configure JWT to carry wallet address; set policies for profiles/sessions/submissions/scores.

## Observability
- Log workflow runs (success/fail) to Supabase `audit_events`.
- Contract events streamed via provider/websocket; mirror to Supabase for history.
- Basic metrics: workflow latency, contract tx success rate, failed attestation count.

## CI/CD (proposed)
- Lint/format: `pnpm lint`, `pnpm test` (frontend); `forge test` or `pnpm hardhat test` (contracts).
- Build: `pnpm build`.
- Security: run `slither` if available; run threat checks on PR (checklist).
- Deploy: tagged releases trigger contract/workflow deployment pipelines; preview deploys for frontend.

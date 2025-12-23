# Chaplain – Implementation Plan (Feature-by-Feature)

This plan breaks the MVP into features. Each feature includes the expected outcome and the test used to validate it.

## 1) Project setup and structure
- **Expected outcome**: Repo has `apps/web`, `contracts`, `workflows`, `supabase`, and `docs` folders; toolchains are pinned and scripts documented.
- **Test**: Run `ls` and confirm folder structure and a minimal `README.md` for each major folder.

## 2) Supabase schema and RLS
- **Expected outcome**: Tables for `profiles`, `sessions`, `questions`, `submissions`, `scores` exist; RLS ties wallet address to JWT claims.
- **Test**: Use Supabase SQL editor to insert/select with anon role and verify RLS denies cross-user reads.

## 3) Trivia question fetch workflow (`quiz_fetch`)
- **Expected outcome**: KRNL workflow pulls trivia questions from Open Trivia DB, caches questions + hashed answers in Supabase, returns sanitized questions to the client.
- **Test**: Execute workflow with sample input; verify Supabase `questions` contains hashed answers and client payload has no correct answers.  
  - Trivia API pattern: `https://opentdb.com/api.php?amount=10&category=20&difficulty=easy&type=boolean`

## 4) Answer verification workflow (`quiz_verify`)
- **Expected outcome**: KRNL workflow validates answers against hashed correct answers, creates attestation with score metadata.
- **Test**: Submit known correct/incorrect answers; verify attestation payload toggles `correct` and score changes.

## 5) Smart contract (`QuizSCA.sol`)
- **Expected outcome**: Contract verifies attestation signer, nonce, expiry, and replay; updates scores and emits `ScoreUpdated`.
- **Test**: Unit tests for invalid signer, expired attestation, replayed submission, and valid proof path.

## 6) Wallet onboarding + smart accounts
- **Expected outcome**: Privy onboarding creates delegated smart account (EIP-7702) and enables gasless txs.
- **Test**: New user signs in with Privy, submits a proof, and sees tx confirmed without local gas.

## 7) Lobby and session creation
- **Expected outcome**: Host can create a session, trigger `quiz_fetch`, and share a lobby link with a session ID.
- **Test**: Create session; confirm Supabase `sessions` and `questions` records exist; lobby link loads for a second user.

## 8) Quiz gameplay UI
- **Expected outcome**: Players can answer timed questions with progress indicators; answers trigger `quiz_verify`.
- **Test**: Manual playthrough; verify submission entries in Supabase and corresponding workflow runs.

## 9) Leaderboard
- **Expected outcome**: Leaderboard updates from on-chain events or Supabase score table; shows proof hashes.
- **Test**: Submit multiple proofs; verify sorted scores update within seconds and match contract state.

## 10) Observability and audit
- **Expected outcome**: Workflow runs and contract events are logged; failures are visible.
- **Test**: Force a failing workflow run; ensure an audit event is recorded with error details.

## 11) Deployment and configuration
- **Expected outcome**: Frontend deployed, contract on KRNL Testnet, workflows deployed to KRNL node, env vars set.
- **Test**: Load production URL and run a full quiz; verify on-chain score updates and Supabase logs.

## Keys and secrets
- Do not hardcode addresses, private keys, or API keys in repo. Use environment variables and secret stores (Supabase secrets, KRNL vault/attestor config).

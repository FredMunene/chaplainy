# Chaplain – Product Requirements Document (PRD)

## Overview
Chaplain is a KRNL-powered, Kahoot-style quiz game that fetches trivia from external APIs, verifies answers off-chain via KRNL workflows, and commits scores on-chain for transparent, tamper-resistant results. Wallet onboarding uses Privy and EIP-7702 smart accounts to keep gameplay gasless.

## Goals
- Deliver a playable MVP where users can join a quiz, answer questions, and receive on-chain scores.
- Prove KRNL workflows + attestations can verify answers without leaking correct answers.
- Provide a clean, low-friction UX for non-crypto users.

## Non-goals (MVP)
- Complex tournament brackets and team play.
- Advanced prize distribution and dispute resolution (phase 2).
- Multi-chain support beyond KRNL Testnet.

## Target users
- **Players**: casual quiz participants with minimal crypto experience.
- **Hosts**: creators or communities running trivia sessions.
- **Viewers**: observers validating results and leaderboards.

## User journeys
- **Host creates session**: select trivia source + settings -> KRNL workflow fetches questions -> share lobby link.
- **Player joins**: Privy onboarding -> lobby -> question rounds -> attestations submitted -> score updated.
- **Leaderboard**: live updates from on-chain events; proof hashes displayed for verifiability.

## Key requirements
- **Question fetch**: KRNL workflow to pull trivia; cache in Supabase.
- **Answer verification**: KRNL workflow verifies privately and signs attestation.
- **On-chain registry**: `QuizSCA.sol` validates attestations, blocks replays, updates scores.
- **Wallet onboarding**: Privy + EIP-7702 delegated smart accounts for gas abstraction.
- **Persistence**: Supabase tables for profiles, sessions, questions, submissions, scores.
- **Observability**: record workflow runs and contract events for audit.

## Success metrics (MVP)
- 90%+ of quiz submissions successfully verified and written on-chain.
- Median verification latency under 200ms.
- Session completion rate above 60% (players finish quiz).
- No replay or invalid attestation accepted in tests.

## UX requirements
- Mobile-first responsive layout; low-friction join flow.
- Clear game states (lobby, countdown, question, result).
- Leaderboard updates within seconds of proof submission.

## Constraints
- KRNL workflows are JSON-configured DAGs; must align to KRNL Studio/CLI outputs.
- KRNL SDK requires Privy for smart account support.
- External trivia APIs can be flaky; caching and retry required.

## Dependencies
- KRNL node and attestor; KRNL SDK.
- Privy wallet integration.
- Supabase (Postgres + RLS).
- Trivia API (Open Trivia DB or paid alternative).

## Risks & mitigations
- **Attestor downtime**: queue attestations and retry; alerting.
- **Trivia API failure**: fallback to cached questions; retry policy.
- **RLS misconfig**: test policies and enforce wallet-bound JWT claims.

## Rollout plan
- Week 1–2: Architecture, schema, contract skeleton.
- Week 3–4: KRNL workflows and trivia adapter.
- Week 5: Contract deployment + integration.
- Week 6–7: Frontend implementation.
- Week 8: Integration testing + KRNL Testnet demo.

## Open questions
- Final trivia sources and licensing?
- Prize model and rules for winner verification (phase 2)?
- Should sessions support multilingual content?

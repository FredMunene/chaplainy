# Chaplain – Threat Model (STRIDE-oriented)

## Assets
- Attestor private key; KRNL workflow integrity.
- Session nonces and question correctness hashes.
- Player wallets and Privy identities.
- Supabase data (profiles, submissions, scores) and RLS policies.
- On-chain contract state (scores, prize pool).

## Trust boundaries
- Client <-> KRNL workflows (API)
- Client <-> Supabase (JWT/RLS)
- Client <-> Contract (provider/AA relay)
- Workflow <-> Trivia API (external)
- Attestor key store

## Threats & mitigations
- **Spoofed proofs / replay**: Use per-session nonce and `(sessionId, player, questionId)` replay guard in contract; expiry timestamps; attestor address immutable or owner-controlled.
- **Attestor key compromise**: Store in HSM/KMS; rotate via `setAttestor`; monitor signature anomalies; kill-switch to pause submissions.
- **Tampered questions/answers**: Hash correct answers server-side; store hashes in Supabase with integrity checks; versioned workflow code; CI signature of workflow bundle.
- **API poisoning**: Validate trivia API responses; enforce schema; rate-limit; fallback to cached questions when API fails.
- **Front-running / answer leakage**: Correct answers never sent to client; only hashed; attestation proves correctness without revealing content.
- **Unauthorized data access**: Supabase RLS tying `wallet_address` to JWT; service role only in workflows; audit logs for privileged queries.
- **RLS bypass in dev**: Temporary anon insert policy for `sessions` (dev only) increases spoofing risk; remove before production.
- **Denial of service**: Cache questions; implement retries/backoff for trivia API; cap session size; queue attestation submissions; circuit breaker on contract if spam detected.
- **Privilege escalation in admin tools**: Separate admin role in Supabase; contract owner/host-only functions guarded by Ownable/role-based access.
- **Sybil / fake players**: Optional Privy email/phone verification; entry fee or allowlist per session; per-identity caps.
- **Prize theft (phase 2)**: Escrow prize pool on contract; use pull-pattern payouts; require attested winner set; add timelocks for disputes.
- **Supply-chain risks**: Pin dependencies; use lockfiles; run `npm audit`/`pnpm audit`; sign release artifacts.

## Residual risks
- Dependence on external trivia API availability.
- Attestor downtime delays scoring.
- Sponsored gas provider limits affecting UX.

## Security checklist (MVP)
- [ ] Contract tests for replay/expiry/invalid signer.
- [ ] Workflow tests for hash verification and nonce handling.
- [ ] RLS policies reviewed and tested.
- [ ] Privy JWT binding to wallet validated.
- [ ] Monitoring for failed attestations and contract events.

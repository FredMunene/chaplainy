# Chaplain – Resources & Dependencies

## External services
- **KRNL**: Node + Attestor access, KRNL Testnet endpoints, @krnl-dev/sdk-react-7702.
- **Privy**: App ID, API key, configuration for smart account sponsor (EIP-7702).
- **Supabase**: Project URL, anon key (frontend), service role key (workflows), RLS enabled.
- **Trivia API**: Default Open Trivia DB (no key) or custom provider; consider paid SLA for production.
- **RPC provider**: KRNL Testnet RPC; provider with websockets for event streaming.

## Tooling
- **Frontend**: Node 18+, pnpm, Vite, React, TypeScript, Tailwind (or CSS modules), Zustand/Redux for state.
- **Contracts**: Foundry or Hardhat, OpenZeppelin contracts for Ownable/roles, EIP-712 helpers.
- **Workflows**: KRNL CLI, workflow templates, signed deployment config, HSM/KMS for attestor key.
- **Testing**: Vitest/Jest for UI, Playwright/Cypress for E2E, Forge/Hardhat tests for contracts.

## Environment variables (draft)
- `VITE_PRIVY_APP_ID`, `VITE_KRNL_NODE_URL`, `VITE_CONTRACT_ADDRESS`, `VITE_CHAIN_ID`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (workflows only)
- `TRIVIA_API_KEY` (if using paid provider)
- `ATTESTOR_PRIVATE_KEY` (workflow)
- `SPONSOR_PRIVATE_KEY` (gas abstraction)

## Team roles
- **Smart contracts**: attestation verification, replay protection, payouts.
- **Workflows**: trivia integration, verification logic, Supabase writes.
- **Frontend**: UX, lobby/quiz UI, Privy integration, event listeners.
- **SRE/DevOps**: KRNL node/attestor ops, Supabase policies, CI/CD, monitoring.

## Reference materials
- KRNL documentation and examples for attested workflows.
- Privy docs for smart accounts and gas sponsorship.
- EIP-7702 specification.
- OpenZeppelin ECDSA utilities and signature verification patterns.

## Open questions
- Which trivia API(s) and SLA? Do we need multilingual content?
- Reward distribution rules and disputes? (phase 2)
- Do we require KYC for hosted prize pools?

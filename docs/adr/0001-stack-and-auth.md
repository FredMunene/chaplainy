# ADR 0001 – Stack and Authentication Choices

- **Context**: We need a modern frontend, wallet onboarding, gas abstraction, and a managed database for player/session state. We also need predictable developer ergonomics for rapid MVP delivery.
- **Decision**:
  - Use **React + Vite + TypeScript** for the UI to keep bundle fast and DX high.
  - Use **Privy** for wallet onboarding plus **EIP-7702 smart accounts** for gas abstraction and sponsored transactions.
  - Use **KRNL SDK (@krnl-dev/sdk-react-7702)** to interact with workflows and manage attested calls.
  - Use **Supabase (Postgres + RLS)** for player profiles, sessions, cached questions, submissions, and scores.
  - Use **Tailwind (or CSS modules)** for styling to move quickly while keeping flexibility.
- **Status**: Accepted.
- **Consequences**:
  - Privy reduces friction for non-crypto users but adds a hosted dependency; must harden fallback for wallet outages.
  - Supabase offers realtime + SQL, enabling leaderboards and audit trails; we must enforce RLS and wallet-bound JWTs.
  - Vite + TS keeps build fast; choose pnpm for workspace management if we split apps/contracts.
  - Future migration to another wallet provider requires adapter around auth and account abstraction interfaces.

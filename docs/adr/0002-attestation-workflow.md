# ADR 0002 – Off-Chain Verification via KRNL Attestations

- **Context**: Quiz answer checking must stay private to prevent leaking correct answers, while the final scores must be provable and tamper-resistant on-chain.
- **Decision**:
  - Perform answer verification off-chain in a KRNL workflow (`quiz_verify.krnl`), then sign an attestation carrying `{sessionId, player, questionId, correct, scoreDelta, nonce, expiry, proofHash}`.
  - On-chain contract (`QuizSCA.sol`) only validates the attestation signature, nonce, expiry, and session binding before updating scores.
  - Use per-session nonces and proof hashes to prevent replay and binding to specific questions.
- **Status**: Accepted.
- **Consequences**:
  - Correct answers never appear on-chain or in the client; mitigates front-running and leakage.
  - Requires reliable attestor key management and rotation plan; add monitoring for failed/expired proofs.
  - On-chain logic stays small and gas-cheap but depends on KRNL availability; add cached attestation queue in frontend to retry submissions.

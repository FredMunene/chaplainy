# KRNL Workflows

This folder holds KRNL workflow JSON definitions that follow the official workflow schema.

## Workflows
- `quiz_fetch.json` – fetch trivia, normalize + hash answers, write to Supabase.
- `quiz_verify.json` – load question, verify answer, encode proof, write submission.

## How to generate
1) Open https://studio.krnl.xyz and create each workflow.
2) Export the workflow JSON and save it in this folder.
3) Keep secrets (API keys, service role keys, attestor keys) in KRNL Vault or environment configuration, not in this repo.

## Required env/secrets (placeholders)
- `${ENV.ATTESTOR_IMAGE}` – your attestor image (image://...).
- `${ENV.HTTP_EXECUTOR_IMAGE}` – KRNL HTTP executor image.
- `${ENV.TRANSFORM_EXECUTOR_IMAGE}` – KRNL transform executor image.
- `${ENV.HASH_EXECUTOR_IMAGE}` – KRNL hash/compare executor image.
- `${ENV.ENCODER_EXECUTOR_IMAGE}` – KRNL EVM encoder image.
- `${ENV.QUIZ_SCA_ADDRESS}` – deployed QuizSCA address.
- `${_SECRETS.supabaseServiceKey}` – Supabase service role key.
- `${_SECRETS.supabaseRestUrl}` – Supabase REST base URL.
- `${_SECRETS.rpcSepoliaURL}` – RPC URL for Sepolia.

## Trivia API pattern
`https://opentdb.com/api.php?amount=10&category=20&difficulty=easy&type=boolean`

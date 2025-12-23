# KRNL Workflows

This folder holds exported KRNL workflow JSON files created in KRNL Studio or via the KRNL CLI.

## Planned workflows
- `quiz_fetch.json` – fetch trivia questions, hash correct answers, cache in Supabase.
- `quiz_verify.json` – validate a player answer and return an attested result.

## How to generate
1) Open https://studio.krnl.xyz and create each workflow.
2) Export the workflow JSON and save it in this folder.
3) Keep secrets (API keys, service role keys, attestor keys) in KRNL Vault or environment configuration, not in this repo.

## Trivia API pattern
`https://opentdb.com/api.php?amount=10&category=20&difficulty=easy&type=boolean`

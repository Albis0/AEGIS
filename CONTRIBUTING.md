# Contributing to AEGIS

Thanks for your interest in contributing! This document covers how to set up the project, the conventions we follow, and how to submit changes.

## Development Setup

Requirements: **Windows 10/11**, **Node.js 18+**, and **Bun**.

```bash
git clone https://github.com/Albis0/AEGIS.git
cd AEGIS
bun install
# .env is OPTIONAL - enter keys in-app (Settings -> API Keys) or copy .env.example
bun run dev            # vite + electron in dev mode
```

Enable the secret-scanning pre-commit hook before your first commit:

```bash
git config core.hooksPath scripts/githooks
```

## Project Layout

- **electron/** — Electron main process (CJS). Tool definitions live in `tools.ts` and `tools/schemas.ts`; provider calls in `ai-client.ts`.
- **src/** — React renderer. UI, skins, settings, i18n.
- **tests/** — Vitest unit tests + conversation harness.
- **supabase/** — Edge Function and schema.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the trust model, agent-loop pipeline, and the invariants a PR must not break.

## Running Tests

```bash
node node_modules/vitest/vitest.mjs run   # unit tests
bun run test:trio                          # tool schema <-> executor sync
bun run test:convo                         # conversation harness
```

Type-check and lint before opening a PR (CI runs all of these):

```bash
node node_modules/typescript/bin/tsc -p tsconfig.electron.json
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
bun run lint                               # ESLint (no-floating-promises is an error)
node scripts/check-version.mjs             # docs must not contradict package.json
node scripts/check-packaged-deps.mjs       # build.files must cover the native dep tree
```

## Commit & PR Conventions

- Use conventional-commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `ui:`, `test:`.
- Keep each PR focused on one logical change.
- Add or update tests for the behavior you change (new feature → unit/harness test; bug fix → a test that reproduces the bug).
- Make sure the build is clean and tests pass before requesting review.
- Never commit secrets. The pre-commit hook helps, but you are responsible for keeping keys out of the repo.

## Reporting Bugs

Open a GitHub issue with reproduction steps, your OS version, and the AEGIS version. For **security** issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Code of Conduct

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

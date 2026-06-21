# AEGIS — Windows AI assistant (Electron + React + Vite)

Respond in Turkish (kullanıcıya Türkçe yanıt ver). When a feature is done and the build is clean, don't ask — commit + push.

Current state (v0.7.2): **332 tools**, 8 AI providers, 55 electron modules, 16 skins, 5 languages,
~36 test files. The project is **public** and **AI-assisted ("vibe coded")** — expect rough edges; it is early-stage and known issues are fixed incrementally per version bump.

> Versioning note: the app was reset from 1.x down to **0.7.2** to reflect its early-development status. Only the latest release (v0.7.2) is published on GitHub; all older releases and 1.x tags were deleted. Do not reintroduce 1.x version numbers.

## Architecture

- **electron/** (main process, CJS, 55 modules) — `main.ts` entry (runAgent tool loop, system prompt); `tools.ts` (~2423 lines: `executors`+`getAllToolSchemas`+executeTool) + `tools/schemas.ts` (tool schemas, pure data — tools.ts imports + re-exports); `ai-client.ts` (provider calls, param trimming); `model-capabilities.ts` (model capability registry — zero-error AI layer); `model-router.ts` (deterministic tool routing); `short-term-memory.ts` + `reference-resolver.ts` (reference resolution); `routines.ts` (deterministic multi-step recording), `macros.ts`, `automations.ts`; `memory-plus.ts` (facts/habits/morning summary); `spotify.ts`, `steam.ts`, `smart-home.ts` (Home Assistant), `local-devices.ts` (HA-less local network device discovery — mDNS/SSDP), `computer-use.ts`; `tts.ts`, `auth.ts`+`cloud-sync.ts`+`aegis-config.ts` (Supabase trial mode / bundled public config).
- **src/** (renderer, React) — `App.tsx` (top level; update toast lives here), `components/skins/registry.tsx` (4 families × 4 variants), `components/settings/tabs/`, `i18n.ts` (5 languages: tr/en/de/fr/es), `changelog.ts` (patch notes), `update-state.ts` (updater toast reducer).
- IPC: `electron/preload.ts` (`window.jarvis`), types: `src/electron.d.ts`.

## Commands

- `bun run dev` — vite + electron (development)
- `bun run build` — `vite build && tsc -p tsconfig.electron.json`
- `node node_modules/vitest/vitest.mjs run` — tests (npx tsc/vitest sometimes resolves the wrong global; use `node node_modules/...`)
- Type-check: `node node_modules/typescript/bin/tsc -p tsconfig.electron.json` and `-p tsconfig.json --noEmit`
- `bun run test:trio` (tool schema↔executor), `test:convo` (conversation harness), `test:gui` (Playwright updater toast)

## Release (automated)

1. Bump `package.json` version + add a 5-language entry at the top of `src/changelog.ts`.
2. commit → tag `vX.Y.Z` → push tag. GitHub Actions (`.github/workflows/release.yml`, windows) builds + publishes.
3. After the release exists, PATCH its description via the GitHub API (electron-builder leaves it empty). Assets: `AEGIS-Setup-X.Y.Z.exe` (recommended) + `AEGIS-X.Y.Z.exe` (portable).
4. Token: in `.claude` memory (reference-github-token). Repo: Albis0/AEGIS (currently private; being prepared to go public).

## Security (public-repo critical)

- **Never bundle a real secret.** `AEGIS_GITHUB_TOKEN` must come from env only — `electron/aegis-config.ts` defaults it to `""` and the updater fails closed without it. (A PAT was once bundled and leaked into git history; it was revoked and the history was rewritten with `git filter-branch`. Don't reintroduce hardcoded tokens.)
- The bundled Supabase **anon key** is public-safe because RLS protects every table. The `service_role` key lives only in the Supabase Edge Function secret.
- A pre-commit secret-scan hook exists: `git config core.hooksPath scripts/githooks` (see `scripts/check-secrets.sh`).
- `.env` is git-ignored; `.env.example` is the template. Personal notes `AGENTS.md`/`TECH_STACK.md` are git-ignored.

## Critical gotchas (also in memory)

- **NSIS installer size is misleading**: ~261MB = LZMA compression; it does NOT mean "Kokoro is missing". To verify, open the exe with 7-Zip → inner `app-64.7z` → look for `onnxruntime.dll`.
- **bun skips postinstall for untrusted packages** → native binaries aren't downloaded. `package.json > trustedDependencies` (onnxruntime-node, sharp, @img/sharp-win32-x64) is required. electron.exe can also be missing for the same reason → `node node_modules/electron/install.js`.
- **`ELECTRON_RUN_AS_NODE=1` is baked into this shell** → electron.exe opens Node instead of the GUI (app undefined). For GUI tests: open the renderer with vite + Playwright, stub `window.jarvis` via `addInitScript` (stub methods must return Promises).
- In a packaged app asar/node_modules are **read-only**: runtime writes go to `app.getPath("userData")`. The Kokoro model downloads there.
- **Tool selection (tools.ts)**: Groq has a 64-tool limit; matching group tools are moved to the front. Schema `number` params must be `string` (Groq sends string for numbers → tool_use_failed). STM sticky-context is used for reference turns.

## Tests

- Claude decides the test strategy; the user won't say "write tests". On every change add the necessary test silently (new feature → unit/harness, bug fix → a test that catches the bug, behavior change → regression). Don't spam; add just enough protection to keep the same bug from returning.
- I/O modules are tested against real `~/.aegis/` files (`beforeEach`/`afterEach` cleanup); pure-function modules (model-capabilities) without mocks.
- Trio (`test:trio`): tool schema ↔ executor sync. Number params must be strings (Groq).

## Details

Release notes live in `scripts/release-notes-*.md`. Generated reports/screenshots are in `.gitignore`.

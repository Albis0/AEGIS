# AEGIS Architecture

A contributor-oriented map of how AEGIS works and — more importantly — the
invariants and gotchas you can't see from any single file. For the stack list
see the README; for versioning, `package.json` is the single source of truth
(CI enforces this via `scripts/check-version.mjs`).

## The two processes and the trust line

```
┌────────────────────────────── Electron main (Node, full system access) ─────────────────────────────┐
│                                                                                                      │
│  main.ts (composition root)                                                                          │
│    ├─ agent-loop.ts   ← the model↔tool loop (pure-ish, unit-tested, deps injected via AgentDeps)     │
│    ├─ prompts.ts      ← system prompts; tool-routing rules generated from one table for 5 languages  │
│    ├─ ipc/*.ts        ← IPC handlers by domain (media, auth, window/updater, data/config)            │
│    ├─ tools.ts        ← executor registry (332 tools) + guards; big domains in tools/exec-*.ts       │
│    ├─ ai-client.ts    ← 8 providers behind one callAI(); trial mode goes through the Supabase proxy  │
│    └─ ~50 domain modules (spotify, steam, memory-plus, scheduler, vault, taint, permissions, …)      │
│                                                                                                      │
└───────────────▲──────────────────────────────────────────────────────────────────────────────────────┘
                │ IPC via preload.ts → window.jarvis (contextIsolation: true, nodeIntegration: false)
┌───────────────▼──────────────── Renderer (React, sandboxed, NO system access) ───────────────────────┐
│  App.tsx → skins/registry (16 skins) · settings tabs · widgets (Spotify/Steam/SmartHome/Domain…)     │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**The renderer is untrusted.** It renders LLM output and user-provided custom
CSS, so treat any renderer compromise as plausible. Everything that crosses the
bridge is filtered accordingly:

- `run-tool` IPC only forwards tools in `WIDGET_SAFE_TOOLS` (tools.ts) — a
  compromised renderer must not reach `run_command`/`delete_file`.
- `config-get` returns **masked** key values only (`maskedConfig` in config.ts);
  the Supabase service-role key never crosses, not even a prefix. `config-set`
  drops masked round-trips (`sanitizeConfigPatch`).

## The agent loop (electron/agent-loop.ts)

One user turn = `runAgentLoop(history, deps)`:

1. **Reference resolver fast path** — deterministic handling of "do it again /
   turn it down a bit" via short-term memory; skips the LLM entirely at high
   confidence. Subagents skip this.
2. **Tool selection** — `getAllToolSchemas(provider, contextStr)` picks ≤64
   tools by keyword-root matching + sticky context (see the regression tests in
   `tests/tools/tool-selection.test.ts` before touching this).
3. Up to **8 model↔tool rounds**. Per tool call, in order:
   - **LoopGuard** — blocks identical-call repeats, A-B-A-B ping-pong, poll-budget
     overruns. Blocked calls never reach `executeTool`; the model sees why.
   - **Approval gate** — `needsApproval` (risk tier + stored "always allow"),
     escalated by the **taint flag** (below).
   - `executeTool` → **ToolOutcome** `{ok, content}` — success/failure comes
     from this envelope; the ONLY legacy string-prefix sniff lives in
     `outcomeFromText` (tools.ts). Do not add `^ERROR`-style regexes elsewhere.
   - `classifyError` (goal-executor.ts) — error-KIND taxonomy; non-retriable
     errors append `[GUIDANCE: …]` so the model doesn't blind-retry.
   - Self-healing: a repeated (tool-family, error-class) pattern injects one
     diagnosis message.

Everything environment-bound (model call, approval dialog, persistence, UI
events) is injected via `AgentDeps` — that's what makes
`tests/tools/agent-loop.test.ts` possible. Keep it that way.

## Security model (layered, each layer assumes the previous one fails)

| Layer | Where | What it stops |
|---|---|---|
| Widget allowlist | tools.ts `WIDGET_SAFE_TOOLS` | renderer → destructive tools |
| Secret masking over IPC | config.ts `maskedConfig` | renderer XSS → key exfiltration |
| `SYSTEM_DESTROY_PATTERNS` | tools.ts | model accidents (NOT a security boundary — regex is bypassable) |
| Risk tiers + approval dialog | permissions.ts + main.ts | irreversible actions without a human click |
| **Taint boundary** | taint.ts | **prompt injection**: once web/RSS/clipboard/foreign-file content enters the conversation, `run_command` + all ALWAYS_DESTRUCTIVE tools require approval — "always allow" grants, Full PC Access and subagent status do NOT bypass it; taint clears on new-chat |
| Outbound redaction | boundary-guard.ts | secrets leaking into LLM requests |
| DPAPI at rest | secret-storage.ts | keys/token readable from disk |

Full PC Access auto-revokes after 30 minutes (main.ts).

## Persistence

All state lives in `~/.aegis/*.json`. **Every write must go through
`writeJsonAtomic` (json-store.ts)** — tmp+rename, so a crash never leaves a
torn file (torn writes were the original source of the corrupted-file reports).
Secrets inside settings/config are DPAPI-encrypted per-field. Session/message
history optionally syncs to Supabase (anon key + RLS; service key is env-only,
advanced mode). The Kokoro TTS model downloads to `userData` at runtime —
asar/node_modules are read-only in a packaged app.

## Invariants a PR must not break

1. **Schema↔executor trio**: every tool schema has an executor and vice versa —
   `bun run test:trio` (also: number-ish params are typed `string`; Groq sends
   strings and `number` causes tool_use_failed).
2. **`chat-done` is always sent**, even on throw (chat-stream handler's
   `finally`) — otherwise the UI hangs in streaming state.
3. **Tool schemas are computed once per turn** and reused for every step in the
   chain (Groq rejects tool calls not present in `request.tools`).
4. **No raw secret crosses the IPC bridge** — masked values only.
5. **All 5 languages get tool-routing rules** — they're generated in prompts.ts
   from `TOOL_ROUTING`; add domains to the table, never to a prompt blob
   (`tests/tools/prompts.test.ts` enforces this).
6. **build.files covers the Kokoro/sharp dependency tree** —
   `node scripts/check-packaged-deps.mjs` (CI runs it; it has already caught a
   missing sharp native binary).

## Dev gotchas

- **Bun** is the package manager. `bun run dev`, `bun run test`. Native
  binaries (onnxruntime, sharp) download only for `trustedDependencies` —
  if electron.exe itself is missing: `node node_modules/electron/install.js`.
- **`ELECTRON_RUN_AS_NODE=1` in your shell silently breaks Electron** (opens
  Node instead of the GUI). The dev script strips it; watch for it in custom
  commands.
- `npx tsc` may resolve a wrong global on this machine — use `bunx tsc` or
  `node node_modules/typescript/bin/tsc`.
- Tests run against real `~/.aegis` files with cleanup; pure modules
  (model-capabilities, loop-guard, taint, prompts) have no-mock tests.
- Type-aware lint: `bun run lint` (`no-floating-promises` is an error — mark
  intentional fire-and-forget with `void`).

## Where to add things

| You want to… | Touch |
|---|---|
| Add a tool | `tools/schemas.ts` (schema) + executor in `tools.ts` or `tools/exec-<domain>.ts`; run `test:trio`; if it's a new *domain*, add roots to `TOOL_GROUPS` (tools.ts) and a row to `TOOL_ROUTING` (prompts.ts) |
| Expose something to the UI | `preload.ts` + `src/electron.d.ts` + a handler in `electron/ipc/*` (allowlist first if it executes tools) |
| Add a provider | `ai-client.ts` callAI branch + `model-capabilities.ts` entry + `models.ts` list endpoint |
| Add a skin | `src/components/skins/` + `registry.tsx` — skins are leaf components, don't thread new state through App.tsx |
| Change tool selection | `getAllToolSchemas` — only with `tests/tools/tool-selection.test.ts` and `bun run test:eval` green |

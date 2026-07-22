# AEGIS — Roadmap

> A Windows-native AI assistant. It listens, thinks, and acts.

**Snapshot:** 352 tools · 8 AI providers · 16 skins · 5 languages · 647 tests (53 files)
_The version number has a single source of truth: `package.json` (enforced in CI by `scripts/check-version.mjs`)._

**Phases 1–63 are complete**, including the Reliability Release (53–61) and public-release hardening. This file lists what's open first, then a compact history of what shipped.

---

## Open Work (priority order)

| # | Item | Notes |
|---|------|-------|
| 1 | **Release testing leftovers** | Packaged smoke pass done 2026-07-05 (onboarding-quit race + missing exe icon). Auto-update verified 2026-07-07 against the real feed: latest.yml version/size/sha512 match the published installer; live test found that **v0.7.2 cannot self-update** (it was built with `private: true` + empty token while the repo was private — check fails silently; v0.7.2 release notes now tell users to download manually; fixed in v0.7.3's conditional auth). Still open: non-Groq streaming with a real key, clean-machine pass, and a true update-available → download → install run once v0.7.4 ships. |
| 2 | **Outlook/Microsoft 365 OAuth** | Gmail/Google Calendar shipped (7.3); the Microsoft Graph counterpart is still open. |

_Done since the last revision: Gmail & Google Calendar OAuth (7.3 — bring-your-own Desktop-app client like Spotify; 9 tools incl. gmail_list/read/send and calendar events/create/delete, DPAPI-encrypted tokens, gmail_send and calendar_delete_event behind the approval gate), home-screen module pool (34.2 — opt-in right-edge dock with clock, quick actions, notes, suggestion chips, now-playing and CPU/RAM sparklines; works on all 16 skins, toggles in Settings → Appearance), i18n Priority 3 (backend/main-process messages ×5 languages — provider errors, trial-proxy errors, auth errors, system notices, tray menu), i18n Priority 2 (settings panel ×5 languages), error-report system with screenshot attach, trial wake-up retry, sentence-TTS prefetch, real app icon._

**Deliberately not planned:** **code signing** (AEGIS is a free hobby project; a certificate is a recurring cost — the SmartScreen warning is permanent and [SECURITY.md](SECURITY.md) documents how to verify a release instead), LoRA/fine-tuning pipelines, a full eval framework, RBAC, Docker/WASM sandboxing, multi-agent orchestration/A2A, litellm migration (the hand-written provider layer is leaner and matches the model-capabilities registry), multi-channel bridges (WhatsApp/iMessage), self-rewriting meta-planners.

---

## Shipped — Feature Overview

| Area | What works |
|------|-----------|
| **AI core** | 8 providers (Groq/OpenAI/Anthropic/Gemini/xAI/DeepSeek/Mistral/Ollama), streaming, tool calling with 341 tools, per-model capability registry (no unsupported-parameter 400s), deterministic tool routing, reference resolution, loop guard, self-healing |
| **Voice** | Whisper STT (multilingual), TTS (Edge / ElevenLabs / Kokoro offline), wake-word + VAD, barge-in (ESC), sentence-level streaming TTS, live voice translation |
| **System** | PowerShell, volume/brightness, windows, processes, disk cleanup, telemetry (CPU/RAM/GPU/disk/battery/network) + threshold alerts, real-time optimization |
| **Files & media** | Read/write/organize, duplicate finder, bulk rename, image resize/convert, PDF text, local indexing + BM25 search (RAG), file chat |
| **Apps & web** | Spotify (full Web API), Steam, OBS/VS Code/Discord/Notion/YouTube plugins, web search (Tavily/Serper/DDG), URL reading, news & price tracking |
| **Vision & control** | Screenshot + vision analysis, Computer Use (mouse/keyboard from natural-language goals) with verification loop |
| **Automation** | Scheduled tasks (cron-like), conditional automations, macros, routines (deterministic multi-step recording), agent mode, goal executor |
| **Memory** | User profile, facts, habits, session summaries, semantic recall, morning briefing, workspaces |
| **Smart home** | Home Assistant (lights/outlets/locks/thermostats/scenes) + HA-less local device discovery (mDNS/SSDP) |
| **Distribution** | Trial mode (Supabase Edge Function proxy, daily quotas), email auth, encrypted cloud sync, auto-update via GitHub Releases, 5-language onboarding |
| **Security** | DPAPI-encrypted keys, taint boundary for external content, destructive-action approval gate + per-run budget, boundary guard, secret-scan pre-commit hook, RLS on every cloud table |
| **UI** | 4 skin families × 4 variants (16 skins), palette presets, custom CSS, domain widgets/popups/command center, error report form |
| **Access** | Local network API (token-auth), browser UI with SSE sync, mobile via curl/Tasker, QR pairing |

---

## Shipped — Phase History (compact)

### Foundation (1–9)

| Phase | Delivered |
|-------|-----------|
| 1 | Conversation memory, user profile, notes & reminders (Supabase) |
| 2 | Settings panel, model picker, per-provider API keys, voice personalization |
| 3 | Skin system (component-based), accent/font/layout customization, custom CSS |
| 4 | Full i18n core: TR/EN/DE/FR/ES across UI, Whisper, TTS and system prompt |
| 5 | Screenshot + vision analysis, clipboard tools, window management |
| 6 | Volume/brightness, timed reminders, app profiles |
| 7 | URL fetching & summarizing, Windows toast notifications |
| 8 | Barge-in (ESC stops TTS), chat history sidebar with export, command palette |
| 9 | Plugin system (manifest + hot reload) with Spotify/VS Code/Steam/OBS plugins |

### Expansion (10–29)

| Phase | Delivered |
|-------|-----------|
| 10 | System tray, auto-launch, scheduled tasks, telemetry watch conditions |
| 11 | True LLM streaming, parallel tool execution, React render optimizations |
| 12 | Multi-step agent (`agent_run`), macro record/replay, conditional automations |
| 13 | Local document indexing + BM25 search + file chat (RAG) |
| 14 | Local network API server (Bearer token), mobile shortcuts, QR pairing |
| 15 | Browser UI with SSE real-time sync alongside desktop |
| 16 | Persistent facts, habit tracking, morning briefing |
| 17 | Encrypted key vault (DPAPI), privacy audit, data cleanup tools |
| 18 | Plugin marketplace (GitHub search + install + security scan), 4 more plugins |
| 19 | Sound effects and ambient/focus audio modes |
| 20 | Git tools, run-and-analyze, project scaffolding templates |
| 21 | Calendar (Outlook COM), pomodoro, time tracking |
| 22 | Folder organization, duplicate finder, bulk rename, image tools, PDF text |
| 23 | Personas and roleplay modes |
| 24 | Network diagnostics (ping/trace/ports/DNS), SSH profiles, Docker management |
| 25 | ASCII charts, system health report |
| 26 | SMTP/IMAP email send/fetch/draft |
| 27 | Flashcards (SM-2 lite), reading list + summarize, goal tracking |
| 28 | Weather station, Bluetooth/USB device management, printing |
| 29 | Model routing rules, prompt pipelines, model comparison |

### Distribution & AI Robustness (30–31)

| Phase | Delivered |
|-------|-----------|
| 30 | Trial mode end to end: Supabase Auth, `chat-proxy` Edge Function (JWT + daily request/token quotas), embedded public-safe config, mode-select onboarding, encrypted cloud sync, quota UI. Secrets live only in Edge Function secrets. |
| 31 | Model-capabilities registry compiled from official provider docs: per-model parameter trimming (max-tokens clamps, `max_completion_tokens`, tool/vision/system/temperature support) — eliminated the 400/422 class of provider errors. |

### UI Identity (32–34)

| Phase | Delivered |
|-------|-----------|
| 32 | UI family presets: background + accent + font applied together (Cyber/Synthwave/Matrix/Aurora/Ember) |
| 33–34 | 4 fully distinct skin families × 4 archetypes (Signature/Chat/Compact/Board): Aegis HUD, Skeuomorphism, Neo-brutalism, Claymorphism — each with its own hardcoded identity. i18n Priority 1 (main screen, palette, sidebar) completed alongside. |

### Power Features (35–52)

| Phase | Delivered |
|-------|-----------|
| 35 | Real-time voice translation mode |
| 36 | Smart notification filter & digest |
| 37 | Build/test runner with failure analysis |
| 38 | Live news & price tracking |
| 39 | Voice meeting assistant (transcribe + summarize) |
| 40 | Context-aware automatic actions |
| 41 | Fast local file search (Everything-style) |
| 42 | Real-time system optimization tools |
| 43 | Multi-session workspaces |
| 44 | AI daily report & analytics |
| 45 | Test infrastructure: vitest, conversation harness, trio (schema↔executor) validation, CI |
| 46 | Spotify & Steam built-in control (no plugin needed) |
| 47 | Computer Use: AI-driven mouse/keyboard with screen bounds checks |
| 48 | Robustness v2: friendly error messages, corrupted-file tracker, size guards |
| 49 | Onboarding redesign + Bun migration |
| 50 | AI core rewrite: short-term memory, reference resolver, deterministic router |
| 51 | Spotify Web API full integration (96 endpoints) |
| 52 | Routines: deterministic multi-step action recording |

### Reliability Release (53–61)

| Phase | Delivered |
|-------|-----------|
| 53 | Loop guard & action budget (identical-call blocking, poll budget, step cap) |
| 54 | Destructive-action approval gate (risk classification, always-allow grants, subagent policy) |
| 55 | Scored tool-selection eval harness (`tests/harness/`) |
| 56 | Goal executor: plan → step → verify → recover |
| 57 | Adaptive memory: semantic recall + automatic fact extraction |
| 58 | Boundary guard: outbound data-leak protection |
| 59 | Self-healing: repeated-error recognition and recovery hints |
| 60 | Computer Use verification loop (act → screenshot → check) |
| 61 | Proactive pattern learning (opt-in) |

### Recent (62+)

| Phase | Delivered |
|-------|-----------|
| 62 | Smart home: Home Assistant integration + local device discovery without HA |
| 63 | Domain UI components: telemetry/media widgets, memory modal, 6-tab command center |
| — | Architecture audit sprint: agent loop extracted with typed DI (`agent-loop.ts`), ToolOutcome envelope, IPC domain modules, atomic JSON writes, ESLint (type-aware) in CI, packaged-deps checker |
| — | Public release prep: history secret scan, RLS hardening for legacy tables, README/CONTRIBUTING/CoC, issue/PR templates, Playwright README screenshots |
| — | UX hardening: taint boundary over computer-use input, destructive budget per run, friendly auth errors, SmartScreen docs |
| — | Error report system: user bug-report form (Settings → About) + AI auto-reports with dedupe/caps, offline queue, insert-only RLS table |

### Claude Code Parity (CC)

Closing the gap with Claude Code's software-engineering toolset. See [CLAUDE_CODE_ENTEGRASYON_PLANI.md](CLAUDE_CODE_ENTEGRASYON_PLANI.md).

| Phase | Delivered |
|-------|-----------|
| CC-1 | Code-aware file tools: `glob_files` (name-pattern search, `**`/`{a,b}`), `grep_content` (regex content search, file:line), `edit_file` (exact-string replace with uniqueness check). `edit_file` is behind the destructive approval gate; all three honor the home-dir sandbox when Full PC Access is off. |
| CC-2 | Safe general-purpose shell (`run_shell`): explicit `cwd`, configurable timeout (2 min default / 10 min cap), background/detached mode with completion notification, 30k output clip. Strips `ELECTRON_RUN_AS_NODE` from the child env. Approval-gated (dangerous commands and background jobs classify destructive). New `shell-runner.ts`. |
| CC-3 | Live plan / todo tracking (`plan_todo` tool, Claude-Code TodoWrite parity): the model publishes an ordered step list with pending/in_progress/done status; a skin-independent `TodoPanel` overlay renders it live and clears on the next turn. i18n ×5. New `todo-update` IPC event + `todoUpdate` host hook. |
| CC-5 | File-based persistent memory (Claude-Code memory parity): human-readable markdown notes under `~/.aegis/memory/` with frontmatter (name/description/type: user/feedback/project/reference) + a `MEMORY.md` index loaded into the system prompt each session. Tools: `remember_note` (dedupe-by-slug update), `recall_note`, `list_notes_md`, `forget_note`. MemoryModal shows a Notes section. New `memory-files.ts` (pure fs, unit-tested). |
| CC-4 | Skill / prompt packages (Claude-Code skills parity): packaged instruction sets under `~/.aegis/skills/<name>/SKILL.md` (frontmatter name/description + body). A skill activates on `/name` or a description-keyword match and its instructions are injected into the system prompt for that turn. Three example skills seeded on first run (commit-yaz/test-yaz/refactor). `list_skills` tool + a Skills list in Settings → Tools (i18n ×5). New `skills.ts`. |
| CC-6 | Subagent delegation (`spawn_subagent`, Claude-Code subagent parity): runs an isolated `runAgentLoop` (its own single-message history, capturing send, `isSubAgent:true`) and returns the final text to the caller. Recursion guard: a subagent cannot spawn another (depth 1). Loop-guard + destructive budget still apply inside. `spawnSubAgent` host hook + `runSubAgent` in main.ts. |

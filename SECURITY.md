# Security Policy

## Unsigned Releases — How to Verify a Download

AEGIS is a free, hobby open-source project. Its executables are **deliberately not code-signed**: a signing certificate is a recurring cost that isn't justified here, so the Windows SmartScreen warning is expected and **permanent**. Instead of trusting a signature, you can verify a release directly:

1. **Reproducible provenance** — every release is built from a tagged commit by the public [GitHub Actions workflow](.github/workflows/release.yml) on GitHub's own runners. Compare the tag, the workflow run, and the attached artifacts.
2. **Scan before running** — upload the installer to [VirusTotal](https://www.virustotal.com) and check the hash matches what you downloaded.
3. **Build from source** — `bun install && bun run electron:build` produces the same installer + portable exe locally.

Note: the warning is louder than for a typical app because AEGIS legitimately uses screen capture, simulated mouse/keyboard input (Computer Use) and a self-updater — the same APIs malware uses. The difference is that here every line doing it is public.

## Threat Model (short version)

The main realistic threat for an LLM agent with 332 tools is **prompt injection through external content**, not memory safety. AEGIS's mitigations, all in this repo:

- **Taint boundary** — once untrusted content (web page, RSS, file, clipboard) enters the conversation, `run_command` and all destructive tools escalate to **mandatory user approval**, overriding stored "always allow" grants.
- **Approval gate** — destructive actions are risk-classified and require an explicit click; each run has an action budget.
- **Boundary guard** — outbound requests are checked against data-leak patterns before leaving the machine.
- **Renderer is untrusted** — raw secrets never cross the IPC bridge; `config-get` returns masked values only; widget IPC can only reach an allowlist of read-only tools.

Details and invariants: [ARCHITECTURE.md](ARCHITECTURE.md).

## Reporting a Vulnerability

If you discover a security vulnerability in AEGIS, please report it responsibly:

- **Do not** open a public GitHub issue for security problems.
- Email the maintainer at **abdurrahman.aksakal09@gmail.com** with details and reproduction steps.
- You can expect an initial response within a few days.

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce
- Affected version(s)
- Any suggested remediation, if you have one

## Secret Management

AEGIS is designed so that **no real secret is ever bundled into the client or committed to the repository**:

- **API keys** (Groq, OpenAI, Anthropic, etc.) are entered by the user at runtime and stored locally using OS-level encryption (Windows DPAPI). They never leave the device except to the provider you configured.
- The **Supabase `service_role` key** and any server-side LLM keys live **only** in the Supabase Edge Function secret store — never in the repo.
- The **Supabase anon key** that ships in the client is public-safe: all tables are protected by Row-Level Security (RLS), so each user can only read their own rows.
- The `.env` file is git-ignored. Use `.env.example` as a template.

### Pre-commit secret scanning

A pre-commit hook scans staged files for real API keys (Groq `gsk_`, OpenAI `sk-`, Supabase `service_role` JWTs) and blocks the commit if one is found. Enable it with:

```bash
git config core.hooksPath scripts/githooks
```

## Local Network API

The optional local API server (Settings → API, default port `7331`) intentionally binds
`0.0.0.0` so phones/tablets on the same network can reach AEGIS. Its security model:

- Every endpoint (except the web UI shell and `/api/status`) requires a **Bearer token**;
  comparison is constant-time.
- The token is stored **DPAPI-encrypted** in `~/.aegis/api-token.txt` and can be rotated
  via `POST /api/token/reset`.
- **No CORS headers** are sent — this is not a browser API, so arbitrary websites cannot
  script requests against it. The bundled web UI is same-origin; phone clients are native.
- Only enable the server on networks you trust; anyone on the LAN who obtains the token
  can talk to AEGIS.

## Error Reports & Privacy

The in-app bug-report form (Settings → About) and the AI's automatic crash reports go to a Supabase table that is **insert-only under RLS**: a client can write its own reports but can never read anyone's (not even its own back). What a report contains: title, description, app version, and — only if you attach one — a screenshot. AI auto-reports are deduplicated and capped at 5/day. Reports queue locally when offline and are sent later.

## Supported Versions

Only the latest released version receives security updates.

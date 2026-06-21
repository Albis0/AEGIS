# Security Policy

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

## Supported Versions

Only the latest released version receives security updates.

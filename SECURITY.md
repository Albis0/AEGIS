# Security Policy

## Reporting a vulnerability

Found a security issue? Thank you for taking the time to report it.

One firm request: report security problems by **email, not a public issue** —
a public issue hands the exploit to everyone before a fix exists. Write to
**abdurrahman.aksakal09@gmail.com**. Any format is fine, even two sentences.
Expect a reply within a few days; this is a one-person project, so occasional
delays happen.

Reproduction steps, the affected version, or impact details all speed up the
fix — include what you can, none of it is required. "Something feels off in X"
is already a useful report.

If you opened a public issue by accident, don't worry about it; the details
will be moved out of view and followed up privately.

## Supported versions

Only the latest release receives fixes. This is a young project moving fast;
backporting to older tags is not practical yet.

| Version | Supported |
|---|---|
| 0.2.x | ✅ |
| 0.1.x | ❌ |
| AEGIS 0.7.x (TypeScript) | ❌ superseded — see `feat/claude-code-parity` |

## Unsigned releases — how to verify a download

VAVIS is a free, hobby open-source project. Its executable is **deliberately
not code-signed**: a signing certificate is a recurring cost that isn't
justified here, so the Windows SmartScreen warning is expected and
**permanent**. Instead of trusting a signature, verify the release directly:

1. **Check the hash.** Every release asset lists a SHA-256 digest on the
   release page. Compare it with `Get-FileHash vavis-0.2.0.exe`.
2. **Scan before running.** Upload the executable to
   [VirusTotal](https://www.virustotal.com) and confirm the hash matches.
3. **Build from source.** `cargo build --release` produces the same binary
   locally. No build scripts, no bundled installers, no network access at
   build time beyond crates.io.

The warning is louder than for a typical app because VAVIS legitimately uses
screen capture and simulated mouse/keyboard input — the same APIs malware
uses. The difference is that every line doing it is public and readable.

## Threat model

The realistic threat for an LLM agent with 32 tools is **prompt injection
through external content**, not memory safety. Rust removes the memory-safety
class outright; the interesting risks are elsewhere.

### Mitigations in this repository

**Approval gate.** Every tool declares a risk level. Anything irreversible —
writing files, closing applications, running shell commands, clicking, typing,
deleting memories — is `Destructive` and requires an explicit click.
See `crates/vavis-tools/src/permission.rs`.

**Destructive budget.** After three destructive actions in a single turn, a
standing "always allow" grant stops applying and approval is requested again.
A loop-guard catches repetition; the budget catches *variety* — deleting eight
different files one after another.

**Narrow tool exposure.** The model is offered at most 12 tools per request,
selected by domain, averaging under 8. Fewer options means fewer opportunities
for an injected instruction to reach a dangerous tool.

**Command injection guards.** Tools that shell out reject shell metacharacters
in arguments, refuse to terminate protected processes (`vavis`, `csrss`,
`winlogon`, `services`, `svchost`), and escape quotes before interpolation.

**Bounded inputs.** File reads cap at 256 KB, screen coordinates are validated
against the actual screen, typed text is length-limited, and web page content
is truncated before it reaches the model.

### Known limits

- A user who approves a `run_command` call approves arbitrary code execution.
  The gate makes it visible; it does not make it safe.
- There is no taint tracking yet: content fetched from the web does not
  currently escalate later tool calls to mandatory approval. This existed in
  the predecessor project and is planned here.
- Screen capture sends an image of the whole screen to the configured LLM
  provider. Close what you don't want transmitted.

## Secret management

**No secret is ever bundled into the binary or committed to the repository.**

- **API keys** (Groq, Anthropic, OpenAI, …) are entered at runtime and stored
  in `%APPDATA%\vavis\data\keys.dat`, encrypted with **Windows DPAPI** under
  the current user account. Copying the file to another machine or user makes
  it undecryptable.
- Keys are **never printed**: `/keys` lists provider names only, and a test
  asserts the plaintext key does not appear in the stored file.
- Keys leave the device only in requests to the provider you configured.

## Data handling

Everything stays local:

| Data | Location |
|---|---|
| Conversation history | `%APPDATA%\vavis\data\vavis.db` (SQLite) |
| Remembered facts | same database |
| Automations | same database |
| API keys | `keys.dat`, DPAPI-encrypted |
| Logs | `%APPDATA%\vavis\data\logs\` |

There is no telemetry, no analytics, no crash reporting to any server, and no
account. The only outbound traffic is to the LLM provider you configured and,
for `web_search` / `fetch_url`, to the sites you ask about.

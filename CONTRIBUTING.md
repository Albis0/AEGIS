# Contributing to VAVIS

How to set up the project, the conventions it follows, and how to submit changes.

## Development setup

Requirements: **Windows 10/11** and **Rust 1.85+**.

```bash
git clone https://github.com/Albis0/Vavis.git
cd Vavis
cargo run --release
```

No `.env` file, no build step, no package install. API keys are entered
in-app (`/key groq <key>`) and stored encrypted via Windows DPAPI.

## Project layout

Five crates, each a layer. **Dependencies point one way only** — a lower
layer never knows about the one above it.

| Crate | Layer | Contents |
|---|---|---|
| `vavis-core` | Foundation | Config, SQLite store, BM25 search, scheduler, logging, i18n |
| `vavis-audio` | Senses | Microphone capture, VAD, speech-to-text, text-to-speech, speech queue |
| `vavis-tools` | Hands | 32 tools, permission gate, tool selection, agent loop |
| `vavis-brain` | Mind | LLM clients, context budget, key storage |
| `vavis-ui` | Shell | egui interface, bridge, voice manager, automation ticker |

The one-way rule is what makes the interface replaceable: swapping the UI
touches nothing below it.

## Conventions

**Language.** Code, comments, documentation, commit messages and issues are
in English. User-facing strings go through `vavis-core::i18n` and are
translated into five languages (en, tr, de, fr, es).

**Comments explain *why*, not *what*.** The code already says what it does.
A comment earns its place by recording a decision, a constraint, or a trap
someone would otherwise fall into again.

**Tests are part of the change.** A bug fix without a test that fails before
it is not finished. Run the whole suite before opening a PR:

```bash
cargo test              # 402 tests
cargo clippy --all-targets   # must be clean
```

**Commits** follow [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`. The body explains
the reasoning, not just the diff.

## Invariants a change must not break

These are load-bearing. Breaking one is a regression even if the tests pass.

**1. The model never sees more than `MAX_TOOLS` (12) tools.**

The predecessor project defined 353 tools and sent 64 on every request; no
model chooses reliably from 64 options. Selection narrows by domain first.
`crates/vavis-tools/tests/selection_eval.rs` measures this — it must stay at
100% and the average must stay under 8.

**2. Conversational messages get no tools at all.**

"hello", "write me a poem", "good night" must offer zero tools. Offering a
tool list to a chat message provokes needless tool calls.

**3. Barge-in must not start the next utterance.**

Pressing ESC clears the speech queue *before* stopping playback, and no
callback runs in between. The predecessor project got this backwards: its
stop function synchronously triggered the queue drain, which started the
next sentence. See `crates/vavis-audio/src/queue.rs`.

**4. Everything counts against the context budget.**

System prompt, history, tool schemas *and* images. Images cost a flat 1,100
tokens — counting their base64 length would blow the budget on a single
screenshot. See `crates/vavis-brain/src/budget.rs`.

**5. Destructive tools require approval, and the budget overrides grants.**

After three destructive actions in one turn, "always allow" stops applying.
See `crates/vavis-tools/src/permission.rs`.

## Adding a tool

1. Implement `Tool` in a file under `crates/vavis-tools/src/builtin/`.
2. Pick the right `Domain` — this decides when the tool is offered.
3. Set `Risk` honestly. Anything irreversible is `Destructive`.
4. Register it in `builtin/mod.rs`.
5. Add a case to `selection_eval.rs` proving it gets offered for a realistic
   sentence, and check the eval still scores 100%.

Watch the domain size: when one domain grows past a handful of tools it
starts crowding core tools out of the 12-tool budget. That is what forced
the System/Control split.

## Adding a language

Add a variant to `Lang` in `crates/vavis-core/src/i18n.rs`. The compiler will
then refuse to build until every key has a translation — that is deliberate.

## Reporting bugs

Use the issue templates. If it is a **security vulnerability**, do not open a
public issue — see [SECURITY.md](SECURITY.md).

## Pull requests

- One logical change per PR.
- Tests pass, clippy is clean.
- The description says *why*, and names any invariant the change touches.

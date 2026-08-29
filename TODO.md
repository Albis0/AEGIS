# Vavis — work queue

Tracks the Obsidian notes in `Obsidian Vault/Vavis/`. Kept up to date as
things land, so what is done and what is not is never a guess.

Status legend: `[x]` done and tested · `[~]` partly done · `[ ]` not started

## Integrations

- [x] **Web search chain** — Tavily → Brave → custom → DuckDuckGo, sequential
      failover, 15-min cooldown after a rate limit, order editable in settings.
      `crates/vavis-tools/src/websearch/`
- [x] **Obsidian** — 9 tools, filesystem-based, frontmatter/wikilink/tag
      parsing, trash-not-delete, atomic writes that keep line endings.
      `crates/vavis-tools/src/obsidian/`
- [x] **Steam** — library, achievements, store price, wishlist, friends,
      launch (asks first). Running-game detection is local, so it works on a
      private profile. `crates/vavis-tools/src/steam/`
- [x] **Spotify** — OAuth PKCE, 7 tools, now-playing panel with cached art.
      `crates/vavis-tools/src/spotify/`
- [x] **Custom MCP** — stdio + HTTP transports, per-server tool-selection
      domain, per-tool on/off, destructive by default.
      `crates/vavis-tools/src/mcp/`

## Interfaces

- [~] **Main interface** — the three distinctive items from the note are done:
  - [x] approvals inline in the message flow. They are messages now, answered
        where they appear and left in the feed marked with what was decided.
        The modal is gone; it stole the keyboard mid-sentence every time.
  - [x] microphone next to send, same size, with a live level bar. The level
        is its own command polled at 10 Hz — `get_status` is far too heavy
        for that — and only while something is listening.
  - [x] tool calls collapsed to one line, expandable to show what the tool was
        called with and what it returned.
  - [ ] conversation list on the left — the note's "solda konuşma listesi".
        Needs sessions in the database; the app has one conversation today.
- [~] **Code interface** — workspace backend done and tested (tree, read,
      write, search, path-escape refusal). View written.
      `crates/vavis-shell/src/workspace.rs`, `ui/src/lib/CodeView.svelte`
- [x] **Canvas interface** — image and video. Provider chain (OpenAI,
      Stability, Replicate, custom OpenAI-compatible endpoint) with the same
      failover shape as search. Every result keeps the seed the provider
      actually used, so it can be reproduced. Variation, animate and a real
      upscale endpoint. Files on disk, index in SQLite, usage and clear in
      settings. One chat tool (`gorsel_uret`) writes into the same gallery.
      `crates/vavis-tools/src/canvas/`, `crates/vavis-core/src/gallery.rs`,
      `ui/src/lib/CanvasView.svelte`
- [x] **Council interface** — several models on one question, genuinely
      parallel. Independent seats run together; seats marked "reads the
      others" run in a second wave with the first wave's answers. A failing
      seat is one failing panel. Cost is forecast before the run and totalled
      after. Nothing spawns itself.
      `crates/vavis-shell/src/council.rs`, `ui/src/lib/CouncilView.svelte`
- [x] **Settings layout** — categories left, content right, its own window
      rather than a rail panel. Search box, instant apply, masked keys, and a
      "test" on every provider and integration that makes a real request.
      Five languages. `ui/src/lib/Settings.svelte`

## Heavy works

- [~] **Computer use** — the loop is closed and the actions are human-like:
  - [x] the cursor travels to its target on an eased path instead of
        teleporting, so hover states fire and slow software sees it arrive
  - [x] typing is paced in chunks rather than dumped in one burst, which
        several applications drop half of
  - [x] `ekran_bekle` is the check step: it waits for the screen to settle
        and answers in one sentence, so the model does not send a full
        screenshot after every click. A blinking caret does not count as
        movement — the signature is a coarse 32×18 brightness map.
  - [ ] no drag or scroll yet; both would be new tools in an already
        five-tool domain, so measure `selection_eval` before adding them

## Known constraints

- Tool selection is capped at `MAX_TOOLS = 12`; an eval test holds the
  average offered at or below 8.0. It is currently **7.9** — the canvas
  domain was added without moving it. Check with
  `cargo test -p vavis-tools --test selection_eval -- --nocapture` first.
- Domain keywords are matched as substrings, so short ones are dangerous:
  `"md"` once matched "durumda" and "hakkımda" and pulled 9 unrelated tools
  into ordinary requests. The canvas keywords are all four characters or
  more for the same reason, with a test that says so.
- Generated media is served to the webview through Tauri's asset protocol,
  whose scope is opened at startup to the media directory alone
  (`allow_media_in_webview` in `main.rs`). Widening it would let the webview
  read anything on disk.
- Model prices in `vavis-brain/src/budget.rs` go stale. Everything derived
  from them is labelled an estimate, and an unknown model reports nothing
  rather than a confident wrong number.
- The `custom-protocol` feature on the tauri dependency is what embeds the
  built frontend. `tauri::is_dev()` is `!cfg!(feature = "custom-protocol")`
  and never looks at `debug_assertions`, so without it a `--release` build
  still points the webview at the dev server and the window opens to
  ERR_CONNECTION_REFUSED. `tauri build` sets it; this project ships with
  `cargo build --release`, which does not, so it is on by default in
  `crates/vavis-shell/Cargo.toml`. `release_builds_embed_the_frontend` in
  `main.rs` fails if it is removed, and the release workflow runs that test
  in release mode because `cargo test --all` runs in debug and cannot see it.
- The release profile deliberately keeps the symbol table and the unwind
  tables. `strip = "symbols"` plus `panic = "abort"` produced a binary with
  neither, which is the shape of a packed executable: Defender's ML model
  flagged 0.4.0 as `Trojan:Win32/Sabsik.FL.A!ml` — a heuristic guess, not a
  signature match. Restoring them costs about 6 MB and clears the scan, with
  and without Mark of the Web. The binary is unsigned, so SmartScreen may
  still warn on first run until the download builds reputation; a code
  signing certificate is the only real fix and has not been bought.

## Checks

```
cargo test --workspace          # 632 passing
cargo clippy --workspace --all-targets
cd ui && npm run check && npm run build
```

Environment-dependent tests are `#[ignore]`d and run explicitly:

```
VAVIS_TEST_VAULT="C:/path/to/vault" cargo test -p vavis-tools real_vault -- --ignored
cargo test -p vavis-tools local_steam -- --ignored --nocapture
cargo test -p vavis-tools --test mcp_e2e -- --ignored   # needs node
cargo test -p vavis-tools live_screen -- --ignored --nocapture  # needs a desktop
```

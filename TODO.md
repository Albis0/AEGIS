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

- [~] **Main interface** — an empty stage with the reactor at its centre and a
      resizable chat panel docked right. Everything the old layout kept on
      screen permanently — two telemetry rails, meters, a shortcut list, a view
      switcher — is now in the command palette on `Ctrl+K`, and what is left is
      one status line along the bottom.
  - [x] the reactor is a real 3D object (Three.js, WebGL): PBR housing lit by
        an environment map built at runtime, emissive plasma, bloom. Its hue
        and speed say what the assistant is doing. `ui/src/lib/reactor.ts`
  - [x] the reactor is turned by hand — drag to orbit, wheel to zoom, double
        click to reset. A flick keeps turning and settles; left alone for a
        few seconds it eases back to rest and the ambient drift fades in.
  - [x] command palette — every action in one searchable list, which is what
        lets the stage stay empty. `ui/src/lib/CommandPalette.svelte`
  - [x] chat panel resizable by its left edge, width persisted, `Ctrl+B` to
        hide. `ui/src/lib/ChatPanel.svelte`
  - [x] light and dark themes, accent derived from one hue in `styles.css`.
        The reactor rebuilds its environment map to match.
  - [x] approvals inline in the message flow. They are messages now, answered
        where they appear and left in the feed marked with what was decided.
        The modal is gone; it stole the keyboard mid-sentence every time.
  - [x] microphone in the composer, with the live level as a ring around it.
        The level is its own command polled at 10 Hz — `get_status` is far
        too heavy for that — and only while something is listening.
  - [x] tool calls collapsed to one line, expandable to show what the tool was
        called with and what it returned.
  - [ ] conversation list — the note's "solda konuşma listesi". Needs sessions
        in the database; the app has one conversation today. The left rail it
        was meant for is gone, so it now belongs in the panel header or the
        palette.
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
- Tools are synchronous but the agent loop that calls them is async, so any
  network tool that builds its own runtime and `block_on`s it panics with
  "Cannot start a runtime from within a runtime" — killing the request thread,
  so no reply ever arrives. Every tool goes through `vavis_tools::run_async`
  instead (`crates/vavis-tools/src/blocking.rs`), which reuses the ambient
  runtime when there is one. `tools_run_from_inside_a_runtime` in `agent.rs`
  drives a real tool through the agent from inside a runtime, and
  `the_old_pattern_panics_inside_a_runtime` pins down why the helper exists.
- `max_output` was 1024 for every model, so any long answer stopped
  mid-sentence and a code block stopped mid-line, with nothing to say it had
  been truncated — providers just stop at the number they are given. The reply
  limit is per family now, and held to a quarter of the window by
  `ModelCaps::new` so it cannot starve the input instead.
  `every_model_can_write_a_long_answer` guards it.
- A Spotify client id that is really the redirect URI produces a blank
  `client_id: Not present` page — Spotify does not say the id was malformed,
  so it is unreportable from the response. The settings screen prints the
  redirect URI directly above the input, which is what makes the paste easy,
  so `spotify::auth::check_client_id` rejects it before the browser opens.
- The reactor canvas takes pointer events, but the stage around it does not:
  the canvas is full-bleed, so `pointer-events: none` on `.stage` with `auto`
  on `.host` is what keeps empty space from swallowing clicks meant for the
  page. The wheel listener is registered non-passive on purpose — Chrome
  defaults wheel listeners to passive, which silently voids `preventDefault`
  and lets the page scroll behind the zoom.
- Camera distance is split in two: `resize` owns `baseDistance` and the wheel
  owns `zoom`, multiplied in the loop. Writing `camera.position.z` from both
  means whichever fires last discards the other, so resizing the window would
  throw away the zoom.
- The reactor's core is built only from additive layers; there is no opaque
  sphere at its centre. An emissive sphere is the obvious way and hides the
  very glow layers meant to give it depth, so it renders as a flat pale disc
  no matter how bright it is driven.
- The reactor's environment map must outlive the `PMREMGenerator` that made
  it. `pmrem.dispose()` frees the render target the returned texture lives in,
  so calling it at build time leaves every metal surface reflecting a released
  buffer: the housing renders near-black and nothing reports an error. Both are
  released together in the reactor's own `dispose`.
- Bloom is a screen-space pass and ignores materials, so it is switched off
  entirely in the light theme rather than merely reduced. On a light ground the
  page is already near the threshold and any strength at all smears a halo over
  the housing that no material setting can undo.
- The theme is applied to `<html>` in `main.ts`, before the app mounts, not
  from an effect inside it. Components read `data-theme` as they initialise —
  the reactor builds a whole environment map from it — and a child's `onMount`
  runs before the parent's `$effect`.
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
cargo test --workspace          # 644 passing
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

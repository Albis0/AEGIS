<!--
  Settings.

  Categories on the left, content on the right — the layout Obsidian and the
  Claude web app both use, and the only one that carries this many settings
  without drowning the reader. A narrow rail panel could not: by the time
  every integration had a section it was a two-thousand-pixel scroll.

  Three rules hold here.

  **Everything applies immediately.** There is no save button, because there
  is no such thing as losing a change you forgot to save. Secrets are the one
  exception: a key field commits on Enter or on leaving the field, not on
  every keystroke, or half a key would be stored and tested.

  **A key is never shown again.** Once stored it is masked and reported as
  stored. The value lives encrypted in `keys.dat` and does not come back
  across this bridge.

  **Status is visible, and testable.** Every provider and integration says
  whether it is connected, and "test" makes a real request rather than
  checking that a field is non-empty. Nobody should learn that their key is
  wrong by starting a conversation.
-->
<script lang="ts">
  import {
    api,
    type CanvasSettings,
    type ConnectionTest,
    type Fact,
    type McpServerInfo,
    type SearchSettings,
    type SpotifySettings,
    type SteamSettings,
    type Tool,
    type VaultInfo,
  } from "./api";
  import { chat } from "./store.svelte";

  const status = $derived(chat.status);

  interface Category {
    id: string;
    label: string;
    icon: string;
    /** Extra words the search box should match — what people actually type. */
    keywords: string;
  }

  const CATEGORIES: Category[] = [
    { id: "general", label: "General", icon: "◈", keywords: "name language font window interface theme size assistant" },
    { id: "provider", label: "Model", icon: "◉", keywords: "provider model llm groq openai anthropic claude gemini local ollama temperature" },
    { id: "keys", label: "API keys", icon: "⚿", keywords: "key token secret credential api auth" },
    { id: "voice", label: "Voice", icon: "◍", keywords: "microphone speech tts stt wake word listen speak" },
    { id: "memory", label: "Memory", icon: "◎", keywords: "facts remember forget knowledge history" },
    { id: "search", label: "Web search", icon: "⌕", keywords: "tavily brave duckduckgo searx internet browse" },
    { id: "canvas", label: "Image & video", icon: "◧", keywords: "canvas image video generate openai stability replicate dalle gallery disk" },
    { id: "obsidian", label: "Obsidian", icon: "❒", keywords: "vault notes markdown wiki" },
    { id: "spotify", label: "Spotify", icon: "♪", keywords: "music playback player oauth" },
    { id: "steam", label: "Steam", icon: "▤", keywords: "games library achievements wishlist" },
    { id: "mcp", label: "MCP servers", icon: "⁘", keywords: "model context protocol custom server stdio http tools" },
    { id: "tools", label: "Tools", icon: "⚙", keywords: "tool registry risk domain permission approval" },
    { id: "shortcuts", label: "Shortcuts", icon: "⌘", keywords: "keyboard keys hotkey binding" },
    { id: "data", label: "Data", icon: "▦", keywords: "folder disk database storage conversation clear export" },
  ];

  let active = $state("general");
  let query = $state("");
  let notice = $state("");

  /** Test results, keyed by target. */
  let tests = $state<Record<string, ConnectionTest>>({});
  let testing = $state<string | null>(null);

  const matches = $derived(
    query.trim()
      ? CATEGORIES.filter((c) =>
          `${c.label} ${c.keywords}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
      : CATEGORIES,
  );

  // A search that narrows to one category should land on it rather than
  // leaving the reader looking at an unrelated pane.
  $effect(() => {
    if (matches.length > 0 && !matches.some((c) => c.id === active)) {
      active = matches[0].id;
    }
  });

  async function test(target: string) {
    testing = target;
    try {
      tests[target] = await api.testConnection(target);
    } catch (e) {
      tests[target] = { ok: false, detail: String(e) };
    } finally {
      testing = null;
    }
  }

  // ── Loaded state ───────────────────────────────────────────────────

  let search = $state<SearchSettings | null>(null);
  let canvas = $state<CanvasSettings | null>(null);
  let vaults = $state<VaultInfo[]>([]);
  let spotify = $state<SpotifySettings | null>(null);
  let steam = $state<SteamSettings | null>(null);
  let mcp = $state<McpServerInfo[]>([]);
  let facts = $state<Fact[]>([]);
  let tools = $state<Tool[]>([]);
  let models = $state<string[]>([]);
  let loadingModels = $state(false);

  let keyProvider = $state("groq");
  let keyDraft = $state("");
  let searchKeyProvider = $state("tavily");
  let searchKeyDraft = $state("");
  let canvasKeyProvider = $state("openai");
  let canvasKeyDraft = $state("");
  let steamIdDraft = $state("");
  let steamKeyDraft = $state("");
  let spotifyIdDraft = $state("");

  let dragFrom = $state<number | null>(null);
  let canvasDragFrom = $state<number | null>(null);
  let mcpOpen = $state(false);
  let mcpExpanded = $state<string | null>(null);
  let draft = $state({
    id: "",
    transport: "stdio",
    command: "",
    args: "",
    url: "",
    headerName: "",
    headerValue: "",
    secret: "",
  });

  const KEYED_SEARCH = ["tavily", "brave", "custom"];
  const SEARCH_BLURB: Record<string, string> = {
    tavily: "written answer + sources, free tier",
    brave: "independent index, 2000 queries/month free",
    custom: "your own JSON endpoint",
    duckduckgo: "no key needed — the fallback",
  };

  const KEYED_CANVAS = ["openai", "stability", "replicate", "custom"];
  const CANVAS_BLURB: Record<string, string> = {
    openai: "gpt-image-1 — uses your chat key if you have one",
    stability: "reports the seed it used, so results repeat",
    replicate: "the only one here that also does video",
    custom: "your own OpenAI-compatible endpoint",
  };

  const LANGUAGES: [string, string][] = [
    ["en", "English"],
    ["tr", "Türkçe"],
    ["de", "Deutsch"],
    ["fr", "Français"],
    ["es", "Español"],
  ];

  const WINDOW_MODES = ["windowed", "borderless", "fullscreen"];

  const SHORTCUTS: [string, string][] = [
    ["Ctrl + ,", "open settings"],
    ["Ctrl + M", "cycle voice mode"],
    ["Ctrl + L", "clear the conversation"],
    ["Ctrl + S", "save the open file (code interface)"],
    ["Esc", "stop speaking, or close this"],
    ["F11", "cycle window mode"],
    ["Enter", "send"],
    ["Shift + Enter", "newline"],
  ];

  $effect(() => {
    void load();
  });

  async function load() {
    try {
      keyProvider = status?.provider ?? "groq";
      steamIdDraft = (await api.steamSettings()).steamId;
      [search, canvas, vaults, spotify, steam, mcp, facts, tools] =
        await Promise.all([
          api.searchSettings(),
          api.canvasSettings(),
          api.listVaults(),
          api.spotifySettings(),
          api.steamSettings(),
          api.listMcpServers(),
          api.listFacts(),
          api.listTools(),
        ]);
      spotifyIdDraft = spotify?.clientId ?? "";
    } catch (e) {
      notice = String(e);
    }
  }

  /** Wraps an action so every failure lands in the same place. */
  async function run(action: () => Promise<unknown>, said = "") {
    try {
      await action();
      if (said) notice = said;
    } catch (e) {
      notice = String(e);
    }
  }

  async function updateSetting(field: string, value: string) {
    await run(async () => {
      await api.setSetting(field, value);
      await chat.refresh();
      notice = field === "fontSize" ? "Applies after restart." : "Saved.";
    });
  }

  async function saveKey() {
    if (!keyDraft.trim()) return;
    await run(async () => {
      await api.setKey(keyProvider, keyDraft.trim());
      keyDraft = "";
      await chat.refresh();
      // The stored key is proved immediately rather than at the next
      // conversation, which is the entire point of this screen.
      void test(keyProvider);
    }, "Key saved, encrypted.");
  }

  async function pickProvider(id: string) {
    await run(async () => {
      await api.setProvider(id);
      models = [];
      await chat.refresh();
    });
  }

  async function fetchModels() {
    loadingModels = true;
    await run(async () => {
      models = await api.listModels();
    });
    loadingModels = false;
  }

  async function pickModel(model: string) {
    await run(async () => {
      await api.setModel(model);
      models = [];
      await chat.refresh();
    });
  }

  async function saveSearchKey() {
    if (!searchKeyDraft.trim()) return;
    await run(async () => {
      await api.setSearchKey(searchKeyProvider, searchKeyDraft.trim());
      searchKeyDraft = "";
      search = await api.searchSettings();
    }, "Search key saved, encrypted.");
  }

  function moveProvider(from: number, to: number) {
    if (!search || to < 0 || to >= search.order.length || from === to) return;
    const order = [...search.order];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    search = { ...search, order };
    void run(async () => {
      await api.setSearchOrder(order);
      search = await api.searchSettings();
    });
  }

  async function saveCustomSearch() {
    if (!search) return;
    await run(async () => {
      await api.setCustomSearch(search!.custom);
      search = await api.searchSettings();
    }, "Endpoint saved.");
  }

  function moveCanvasProvider(from: number, to: number) {
    if (!canvas || to < 0 || to >= canvas.imageOrder.length || from === to)
      return;
    const order = [...canvas.imageOrder];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    canvas = { ...canvas, imageOrder: order };
    void run(async () => {
      await api.setCanvasOrder("image", order);
      canvas = await api.canvasSettings();
    });
  }

  async function saveCanvasKey() {
    if (!canvasKeyDraft.trim()) return;
    await run(async () => {
      await api.setCanvasKey(canvasKeyProvider, canvasKeyDraft.trim());
      canvasKeyDraft = "";
      canvas = await api.canvasSettings();
    }, "Generation key saved, encrypted.");
  }

  async function saveCanvasDefaults() {
    if (!canvas) return;
    await run(async () => {
      await api.setCanvasDefaults({
        imageModel: canvas!.imageModel,
        videoModel: canvas!.videoModel,
        size: canvas!.size,
        count: canvas!.count,
        customUrl: canvas!.customUrl,
        customHeaderName: canvas!.customHeaderName,
        customHeaderValue: canvas!.customHeaderValue,
        customModel: canvas!.customModel,
      });
      canvas = await api.canvasSettings();
    }, "Saved.");
  }

  async function clearGallery() {
    if (!confirm("Delete every generated file except starred ones?")) return;
    await run(async () => {
      const freed = await api.clearGallery(true);
      canvas = await api.canvasSettings();
      notice = `Freed ${bytes(freed)}.`;
    });
  }

  async function pickVault(path: string) {
    await run(async () => {
      await api.setVault(path);
      vaults = await api.listVaults();
      void test("obsidian");
    });
  }

  async function saveSteam() {
    await run(async () => {
      // The backend verifies and reports what it found, including the
      // private-profile case that otherwise looks like an empty library.
      notice = await api.setSteam(steamIdDraft.trim(), steamKeyDraft.trim());
      steamKeyDraft = "";
      steam = await api.steamSettings();
    });
  }

  async function connectSpotify() {
    await run(async () => {
      await api.setSpotifyClientId(spotifyIdDraft.trim());
      await api.connectSpotify();
    }, "Browser opened — approve the request there.");
  }

  async function disconnectSpotify() {
    await run(async () => {
      await api.disconnectSpotify();
      spotify = await api.spotifySettings();
    }, "Spotify disconnected.");
  }

  async function mcpAction(fn: () => Promise<unknown>) {
    await run(async () => {
      await fn();
      mcp = await api.listMcpServers();
      await chat.refresh();
    });
  }

  async function saveMcp() {
    await run(async () => {
      notice = await api.saveMcpServer(draft);
      draft = {
        id: "",
        transport: "stdio",
        command: "",
        args: "",
        url: "",
        headerName: "",
        headerValue: "",
        secret: "",
      };
      mcp = await api.listMcpServers();
      await chat.refresh();
    });
  }

  function bytes(n: number): string {
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function close() {
    chat.panel = "none";
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") close();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="scrim" role="presentation" onclick={close}></div>

<div class="settings" role="dialog" aria-label="Settings">
  <nav class="categories">
    <div class="nav-head">
      <span class="nav-title">Settings</span>
      <button class="tiny" onclick={close}>✕</button>
    </div>

    <input
      class="search"
      bind:value={query}
      placeholder="search settings…"
    />

    {#each matches as category (category.id)}
      <button
        class="category"
        class:active={active === category.id}
        onclick={() => (active = category.id)}
      >
        <span class="cat-icon">{category.icon}</span>
        {category.label}
      </button>
    {/each}

    {#if matches.length === 0}
      <p class="hint">Nothing matches "{query}".</p>
    {/if}
  </nav>

  <section class="pane">
    {#if notice}
      <div class="notice">{notice}</div>
    {/if}

    {#if active === "general"}
      <h2>General</h2>

      <label class="field">
        <span>assistant name</span>
        <input
          value={status?.assistantName ?? ""}
          onchange={(e) => updateSetting("name", e.currentTarget.value)}
        />
      </label>
      <p class="hint">Spoken aloud by the voice, so pick something sayable.</p>

      <label class="field">
        <span>language</span>
        <select
          value={status?.language ?? "en"}
          onchange={(e) => updateSetting("language", e.currentTarget.value)}
        >
          {#each LANGUAGES as [code, name] (code)}
            <option value={code}>{name}</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span>window</span>
        <select
          value={status?.windowMode ?? "windowed"}
          onchange={(e) => updateSetting("windowMode", e.currentTarget.value)}
        >
          {#each WINDOW_MODES as mode (mode)}
            <option value={mode}>{mode}</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span>font size</span>
        <input
          type="number"
          min="8"
          max="32"
          value={status?.fontSize ?? 14}
          onchange={(e) => updateSetting("fontSize", e.currentTarget.value)}
        />
      </label>

      <p class="hint">Version {status?.version ?? "—"}</p>
    {:else if active === "provider"}
      <h2>Model</h2>
      <p class="hint">
        Which provider answers. A provider without a key is marked; the key
        itself goes in API keys.
      </p>

      <div class="chips">
        {#each status?.providers ?? [] as p (p.id)}
          <button
            class="chip"
            class:active={p.id === status?.provider}
            class:missing={p.needsKey && !p.hasKey}
            onclick={() => pickProvider(p.id)}
            title={p.needsKey && !p.hasKey ? "no key stored" : p.defaultModel}
          >
            {p.id}
          </button>
        {/each}
      </div>

      <!-- A read-only row, not a label: there is no control to label. -->
      <div class="field">
        <span>current model</span>
        <span class="value">{status?.model ?? "—"}</span>
      </div>

      <div class="actions">
        <button onclick={fetchModels} disabled={loadingModels}>
          {loadingModels ? "loading…" : "list models"}
        </button>
        <button
          onclick={() => test(status?.provider ?? "groq")}
          disabled={testing !== null}
        >
          {testing === status?.provider ? "testing…" : "test"}
        </button>
      </div>

      {#if tests[status?.provider ?? ""]}
        {@const result = tests[status?.provider ?? ""]}
        <p class="result" class:bad={!result.ok}>
          {result.ok ? "✓" : "✕"} {result.detail}
        </p>
      {/if}

      {#if models.length}
        <div class="list scroll">
          {#each models as m (m)}
            <button class="row" onclick={() => pickModel(m)}>{m}</button>
          {/each}
        </div>
      {/if}
    {:else if active === "keys"}
      <h2>API keys</h2>
      <p class="hint">
        Stored encrypted with Windows DPAPI, never written to the settings
        file and never shown again after they are saved.
      </p>

      {#each status?.providers ?? [] as p (p.id)}
        {#if p.needsKey}
          <div class="entry">
            <div class="entry-main">
              <span class="tool-name">
                {p.id}
                <span class="risk" data-risk={p.hasKey ? "safe" : "destructive"}>
                  {p.hasKey ? "stored" : "no key"}
                </span>
              </span>
              {#if tests[p.id]}
                <span class="tool-desc" class:bad={!tests[p.id].ok}>
                  {tests[p.id].ok ? "✓" : "✕"} {tests[p.id].detail}
                </span>
              {/if}
            </div>
            <div class="entry-actions">
              <button
                class="tiny"
                disabled={!p.hasKey || testing !== null}
                onclick={() => test(p.id)}
              >
                {testing === p.id ? "…" : "test"}
              </button>
            </div>
          </div>
        {/if}
      {/each}

      <div class="row-group">
        <select bind:value={keyProvider}>
          {#each status?.providers ?? [] as p (p.id)}
            {#if p.needsKey}
              <option value={p.id}>{p.id}{p.hasKey ? " ✓" : ""}</option>
            {/if}
          {/each}
        </select>
        <input
          type="password"
          bind:value={keyDraft}
          placeholder="paste key…"
          onkeydown={(e) => e.key === "Enter" && saveKey()}
          onblur={saveKey}
        />
      </div>
      <p class="hint">Committed on Enter or when you leave the field.</p>
    {:else if active === "voice"}
      <h2>Voice</h2>
      <p class="hint">
        Off, wake word, or always listening. The rail on the left switches
        between them, and so does Ctrl+M.
      </p>

      <div class="field">
        <span>mode</span>
        <span class="value">{status?.voiceMode ?? "off"}</span>
      </div>

      <div class="actions">
        <button onclick={() => chat.cycleVoice()}>cycle mode</button>
        {#if status?.speaking}
          <button onclick={() => chat.stopSpeaking()}>stop speaking</button>
        {/if}
      </div>

      <p class="hint">
        Speech recognition runs through Groq, so it needs the Groq key even
        when another provider is answering.
      </p>
    {:else if active === "memory"}
      <h2>Memory</h2>
      <p class="hint">
        Facts the assistant keeps between conversations. Clearing the
        conversation does not touch these.
      </p>

      {#if facts.length === 0}
        <p class="hint">Nothing remembered yet. Try "remember that I…".</p>
      {:else}
        <div class="list scroll">
          {#each facts as fact (fact.id)}
            <div class="entry">
              <div class="entry-main">
                <span class="tool-desc">{fact.text}</span>
              </div>
              <div class="entry-actions">
                <button
                  class="danger tiny"
                  onclick={() =>
                    run(async () => {
                      await api.forgetFact(fact.id);
                      facts = await api.listFacts();
                      await chat.refresh();
                    })}
                >
                  forget
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else if active === "search"}
      <h2>Web search</h2>
      {#if search}
        <p class="hint">
          Tried in order until one answers. Providers with no key are skipped,
          so the chain always ends somewhere that works.
        </p>

        <div class="chain">
          {#each search.order as id, i (id)}
            <div
              class="link"
              class:unconfigured={KEYED_SEARCH.includes(id) &&
                !search.configured.includes(id)}
              draggable="true"
              role="listitem"
              ondragstart={() => (dragFrom = i)}
              ondragover={(e) => e.preventDefault()}
              ondrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) moveProvider(dragFrom, i);
                dragFrom = null;
              }}
              ondragend={() => (dragFrom = null)}
            >
              <span class="rank">{i + 1}</span>
              <span class="link-main">
                <span class="link-name">{id}</span>
                <span class="link-note">
                  {#if KEYED_SEARCH.includes(id) && !search.configured.includes(id)}
                    no key — skipped
                  {:else}
                    {SEARCH_BLURB[id] ?? ""}
                  {/if}
                </span>
              </span>
              <span class="link-actions">
                <button class="tiny" disabled={i === 0} onclick={() => moveProvider(i, i - 1)}>↑</button>
                <button
                  class="tiny"
                  disabled={i === search.order.length - 1}
                  onclick={() => moveProvider(i, i + 1)}>↓</button
                >
              </span>
            </div>
          {/each}
        </div>

        <div class="row-group">
          <select bind:value={searchKeyProvider}>
            {#each KEYED_SEARCH as id (id)}
              <option value={id}>
                {id}{search.configured.includes(id) ? " ✓" : ""}
              </option>
            {/each}
          </select>
          <input
            type="password"
            bind:value={searchKeyDraft}
            placeholder="paste key…"
            onkeydown={(e) => e.key === "Enter" && saveSearchKey()}
            onblur={saveSearchKey}
          />
        </div>

        <div class="actions">
          <button onclick={() => test("search")} disabled={testing !== null}>
            {testing === "search" ? "searching…" : "test"}
          </button>
        </div>
        {#if tests.search}
          <p class="result" class:bad={!tests.search.ok}>
            {tests.search.ok ? "✓" : "✕"} {tests.search.detail}
          </p>
        {/if}

        <h3>Custom endpoint</h3>
        <p class="hint">
          Any JSON search API — a self-hosted SearxNG, a company service. The
          address must contain <code>{"{query}"}</code>;
          <code>{"{key}"}</code> in the header value is filled from the stored key.
        </p>
        <input bind:value={search.custom.url} onchange={saveCustomSearch} placeholder="https://…?q={'{query}'}&format=json" />
        <input bind:value={search.custom.resultsPath} onchange={saveCustomSearch} placeholder="results path (e.g. results)" />
        <input bind:value={search.custom.titleKey} onchange={saveCustomSearch} placeholder="title field (default: title)" />
        <input bind:value={search.custom.urlKey} onchange={saveCustomSearch} placeholder="url field (default: url)" />
        <input bind:value={search.custom.snippetKey} onchange={saveCustomSearch} placeholder="snippet field (default: content)" />
        <input bind:value={search.custom.headerName} onchange={saveCustomSearch} placeholder="auth header (optional)" />
        <input bind:value={search.custom.headerValue} onchange={saveCustomSearch} placeholder="header value, e.g. Bearer {'{key}'}" />
      {/if}
    {:else if active === "canvas"}
      <h2>Image &amp; video</h2>
      {#if canvas}
        <p class="hint">
          Same idea as the search chain: tried in order, no key means skipped.
          Results land in the canvas interface, not in the conversation.
        </p>

        <div class="chain">
          {#each canvas.imageOrder as id, i (id)}
            <div
              class="link"
              class:unconfigured={!canvas.configured.includes(id)}
              draggable="true"
              role="listitem"
              ondragstart={() => (canvasDragFrom = i)}
              ondragover={(e) => e.preventDefault()}
              ondrop={(e) => {
                e.preventDefault();
                if (canvasDragFrom !== null) moveCanvasProvider(canvasDragFrom, i);
                canvasDragFrom = null;
              }}
              ondragend={() => (canvasDragFrom = null)}
            >
              <span class="rank">{i + 1}</span>
              <span class="link-main">
                <span class="link-name">{id}</span>
                <span class="link-note">
                  {#if !canvas.configured.includes(id)}
                    {id === "custom" ? "no endpoint — skipped" : "no key — skipped"}
                  {:else}
                    {CANVAS_BLURB[id] ?? ""}
                  {/if}
                </span>
              </span>
              <span class="link-actions">
                <button class="tiny" disabled={i === 0} onclick={() => moveCanvasProvider(i, i - 1)}>↑</button>
                <button
                  class="tiny"
                  disabled={i === canvas.imageOrder.length - 1}
                  onclick={() => moveCanvasProvider(i, i + 1)}>↓</button
                >
              </span>
            </div>
          {/each}
        </div>

        <div class="row-group">
          <select bind:value={canvasKeyProvider}>
            {#each KEYED_CANVAS as id (id)}
              <option value={id}>
                {id}{canvas.configured.includes(id) ? " ✓" : ""}
              </option>
            {/each}
          </select>
          <input
            type="password"
            bind:value={canvasKeyDraft}
            placeholder="paste key…"
            onkeydown={(e) => e.key === "Enter" && saveCanvasKey()}
            onblur={saveCanvasKey}
          />
        </div>

        <div class="actions">
          <button onclick={() => test("canvas")} disabled={testing !== null}>
            test
          </button>
        </div>
        {#if tests.canvas}
          <p class="result" class:bad={!tests.canvas.ok}>
            {tests.canvas.ok ? "✓" : "✕"} {tests.canvas.detail}
          </p>
        {/if}
        <p class="hint">
          The test reports what is configured rather than generating something
          — a test that charged you a few cents per press would not be one.
        </p>

        <h3>Models</h3>
        <p class="hint">
          Empty means the provider's own default, so a new model upstream needs
          no update here.
        </p>
        <input bind:value={canvas.imageModel} onchange={saveCanvasDefaults} placeholder="image model (optional)" />
        <input bind:value={canvas.videoModel} onchange={saveCanvasDefaults} placeholder="video model (optional)" />

        <h3>Custom endpoint</h3>
        <p class="hint">
          Must speak the OpenAI <code>/images/generations</code> shape.
          <code>{"{key}"}</code> in the header value is filled from the stored key.
        </p>
        <input bind:value={canvas.customUrl} onchange={saveCanvasDefaults} placeholder="http://localhost:8080/v1/images/generations" />
        <input bind:value={canvas.customModel} onchange={saveCanvasDefaults} placeholder="model (optional)" />
        <input bind:value={canvas.customHeaderName} onchange={saveCanvasDefaults} placeholder="auth header (optional)" />
        <input bind:value={canvas.customHeaderValue} onchange={saveCanvasDefaults} placeholder="header value, e.g. Bearer {'{key}'}" />

        <h3>Storage</h3>
        <div class="row-between">
          <span class="hint">
            {canvas.items} results · {bytes(canvas.bytes)} on disk
          </span>
          <span class="link-actions">
            <button class="tiny" onclick={() => api.openMediaFolder()}>folder</button>
            <button class="tiny" onclick={clearGallery}>clear</button>
          </span>
        </div>
        <p class="hint">Clearing spares anything you starred.</p>
      {/if}
    {:else if active === "obsidian"}
      <h2>Obsidian</h2>
      {#if vaults.length === 0}
        <p class="hint">
          No vault found. Obsidian does not have to be running — Vavis reads
          the Markdown files directly — but it needs to know where the vault is.
        </p>
      {:else}
        <p class="hint">
          Notes are read and written on disk, so this works whether or not
          Obsidian is open.
        </p>
        <div class="list">
          {#each vaults as v (v.path)}
            <button
              class="row"
              class:active={v.active}
              title={v.path}
              onclick={() => pickVault(v.path)}
            >
              {v.active ? "● " : "○ "}{v.name}
            </button>
          {/each}
        </div>

        <div class="actions">
          <button onclick={() => test("obsidian")} disabled={testing !== null}>
            {testing === "obsidian" ? "reading…" : "test"}
          </button>
        </div>
        {#if tests.obsidian}
          <p class="result" class:bad={!tests.obsidian.ok}>
            {tests.obsidian.ok ? "✓" : "✕"} {tests.obsidian.detail}
          </p>
        {/if}
      {/if}
    {:else if active === "spotify"}
      <h2>Spotify</h2>
      {#if spotify?.connected}
        <p class="result">✓ Connected.</p>
        <div class="actions">
          <button onclick={() => test("spotify")} disabled={testing !== null}>
            test
          </button>
          <button class="danger" onclick={disconnectSpotify}>disconnect</button>
        </div>
        {#if tests.spotify}
          <p class="result" class:bad={!tests.spotify.ok}>
            {tests.spotify.ok ? "✓" : "✕"} {tests.spotify.detail}
          </p>
        {/if}
      {:else}
        <p class="hint">
          Create an app on the Spotify developer dashboard, paste its client id
          here, and register this exact redirect URI on it:
        </p>
        <p class="path selectable">{spotify?.redirectUri ?? ""}</p>
        <input bind:value={spotifyIdDraft} placeholder="client id" />
        <div class="actions">
          <button class="primary" onclick={connectSpotify}>connect</button>
          <button
            onclick={() =>
              run(async () => {
                await api.setSpotifyClientId(spotifyIdDraft.trim());
                spotify = await api.spotifySettings();
              }, "Client id saved.")}
          >
            save id only
          </button>
        </div>
      {/if}
    {:else if active === "steam"}
      <h2>Steam</h2>
      <p class="hint">
        Needs a Web API key and your SteamID64. Game details must be public, or
        Steam returns an empty library without saying why.
      </p>
      <input bind:value={steamIdDraft} placeholder="SteamID64 (17 digits)" />
      <input
        type="password"
        bind:value={steamKeyDraft}
        placeholder={steam?.hasKey ? "key stored — paste to replace" : "Web API key…"}
        onkeydown={(e) => e.key === "Enter" && saveSteam()}
      />
      <div class="actions">
        <button class="primary" onclick={saveSteam}>save and check</button>
        <button
          onclick={() => test("steam")}
          disabled={testing !== null || !steam?.hasKey}
        >
          {testing === "steam" ? "asking…" : "test"}
        </button>
      </div>
      {#if tests.steam}
        <p class="result" class:bad={!tests.steam.ok}>
          {tests.steam.ok ? "✓" : "✕"} {tests.steam.detail}
        </p>
      {/if}
      <p class="hint">
        Which game is running is detected locally, so that part works even on a
        private profile.
      </p>
    {:else if active === "mcp"}
      <h2>MCP servers</h2>
      <p class="hint">
        Connect any MCP server and its tools become available. A server runs as
        a process on this machine, so its tools always ask before running.
      </p>

      {#each mcp as server (server.id)}
        <div class="entry" class:off={!server.enabled}>
          <div class="entry-main">
            <span class="tool-name">
              {server.id}
              <span class="risk" data-risk={server.connected ? "safe" : "destructive"}>
                {server.connected ? "connected" : "offline"}
              </span>
            </span>
            <!-- Exactly what runs, so it can be judged before it does. -->
            <span class="tool-desc selectable">{server.commandLine}</span>
            {#if server.connected}
              <button
                class="disclosure"
                onclick={() =>
                  (mcpExpanded = mcpExpanded === server.id ? null : server.id)}
              >
                {mcpExpanded === server.id ? "▾" : "▸"}
                {server.tools.length + server.disabled.length} tools
              </button>
            {/if}
          </div>
          <div class="entry-actions">
            <button
              class="tiny"
              onclick={() =>
                mcpAction(() => api.toggleMcpServer(server.id, !server.enabled))}
            >
              {server.enabled ? "disable" : "enable"}
            </button>
            <button
              class="danger tiny"
              onclick={() => mcpAction(() => api.removeMcpServer(server.id))}
            >
              remove
            </button>
          </div>
        </div>

        {#if mcpExpanded === server.id}
          <div class="list">
            {#each [...server.tools, ...server.disabled].sort() as tool (tool)}
              {@const on = !server.disabled.includes(tool)}
              <button
                class="row"
                class:active={on}
                onclick={() => mcpAction(() => api.toggleMcpTool(server.id, tool, !on))}
              >
                {on ? "● " : "○ "}{tool}
              </button>
            {/each}
          </div>
        {/if}
      {/each}

      <button class="disclosure" onclick={() => (mcpOpen = !mcpOpen)}>
        {mcpOpen ? "▾" : "▸"} add a server
      </button>
      {#if mcpOpen}
        <input bind:value={draft.id} placeholder="id, e.g. github" />
        <label class="field">
          <span>transport</span>
          <select bind:value={draft.transport}>
            <option value="stdio">stdio</option>
            <option value="http">http</option>
          </select>
        </label>
        {#if draft.transport === "stdio"}
          <input bind:value={draft.command} placeholder="command, e.g. npx" />
          <input bind:value={draft.args} placeholder="arguments, e.g. -y @modelcontextprotocol/server-github" />
        {:else}
          <input bind:value={draft.url} placeholder="https://…/mcp" />
          <input bind:value={draft.headerName} placeholder="auth header (optional)" />
          <input bind:value={draft.headerValue} placeholder="header value, e.g. Bearer {'{key}'}" />
        {/if}
        <input type="password" bind:value={draft.secret} placeholder="secret (optional)" />
        <button class="primary" onclick={saveMcp}>add and connect</button>
      {/if}
    {:else if active === "tools"}
      <h2>Tools</h2>
      <p class="hint">
        {tools.length} registered. The model is never offered more than twelve
        at once — it picks better from a short list than a long one.
      </p>
      <div class="list scroll">
        {#each tools as tool (tool.name)}
          <div class="entry">
            <div class="entry-main">
              <span class="tool-name">
                {tool.name}
                <span class="risk" data-risk={tool.risk}>{tool.risk}</span>
              </span>
              <span class="tool-desc">{tool.description}</span>
            </div>
            <div class="entry-actions">
              <span class="domain">{tool.domain}</span>
            </div>
          </div>
        {/each}
      </div>
    {:else if active === "shortcuts"}
      <h2>Shortcuts</h2>
      <div class="list">
        {#each SHORTCUTS as [key, action] (key)}
          <div class="shortcut-row">
            <kbd>{key}</kbd>
            <span>{action}</span>
          </div>
        {/each}
      </div>
    {:else if active === "data"}
      <h2>Data</h2>
      <p class="hint">Everything Vavis stores lives here:</p>
      <p class="path selectable">{status?.dataDir ?? ""}</p>

      <div class="field">
        <span>conversation</span>
        <span class="value">{status?.messageCount ?? 0} messages</span>
      </div>
      <div class="field">
        <span>remembered</span>
        <span class="value">{status?.factCount ?? 0} facts</span>
      </div>
      {#if canvas}
        <div class="field">
          <span>generated</span>
          <span class="value">{canvas.items} files · {bytes(canvas.bytes)}</span>
        </div>
      {/if}

      <div class="actions">
        <button class="danger" onclick={() => chat.clear()}>
          clear the conversation
        </button>
      </div>
      <p class="hint">Remembered facts survive that — forget them in Memory.</p>
    {/if}
  </section>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(3, 8, 14, 0.72);
    z-index: 40;
  }

  .settings {
    position: fixed;
    inset: 5% 8%;
    display: flex;
    z-index: 41;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }

  .categories {
    width: 190px;
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sp-3);
    border-right: 1px solid var(--line);
    background: rgba(10, 17, 26, 0.7);
    overflow-y: auto;
  }

  .nav-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--sp-2);
  }

  .nav-title {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .search {
    margin-bottom: var(--sp-2);
  }

  .category {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    border: 1px solid transparent;
    background: none;
    text-align: left;
    padding: 4px var(--sp-1);
    font-size: var(--text-xs);
    color: var(--text-muted);
    border-radius: var(--r-md);
  }
  .category:hover {
    color: var(--text);
    background: var(--surface-hover);
  }
  .category.active {
    color: var(--accent-hover);
    border-color: var(--accent-line);
    background: var(--surface-hover);
  }

  .cat-icon {
    width: 12px;
    text-align: center;
    color: var(--accent);
    flex: 0 0 auto;
  }

  .pane {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: var(--sp-4);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }

  h2 {
    margin: 0 0 var(--sp-1);
    font-size: var(--text-md);
    font-weight: 500;
    color: var(--text);
  }

  h3 {
    margin: var(--sp-3) 0 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .field > span:first-child {
    flex: 0 0 auto;
  }
  .field input,
  .field select {
    flex: 0 1 260px;
  }
  .field .value {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text);
  }

  .row-group {
    display: flex;
    gap: var(--sp-1);
  }
  .row-group select {
    flex: 0 0 auto;
  }
  .row-group input {
    flex: 1;
    min-width: 0;
  }

  .actions {
    display: flex;
    gap: var(--sp-1);
    flex-wrap: wrap;
  }

  .row-between {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
  }

  .result {
    margin: 0;
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--accent);
  }
  .result.bad,
  .tool-desc.bad {
    color: var(--warning);
  }

  .notice {
    padding: var(--sp-1) var(--sp-2);
    font-size: var(--text-xs);
    color: var(--accent);
    border: 1px solid var(--accent-line);
    border-radius: var(--r-md);
  }

  .hint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-faint);
    line-height: 1.5;
  }

  .path {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-muted);
    word-break: break-all;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1);
  }

  .chip {
    font-size: var(--text-xs);
    padding: 2px 10px;
  }
  .chip.active {
    color: var(--accent-hover);
    border-color: var(--accent-line);
  }
  .chip.missing {
    color: var(--text-faint);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .scroll {
    max-height: 320px;
    overflow-y: auto;
  }

  .row {
    border: none;
    background: none;
    text-align: left;
    font-size: var(--text-xs);
    color: var(--text-muted);
    padding: 3px var(--sp-1);
  }
  .row:hover {
    background: var(--surface-hover);
    color: var(--text);
  }
  .row.active {
    color: var(--accent-hover);
  }

  .chain {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }

  .link {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-1) var(--sp-2);
    background: var(--surface-raised);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    cursor: grab;
  }
  .link.unconfigured {
    opacity: 0.55;
  }

  .rank {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--accent);
    flex: 0 0 auto;
  }

  .link-main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .link-name {
    font-size: var(--text-xs);
    color: var(--text);
  }

  .link-note {
    font-size: 10px;
    color: var(--text-faint);
  }

  .link-actions,
  .entry-actions {
    display: flex;
    gap: var(--sp-1);
    flex: 0 0 auto;
    align-items: center;
  }

  .entry {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--sp-2);
    padding: var(--sp-1) 0;
    border-bottom: 1px solid var(--line);
  }
  .entry.off {
    opacity: 0.5;
  }

  .entry-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .tool-name {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text);
  }

  .tool-desc {
    font-size: 10px;
    color: var(--text-faint);
    word-break: break-word;
  }

  .risk {
    font-size: 9px;
    padding: 0 5px;
    border-radius: 8px;
    border: 1px solid var(--line);
    color: var(--text-faint);
  }
  .risk[data-risk="safe"] {
    color: var(--accent);
    border-color: var(--accent-line);
  }
  .risk[data-risk="destructive"] {
    color: var(--warning);
    border-color: rgba(245, 158, 11, 0.4);
  }

  .domain {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-faint);
  }

  .disclosure {
    align-self: flex-start;
    border: none;
    background: none;
    padding: 2px 0;
    font-size: var(--text-xs);
    color: var(--accent);
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--text-xs);
    color: var(--text-muted);
    padding: 2px 0;
  }
  .shortcut-row kbd {
    flex: 0 0 130px;
  }

  .tiny {
    font-size: 10px;
    padding: 1px 6px;
  }

  input,
  select {
    background: var(--surface-sunken);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: 3px var(--sp-1);
    font-size: var(--text-xs);
    color: var(--text);
    font-family: inherit;
    min-width: 0;
  }

  .danger {
    color: var(--warning);
    border-color: rgba(245, 158, 11, 0.4);
  }
</style>

<!--
  The panels behind the right rail: settings, memory, automations, tools.

  This is the answer to "there is nothing to click". Everything that used
  to require a slash command has a control here.
-->
<script lang="ts">
  import { api, type Automation, type Fact, type Tool } from "./api";
  import { chat } from "./store.svelte";

  const status = $derived(chat.status);

  let facts = $state<Fact[]>([]);
  let automations = $state<Automation[]>([]);
  let tools = $state<Tool[]>([]);
  let models = $state<string[]>([]);
  let loadingModels = $state(false);
  let keyDraft = $state("");
  let keyProvider = $state("groq");
  let notice = $state("");

  /** Reloads whatever the open panel shows. */
  async function load() {
    notice = "";
    try {
      switch (chat.panel) {
        case "memory":
          facts = await api.listFacts();
          break;
        case "automations":
          automations = await api.listAutomations();
          break;
        case "tools":
          tools = await api.listTools();
          break;
        case "settings":
          keyProvider = status?.provider ?? "groq";
          break;
      }
    } catch (e) {
      notice = String(e);
    }
  }

  // Reload when the panel changes.
  $effect(() => {
    void chat.panel;
    void load();
  });

  async function saveKey() {
    if (!keyDraft.trim()) return;
    try {
      await api.setKey(keyProvider, keyDraft.trim());
      keyDraft = "";
      notice = "Key saved, encrypted.";
      await chat.refresh();
    } catch (e) {
      notice = String(e);
    }
  }

  async function pickProvider(id: string) {
    try {
      await api.setProvider(id);
      models = [];
      await chat.refresh();
    } catch (e) {
      notice = String(e);
    }
  }

  async function fetchModels() {
    loadingModels = true;
    notice = "";
    try {
      models = await api.listModels();
    } catch (e) {
      notice = String(e);
    } finally {
      loadingModels = false;
    }
  }

  async function pickModel(model: string) {
    await api.setModel(model);
    models = [];
    await chat.refresh();
  }

  async function updateSetting(field: string, value: string) {
    try {
      await api.setSetting(field, value);
      notice = field === "fontSize" ? "Applies after restart." : "Saved.";
      await chat.refresh();
    } catch (e) {
      notice = String(e);
    }
  }

  const LANGUAGES = [
    ["en", "English"],
    ["tr", "Türkçe"],
    ["de", "Deutsch"],
    ["fr", "Français"],
    ["es", "Español"],
  ];

  const WINDOW_MODES = ["windowed", "borderless", "fullscreen"];
</script>

<div class="panel">
  <header>
    <span class="title">{chat.panel}</span>
    <button class="close" onclick={() => (chat.panel = "none")}>✕</button>
  </header>

  {#if notice}
    <div class="notice">{notice}</div>
  {/if}

  <div class="content">
    {#if chat.panel === "settings"}
      <div class="panel-title">PROVIDER</div>
      <div class="chips">
        {#each status?.providers ?? [] as p}
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

      <div class="panel-title">MODEL</div>
      <div class="current">{status?.model ?? "—"}</div>
      <button onclick={fetchModels} disabled={loadingModels}>
        {loadingModels ? "loading…" : "list models"}
      </button>
      {#if models.length}
        <div class="list scroll">
          {#each models as m}
            <button class="row" onclick={() => pickModel(m)}>{m}</button>
          {/each}
        </div>
      {/if}

      <div class="panel-title">API KEY</div>
      <select bind:value={keyProvider}>
        {#each status?.providers ?? [] as p}
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
      />
      <button class="primary" onclick={saveKey}>save key</button>
      <p class="hint">Stored encrypted with Windows DPAPI. Never displayed.</p>

      <div class="panel-title">INTERFACE</div>
      <label>
        language
        <select
          value={status?.language ?? "en"}
          onchange={(e) => updateSetting("language", e.currentTarget.value)}
        >
          {#each LANGUAGES as [code, name]}
            <option value={code}>{name}</option>
          {/each}
        </select>
      </label>

      <label>
        window
        <select
          value={status?.windowMode ?? "windowed"}
          onchange={(e) => updateSetting("windowMode", e.currentTarget.value)}
        >
          {#each WINDOW_MODES as mode}
            <option value={mode}>{mode}</option>
          {/each}
        </select>
      </label>

      <label>
        font size
        <input
          type="number"
          min="8"
          max="32"
          value={status?.fontSize ?? 14}
          onchange={(e) => updateSetting("fontSize", e.currentTarget.value)}
        />
      </label>

      <div class="panel-title">DATA</div>
      <p class="path selectable">{status?.dataDir ?? ""}</p>
    {:else if chat.panel === "memory"}
      {#if facts.length === 0}
        <p class="empty">Nothing remembered yet. Try "remember that I…"</p>
      {:else}
        <div class="list scroll">
          {#each facts as fact}
            <div class="entry">
              <span class="entry-text selectable">{fact.text}</span>
              <button
                class="danger tiny"
                onclick={async () => {
                  await api.forgetFact(fact.id);
                  await load();
                  await chat.refresh();
                }}>forget</button
              >
            </div>
          {/each}
        </div>
      {/if}
    {:else if chat.panel === "automations"}
      {#if automations.length === 0}
        <p class="empty">
          None set. Try "every morning at 09:00 tell me the weather".
        </p>
      {:else}
        <div class="list scroll">
          {#each automations as a}
            <div class="entry" class:off={!a.enabled}>
              <div class="entry-main">
                <span class="trigger">{a.trigger}</span>
                <span class="entry-text selectable">{a.prompt}</span>
              </div>
              <div class="entry-actions">
                <button
                  class="tiny"
                  onclick={async () => {
                    await api.toggleAutomation(a.id, !a.enabled);
                    await load();
                  }}>{a.enabled ? "pause" : "resume"}</button
                >
                <button
                  class="danger tiny"
                  onclick={async () => {
                    await api.deleteAutomation(a.id);
                    await load();
                    await chat.refresh();
                  }}>delete</button
                >
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else if chat.panel === "tools"}
      <p class="hint">
        {tools.length} tools. At most 12 reach the model per request —
        selected by domain.
      </p>
      <div class="list scroll">
        {#each tools as tool}
          <div class="entry tool-entry">
            <div class="entry-main">
              <span class="tool-name">
                {tool.name}
                <span class="risk" data-risk={tool.risk}>{tool.risk}</span>
              </span>
              <span class="tool-desc">{tool.description}</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: var(--sp-2);
    min-height: 0;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--sp-2);
    border-bottom: 1px solid var(--border);
  }

  .title {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--cyan);
  }

  .close {
    border: none;
    padding: 2px 6px;
    font-size: var(--text-sm);
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    overflow-y: auto;
    min-height: 0;
    flex: 1;
  }

  .content :global(.panel-title) {
    margin-top: var(--sp-3);
  }
  .content :global(.panel-title:first-child) {
    margin-top: 0;
  }

  .notice {
    font-size: var(--text-xs);
    color: var(--cyan);
    background: rgba(34, 211, 238, 0.08);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--sp-1) var(--sp-2);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1);
  }

  .chip {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    padding: 2px 7px;
  }
  .chip.active {
    color: var(--cyan-bright);
    border-color: var(--cyan);
    background: var(--bg-hover);
  }
  /* A provider with no key is still selectable — it just says so. */
  .chip.missing {
    opacity: 0.45;
  }

  .current {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--fg);
    word-break: break-all;
  }

  select,
  input {
    background: var(--bg-code);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--sp-1) var(--sp-2);
    font-size: var(--text-sm);
    color: var(--fg);
  }
  select:focus,
  input:focus {
    border-color: var(--cyan-dim);
  }

  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    font-size: var(--text-sm);
    color: var(--fg-dim);
  }
  label select,
  label input {
    width: 105px;
    flex: 0 0 auto;
  }

  .hint,
  .empty {
    font-size: var(--text-xs);
    color: var(--fg-faint);
    line-height: 1.5;
  }

  .path {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--fg-dim);
    word-break: break-all;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }

  .scroll {
    max-height: 260px;
    overflow-y: auto;
  }

  .row {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-align: left;
    padding: 3px var(--sp-2);
    border-color: transparent;
    word-break: break-all;
  }
  .row:hover {
    border-color: var(--cyan-dim);
  }

  .entry {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-2);
    padding: var(--sp-2);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: var(--text-xs);
  }
  .entry.off {
    opacity: 0.5;
  }

  .entry-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .entry-text {
    color: var(--fg);
    word-break: break-word;
  }

  .entry-actions {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .trigger {
    font-family: var(--font-mono);
    color: var(--cyan);
    font-size: 10px;
  }

  .tiny {
    font-size: 10px;
    padding: 1px 5px;
  }

  .tool-entry {
    flex-direction: column;
  }

  .tool-name {
    font-family: var(--font-mono);
    color: var(--cyan-bright);
    display: flex;
    align-items: center;
    gap: var(--sp-1);
  }

  .tool-desc {
    color: var(--fg-dim);
    line-height: 1.4;
  }

  .risk {
    font-size: 9px;
    padding: 0 4px;
    border-radius: 2px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .risk[data-risk="safe"] {
    color: var(--green);
    background: rgba(74, 222, 128, 0.12);
  }
  .risk[data-risk="moderate"] {
    color: var(--amber);
    background: rgba(245, 158, 11, 0.12);
  }
  .risk[data-risk="destructive"] {
    color: var(--red);
    background: rgba(248, 113, 113, 0.12);
  }
</style>

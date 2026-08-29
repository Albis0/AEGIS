<!--
  The panels behind the right rail: memory, automations, tools.

  These three belong in the rail because they are read next to a conversation
  — "what does it remember", "what fires when", "what can it do". Settings
  used to live here too and outgrew it: fourteen categories in a 260-pixel
  column was a scroll nobody finished. It is its own window now, in
  Settings.svelte.
-->
<script lang="ts">
  import { api, type Automation, type Fact, type Tool } from "./api";
  import { chat } from "./store.svelte";

  let facts = $state<Fact[]>([]);
  let automations = $state<Automation[]>([]);
  let tools = $state<Tool[]>([]);
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
    {#if chat.panel === "memory"}
      {#if facts.length === 0}
        <p class="empty">Nothing remembered yet. Try "remember that I…"</p>
      {:else}
        <div class="list scroll">
          {#each facts as fact (fact.id)}
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
          {#each automations as a (a.id)}
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
        {#each tools as tool (tool.name)}
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

  .notice {
    font-size: var(--text-xs);
    color: var(--cyan);
    background: rgba(34, 211, 238, 0.08);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--sp-1) var(--sp-2);
  }

  .hint,
  .empty {
    font-size: var(--text-xs);
    color: var(--fg-faint);
    line-height: 1.5;
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

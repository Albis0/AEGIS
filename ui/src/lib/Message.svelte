<!--
  One line in the conversation.

  User and assistant turns get a card; system, tool and error lines stay
  unframed so they read as margin notes rather than interrupting the
  thread.
-->
<script lang="ts">
  import { renderMarkdown } from "./markdown";
  import type { Message } from "./store.svelte";
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";

  const { message }: { message: Message } = $props();

  const framed = $derived(
    message.speaker === "user" || message.speaker === "assistant",
  );

  // Only assistant replies contain markdown. Rendering user input as
  // markdown would mangle anything they paste.
  const html = $derived(
    message.speaker === "assistant" ? renderMarkdown(message.text) : "",
  );

  /**
   * Copy buttons live inside rendered markdown, so they cannot have Svelte
   * handlers. One delegated listener on the container handles them all.
   */
  function handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.classList.contains("copy")) return;

    const code = decodeURIComponent(target.dataset.code ?? "");
    void writeText(code);

    const original = target.textContent;
    target.textContent = "copied";
    setTimeout(() => (target.textContent = original), 1200);
  }
</script>

{#if framed}
  <div class="msg card {message.speaker}" class:streaming={message.streaming}>
    <span class="mark">{message.speaker === "user" ? "❯" : "◆"}</span>
    <div class="body selectable">
      {#if message.speaker === "assistant"}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="md" onclick={handleClick} role="presentation">
          {@html html}
        </div>
        {#if message.streaming}
          <span class="caret"></span>
        {/if}
      {:else}
        {message.text}
      {/if}
    </div>
  </div>
{:else}
  <div class="msg note {message.speaker}">
    <span class="mark">
      {#if message.speaker === "tool"}
        {message.ok === false ? "✗" : "⚙"}
      {:else if message.speaker === "error"}
        ✗
      {:else}
        ·
      {/if}
    </span>
    <span class="text selectable">{message.text}</span>
  </div>
{/if}

<style>
  .msg {
    display: flex;
    gap: var(--sp-2);
    animation: fade-up var(--normal) var(--ease);
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--sp-3) var(--sp-4);
    margin: var(--sp-2) 0;
  }

  .card.user {
    border-color: rgba(14, 116, 144, 0.6);
    background: linear-gradient(
      180deg,
      rgba(34, 211, 238, 0.04),
      var(--bg-card)
    );
  }

  .card.streaming {
    border-color: rgba(34, 211, 238, 0.35);
  }

  .mark {
    flex: 0 0 auto;
    font-family: var(--font-mono);
    line-height: 1.55;
  }

  .card.user .mark {
    color: var(--cyan-bright);
  }
  .card.assistant .mark {
    color: var(--blue);
  }

  .body {
    flex: 1;
    min-width: 0; /* lets long code blocks scroll instead of stretching */
  }

  .note {
    padding: 2px var(--sp-2);
    font-size: var(--text-sm);
    color: var(--fg-dim);
    align-items: baseline;
  }

  .note .mark {
    font-size: var(--text-xs);
    opacity: 0.7;
  }

  .note.tool .mark {
    color: var(--amber);
  }
  .note.error {
    color: var(--red);
  }
  .note.error .mark {
    color: var(--red);
  }

  .note .text {
    word-break: break-word;
  }

  /* Blinking caret while the reply streams in. */
  .caret {
    display: inline-block;
    width: 7px;
    height: 15px;
    margin-left: 2px;
    background: var(--cyan);
    vertical-align: text-bottom;
    animation: pulse 1s steps(2) infinite;
  }

  /* ── Rendered markdown ─────────────────────────────────────────── */

  .md :global(p) {
    margin: var(--sp-2) 0;
  }
  .md :global(p:first-child) {
    margin-top: 0;
  }
  .md :global(p:last-child) {
    margin-bottom: 0;
  }

  .md :global(h1),
  .md :global(h2),
  .md :global(h3),
  .md :global(h4) {
    color: var(--cyan-bright);
    margin: var(--sp-4) 0 var(--sp-2);
    font-weight: 600;
  }
  .md :global(h1) {
    font-size: var(--text-xl);
  }
  .md :global(h2) {
    font-size: var(--text-lg);
  }
  .md :global(h3),
  .md :global(h4) {
    font-size: var(--text-base);
  }

  .md :global(ul),
  .md :global(ol) {
    margin: var(--sp-2) 0;
    padding-left: var(--sp-5);
  }
  .md :global(li) {
    margin: var(--sp-1) 0;
  }
  .md :global(li::marker) {
    color: var(--cyan-dim);
  }

  .md :global(strong) {
    color: #fff;
    font-weight: 600;
  }
  .md :global(em) {
    color: var(--cyan-bright);
    font-style: italic;
  }

  .md :global(code.inline) {
    font-family: var(--font-mono);
    font-size: 0.9em;
    background: var(--bg-code);
    color: var(--cyan-bright);
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid var(--border);
  }

  .md :global(blockquote) {
    border-left: 2px solid var(--cyan-dim);
    padding-left: var(--sp-3);
    margin: var(--sp-2) 0;
    color: var(--fg-dim);
    font-style: italic;
  }

  .md :global(hr) {
    border: none;
    border-top: 1px solid var(--border);
    margin: var(--sp-4) 0;
  }

  .md :global(.code-block) {
    background: var(--bg-code);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin: var(--sp-3) 0;
    overflow: hidden;
  }

  .md :global(.code-head) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-1) var(--sp-2);
    border-bottom: 1px solid var(--border);
    background: rgba(0, 0, 0, 0.25);
  }

  .md :global(.code-head .lang) {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--fg-dim);
    letter-spacing: 0.05em;
  }

  .md :global(.copy) {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--fg-dim);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 1px 6px;
    cursor: pointer;
    margin-left: auto;
  }
  .md :global(.copy:hover) {
    color: var(--cyan-bright);
    border-color: var(--cyan-dim);
  }

  .md :global(pre) {
    margin: 0;
    padding: var(--sp-3);
    overflow-x: auto;
  }

  .md :global(pre code) {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: 1.6;
    color: var(--fg);
  }

  .md :global(.table-wrap) {
    overflow-x: auto;
    margin: var(--sp-3) 0;
  }

  .md :global(table) {
    border-collapse: collapse;
    font-size: var(--text-sm);
    width: 100%;
  }

  .md :global(th),
  .md :global(td) {
    border: 1px solid var(--border);
    padding: var(--sp-1) var(--sp-3);
    text-align: left;
  }

  .md :global(th) {
    color: var(--cyan);
    font-weight: 600;
    background: rgba(34, 211, 238, 0.05);
  }
</style>

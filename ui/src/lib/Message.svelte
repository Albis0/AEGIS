<!--
  One turn in the conversation.

  The three kinds of line are told apart by shape before colour:

    - The user gets a filled bubble, right-aligned and inset. What you said
      is findable by scanning the right edge alone.
    - The assistant gets plain text at full width, no bubble. Long replies
      in a bubble get a ragged right edge and turn into a wall; unframed
      prose is what every tool that handles long answers well does.
    - Tool calls, notices and errors are small unframed notes. They are
      margin annotations, and should not interrupt the thread.

  A permission request is the exception and does get a card, because it is
  the one thing here that has to be answered. It stays in the feed rather
  than becoming a modal: a modal takes the keyboard away from whatever was
  being typed, every single time.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { renderMarkdown } from "./markdown";
  import { chat, type Message } from "./store.svelte";
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";

  const { message }: { message: Message } = $props();

  let expanded = $state(false);
  let copied = $state(false);

  /** Whether this tool line has anything behind it worth opening. */
  const openable = $derived(
    message.speaker === "tool" &&
      Boolean(message.args?.trim() || message.detail?.trim()),
  );

  /** True while this request is the one the agent is waiting on. */
  const awaiting = $derived(
    message.speaker === "approval" &&
      !message.decision &&
      chat.approval?.messageId === message.id,
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

  async function copyMessage() {
    await writeText(message.text);
    copied = true;
    setTimeout(() => (copied = false), 1400);
  }
</script>

{#if message.speaker === "user"}
  <div class="row user">
    <div class="bubble selectable">{message.text}</div>
  </div>
{:else if message.speaker === "assistant"}
  <div class="row assistant">
    <div class="reply selectable">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <div class="md" onclick={handleClick} role="presentation">
        {@html html}
      </div>
      {#if message.streaming}
        <span class="caret"></span>
      {/if}
    </div>

    <!-- Actions appear on hover. Always-visible buttons under every reply
         are clutter on the 90% of turns nobody copies. -->
    {#if !message.streaming}
      <div class="actions">
        <button class="ghost-action" onclick={copyMessage} title="Copy">
          <Icon name={copied ? "check" : "copy"} size={14} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    {/if}
  </div>
{:else if message.speaker === "approval"}
  <div class="approval" class:answered={message.decision}>
    <div class="approval-head">
      <span class="approval-icon"><Icon name="warning" size={16} /></span>
      <span class="tool-name">{message.text}</span>
      {#if message.decision}
        <span class="decided" data-decision={message.decision}>
          {message.decision === "deny" ? "Denied" : message.decision}
        </span>
      {/if}
    </div>

    <p class="why">
      {message.reason === "budget"
        ? "Several destructive actions have already run in this turn."
        : "This action cannot be undone."}
    </p>

    <pre class="args selectable">{message.args ?? ""}</pre>

    {#if awaiting}
      <div class="approval-actions">
        <button class="primary" onclick={() => chat.answerApproval("allow")}>
          Allow
        </button>
        <button class="outline" onclick={() => chat.answerApproval("always")}>
          Always allow
        </button>
        <button class="danger" onclick={() => chat.answerApproval("deny")}>
          Deny
        </button>
      </div>
    {/if}
  </div>
{:else}
  <div class="note {message.speaker}">
    {#if openable}
      <button class="note-line" onclick={() => (expanded = !expanded)}>
        <span class="chev" class:open={expanded}>
          <Icon name="chevronRight" size={12} />
        </span>
        <Icon name="tool" size={13} />
        <span class="note-text">{message.text}</span>
      </button>
    {:else}
      <span class="note-line static">
        {#if message.speaker === "tool"}
          <Icon name="tool" size={13} />
        {:else if message.speaker === "error"}
          <Icon name="warning" size={13} />
        {:else}
          <Icon name="info" size={13} />
        {/if}
        <span class="note-text selectable">{message.text}</span>
      </span>
    {/if}

    {#if openable && expanded}
      <div class="detail">
        {#if message.args?.trim()}
          <div class="detail-label">Called with</div>
          <pre class="selectable">{message.args}</pre>
        {/if}
        {#if message.detail?.trim()}
          <div class="detail-label">Returned</div>
          <pre class="selectable">{message.detail}</pre>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .row {
    display: flex;
    flex-direction: column;
    animation: fade-up var(--normal) var(--ease);
    margin: var(--sp-4) 0;
  }

  /* -- User --------------------------------------------------------- */

  .row.user {
    align-items: flex-end;
  }

  .bubble {
    background: var(--accent);
    color: #fff;
    padding: var(--sp-2) var(--sp-4);
    /* The squared-off bottom-right corner points the bubble at its author,
       the way every messaging app does it. */
    border-radius: var(--r-lg) var(--r-lg) var(--r-sm) var(--r-lg);
    /* Never the full width: a bubble edge-to-edge stops reading as one
       side of a conversation. */
    max-width: 84%;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.55;
  }

  /* -- Assistant ---------------------------------------------------- */

  .row.assistant {
    align-items: stretch;
  }

  .reply {
    color: var(--text);
    min-width: 0;
  }

  .actions {
    display: flex;
    gap: var(--sp-1);
    margin-top: var(--sp-1);
    opacity: 0;
    transition: opacity var(--fast) var(--ease);
  }
  .row.assistant:hover .actions,
  .actions:focus-within {
    opacity: 1;
  }

  .ghost-action {
    font-size: var(--text-xs);
    color: var(--text-faint);
    padding: var(--sp-1) var(--sp-2);
  }

  /* The streaming caret: a block that blinks where the text will continue. */
  .caret {
    display: inline-block;
    width: 7px;
    height: 1em;
    vertical-align: text-bottom;
    background: var(--accent);
    border-radius: 1px;
    margin-left: 2px;
    animation: pulse 1s steps(2, start) infinite;
  }

  /* -- Notes -------------------------------------------------------- */

  .note {
    margin: var(--sp-2) 0;
    animation: fade-in var(--normal) var(--ease);
  }

  .note-line {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--text-sm);
    color: var(--text-faint);
    padding: var(--sp-1) var(--sp-2);
    width: 100%;
    text-align: left;
    border-radius: var(--r-sm);
  }
  .note-line.static {
    cursor: default;
  }
  button.note-line:hover {
    color: var(--text-muted);
    background: var(--surface-hover);
  }

  .note-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .note.error .note-line {
    color: var(--danger);
  }

  .chev {
    display: flex;
    transition: transform var(--fast) var(--ease);
  }
  .chev.open {
    transform: rotate(90deg);
  }

  .detail {
    margin: var(--sp-1) 0 var(--sp-2) var(--sp-5);
    padding: var(--sp-3);
    background: var(--surface-sunken);
    border-radius: var(--r-md);
    animation: fade-up var(--fast) var(--ease);
  }

  .detail-label {
    font-size: var(--text-xs);
    color: var(--text-faint);
    margin-bottom: var(--sp-1);
  }
  .detail-label:not(:first-child) {
    margin-top: var(--sp-3);
  }

  .detail pre {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-muted);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 260px;
    overflow-y: auto;
    line-height: 1.5;
  }

  /* -- Approval ----------------------------------------------------- */

  .approval {
    margin: var(--sp-4) 0;
    padding: var(--sp-4);
    background: var(--surface-raised);
    border: 1px solid var(--line-strong);
    border-left: 3px solid var(--warning);
    border-radius: var(--r-md);
    animation: fade-up var(--normal) var(--ease);
  }
  .approval.answered {
    opacity: 0.55;
    border-left-color: var(--line-strong);
  }

  .approval-head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  .approval-icon {
    display: flex;
    color: var(--warning);
  }

  .tool-name {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--text);
  }

  .decided {
    margin-left: auto;
    font-size: var(--text-xs);
    text-transform: capitalize;
    color: var(--text-faint);
  }
  .decided[data-decision="deny"] {
    color: var(--danger);
  }
  .decided[data-decision="allow"],
  .decided[data-decision="always"] {
    color: var(--success);
  }

  .why {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin: var(--sp-2) 0;
  }

  .args {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-muted);
    background: var(--surface-sunken);
    border-radius: var(--r-sm);
    padding: var(--sp-2);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 180px;
    overflow-y: auto;
  }

  .approval-actions {
    display: flex;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
  }

  /* -- Rendered markdown -------------------------------------------- */
  /* Global: this markup comes from `renderMarkdown`, so Svelte cannot
     scope these rules. */

  .md :global(p) {
    margin: 0 0 var(--sp-3);
  }
  .md :global(p:last-child) {
    margin-bottom: 0;
  }

  .md :global(h1),
  .md :global(h2),
  .md :global(h3) {
    font-size: var(--text-md);
    font-weight: 600;
    margin: var(--sp-4) 0 var(--sp-2);
    line-height: 1.4;
  }
  .md :global(h1:first-child),
  .md :global(h2:first-child),
  .md :global(h3:first-child) {
    margin-top: 0;
  }

  .md :global(ul),
  .md :global(ol) {
    margin: 0 0 var(--sp-3);
    padding-left: var(--sp-5);
  }
  .md :global(li) {
    margin-bottom: var(--sp-1);
  }

  .md :global(a) {
    color: var(--accent-text);
    text-decoration: none;
    border-bottom: 1px solid var(--accent-line);
  }
  .md :global(a:hover) {
    border-bottom-color: var(--accent);
  }

  .md :global(code) {
    font-family: var(--font-mono);
    font-size: 0.9em;
    background: var(--surface-sunken);
    border-radius: var(--r-sm);
    padding: 1px 5px;
  }

  .md :global(pre) {
    background: var(--surface-sunken);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: var(--sp-3);
    overflow-x: auto;
    margin: 0 0 var(--sp-3);
    position: relative;
  }
  .md :global(pre code) {
    background: none;
    padding: 0;
    font-size: var(--text-sm);
    line-height: 1.6;
  }

  .md :global(.copy) {
    position: absolute;
    top: var(--sp-2);
    right: var(--sp-2);
    font-size: var(--text-xs);
    color: var(--text-faint);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    padding: 2px 8px;
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--fast) var(--ease);
  }
  .md :global(pre:hover .copy) {
    opacity: 1;
  }
  .md :global(.copy:hover) {
    color: var(--text);
    border-color: var(--line-strong);
  }

  .md :global(blockquote) {
    border-left: 2px solid var(--line-strong);
    padding-left: var(--sp-3);
    color: var(--text-muted);
    margin: 0 0 var(--sp-3);
  }

  .md :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: var(--sp-3);
    font-size: var(--text-sm);
  }
  .md :global(th),
  .md :global(td) {
    border: 1px solid var(--line);
    padding: var(--sp-1) var(--sp-2);
    text-align: left;
  }
  .md :global(th) {
    background: var(--surface-sunken);
    font-weight: 600;
  }
</style>

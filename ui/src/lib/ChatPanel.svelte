<!--
  The chat panel.

  A narrow column docked to the right of the stage, resizable by its left
  edge and dismissible with a keystroke. Everything else in the window is
  the reactor and empty space, so this is the only piece of chrome the user
  works in and it has to earn the room it takes.

  Width is persisted, so the panel comes back the size it was left. A panel
  that resets to a default every launch is one the user has to re-drag every
  launch, which is exactly the sort of friction the brief rules out.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import Message from "./Message.svelte";
  import { chat } from "./store.svelte";

  interface Props {
    /** Collapses the panel. The stage keeps the shortcut to bring it back. */
    onClose: () => void;
  }

  const { onClose }: Props = $props();

  /** Bounds for the drag. Below the minimum the composer stops being usable;
      above the maximum the reactor is squeezed off centre. */
  const MIN_WIDTH = 320;
  const MAX_WIDTH = 720;
  const DEFAULT_WIDTH = 400;
  const WIDTH_KEY = "vavis.chat.width";

  let width = $state(DEFAULT_WIDTH);
  let dragging = $state(false);

  let feedEl = $state<HTMLElement | null>(null);
  let inputEl = $state<HTMLTextAreaElement | null>(null);
  let atBottom = $state(true);

  const status = $derived(chat.status);

  onMount(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(saved) && saved >= MIN_WIDTH && saved <= MAX_WIDTH) {
      width = saved;
    }
    inputEl?.focus();
  });

  /**
   * Follows the conversation as it grows -- but only when the user is
   * already at the bottom. Yanking the view while they read back is the
   * fastest way to make a chat feel hostile.
   */
  $effect(() => {
    void chat.messages.length;
    void chat.messages[chat.messages.length - 1]?.text;

    if (atBottom && feedEl) {
      queueMicrotask(() =>
        feedEl?.scrollTo({ top: feedEl.scrollHeight, behavior: "smooth" }),
      );
    }
  });

  function trackScroll() {
    if (!feedEl) return;
    const slack = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight;
    atBottom = slack < 80;
  }

  // -- Resize -----------------------------------------------------------

  function startResize(event: PointerEvent) {
    event.preventDefault();
    dragging = true;

    // Pointer capture keeps the drag alive when the cursor outruns the
    // handle, which it always does on a fast throw.
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startWidth = width;

    function move(e: PointerEvent) {
      // Dragging left widens: the panel is anchored to the right edge.
      const next = startWidth - (e.clientX - startX);
      width = Math.min(Math.max(next, MIN_WIDTH), MAX_WIDTH);
    }

    function end() {
      dragging = false;
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      localStorage.setItem(WIDTH_KEY, String(Math.round(width)));
    }

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  /** Double-click on the handle restores the default width. */
  function resetWidth() {
    width = DEFAULT_WIDTH;
    localStorage.setItem(WIDTH_KEY, String(DEFAULT_WIDTH));
  }

  // -- Composer ---------------------------------------------------------

  function submit() {
    void chat.send(chat.input);
    if (inputEl) inputEl.style.height = "auto";
  }

  function onKeydown(event: KeyboardEvent) {
    // Enter sends; Shift+Enter writes a newline. Multi-line input matters
    // when pasting code or a log.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  /** Grows the input up to a limit, then scrolls inside itself. */
  function autoGrow() {
    if (!inputEl) return;
    inputEl.style.height = "auto";
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 200)}px`;
  }

  /** Focused by the stage when the panel is opened by shortcut. */
  export function focus() {
    inputEl?.focus();
  }
</script>

<aside class="panel" style:width="{width}px" class:dragging>
  <!-- Resize handle. Wider than it looks: a 1px target is a target you
       miss, so the hit area is 9px and only the line inside it is drawn. -->
  <div
    class="handle"
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize chat panel"
    tabindex="-1"
    onpointerdown={startResize}
    ondblclick={resetWidth}
  >
    <span class="handle-line"></span>
  </div>

  <header>
    <div class="title">
      <span class="dot" data-state={chat.coreState}></span>
      <span class="name">{status?.assistantName || "Vavis"}</span>
    </div>

    <div class="header-actions">
      <button
        class="icon-btn"
        title="New conversation (Ctrl+L)"
        onclick={() => chat.clear()}
      >
        <Icon name="plus" size={16} />
      </button>
      <button class="icon-btn" title="Hide panel (Ctrl+B)" onclick={onClose}>
        <Icon name="panelRight" size={16} />
      </button>
    </div>
  </header>

  <div class="feed" bind:this={feedEl} onscroll={trackScroll}>
    {#if chat.messages.length === 0}
      <div class="empty">
        <p class="empty-title">
          {status?.keys.length ? "What can I do?" : "Add a key to start"}
        </p>
        <p class="empty-sub">
          {status?.keys.length
            ? "Ask a question, or tell me to do something on this machine."
            : "Open settings and add an API key for any provider."}
        </p>
      </div>
    {/if}

    {#each chat.messages as message (message.id)}
      <Message {message} />
    {/each}

    <!-- The running tool, shown live rather than only once it finishes.
         A long tool call with no indication it is running looks like a
         hang. -->
    {#if chat.runningTool}
      <div class="running">
        <span class="spinner"></span>
        <span>{chat.runningTool}</span>
      </div>
    {/if}
  </div>

  {#if !atBottom}
    <button
      class="jump"
      onclick={() => {
        atBottom = true;
        feedEl?.scrollTo({ top: feedEl.scrollHeight, behavior: "smooth" });
      }}
    >
      <Icon name="arrowDown" size={13} />
      Latest
    </button>
  {/if}

  <div class="composer">
    <div class="input-wrap" class:busy={status?.busy}>
      <textarea
        bind:this={inputEl}
        bind:value={chat.input}
        onkeydown={onKeydown}
        oninput={autoGrow}
        placeholder={status?.busy ? "Working…" : "Message Vavis…"}
        rows="1"
        spellcheck="false"
      ></textarea>

      <div class="tools">
        <!-- Voice is a primary way to use this, so the microphone sits in
             the composer at the same weight as send rather than being
             tucked into a corner. The ring around it is the live level:
             it answers "is it hearing me" while you are still talking,
             which no amount of status text does. -->
        <button
          class="icon-btn mic"
          data-mode={status?.voiceMode ?? "off"}
          style:--level={Math.min(chat.micLevel, 1)}
          onclick={() => chat.cycleVoice()}
          title="Voice: {status?.voiceMode ?? 'off'} — click to cycle (Ctrl+M)"
        >
          <Icon
            name={status?.voiceMode === "off" ? "micOff" : "mic"}
            size={16}
          />
        </button>

        {#if status?.speaking}
          <button
            class="icon-btn"
            title="Stop speaking (Esc)"
            onclick={() => chat.stopSpeaking()}
          >
            <Icon name="stop" size={16} />
          </button>
        {/if}

        <button
          class="icon-btn send"
          onclick={submit}
          disabled={!chat.input.trim() || status?.busy}
          title="Send (Enter)"
        >
          <Icon name="send" size={16} />
        </button>
      </div>
    </div>
  </div>
</aside>

<style>
  .panel {
    position: relative;
    flex: 0 0 auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--surface);
    border-left: 1px solid var(--line);
    /* The panel floats over the stage, so it casts a shadow leftward onto
       the reactor rather than sitting flush against it. */
    box-shadow: var(--shadow-lg);
  }
  /* No width transition while dragging -- easing a value the pointer is
     already driving makes the edge lag behind the cursor. */
  .panel:not(.dragging) {
    transition: width var(--fast) var(--ease);
  }

  /* -- Resize handle ------------------------------------------------- */

  .handle {
    position: absolute;
    left: -4px;
    top: 0;
    bottom: 0;
    width: 9px;
    cursor: col-resize;
    z-index: 3;
    display: flex;
    justify-content: center;
  }

  .handle-line {
    width: 2px;
    height: 100%;
    background: transparent;
    transition: background var(--fast) var(--ease);
  }
  .handle:hover .handle-line,
  .panel.dragging .handle-line {
    background: var(--accent);
  }

  /* -- Header -------------------------------------------------------- */

  header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-4);
    border-bottom: 1px solid var(--line);
  }

  .title {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-width: 0;
  }

  .name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* A single dot carries the assistant's state in the panel, so the state
     is legible even when the reactor is covered. */
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: 0 0 auto;
    background: var(--text-faint);
    transition: background var(--normal) var(--ease);
  }
  .dot[data-state="listening"] {
    background: var(--accent);
    animation: pulse 2s ease-in-out infinite;
  }
  .dot[data-state="thinking"] {
    background: var(--warning);
    animation: pulse 1.1s ease-in-out infinite;
  }
  .dot[data-state="working"] {
    background: #a78bfa;
    animation: pulse 1.4s ease-in-out infinite;
  }
  .dot[data-state="speaking"] {
    background: var(--accent);
  }

  .header-actions {
    display: flex;
    gap: 2px;
  }

  .icon-btn {
    padding: var(--sp-2);
    border-radius: var(--r-sm);
    color: var(--text-faint);
  }
  .icon-btn:hover:not(:disabled) {
    color: var(--text);
  }

  /* -- Feed ---------------------------------------------------------- */

  .feed {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--sp-4);
    min-height: 0;
  }

  .empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--sp-5);
    gap: var(--sp-2);
  }

  .empty-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--text);
  }

  .empty-sub {
    font-size: var(--text-sm);
    color: var(--text-faint);
    max-width: 30ch;
    line-height: 1.5;
  }

  .running {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--text-sm);
    font-family: var(--font-mono);
    color: var(--text-faint);
    padding: var(--sp-1) var(--sp-2);
    animation: fade-in var(--normal) var(--ease);
  }

  .spinner {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 1.6px solid var(--line-strong);
    border-top-color: var(--accent);
    animation: spin 0.7s linear infinite;
    flex: 0 0 auto;
  }

  .jump {
    position: absolute;
    bottom: 92px;
    left: 50%;
    transform: translateX(-50%);
    font-size: var(--text-xs);
    background: var(--surface-raised);
    border: 1px solid var(--line-strong);
    box-shadow: var(--shadow-md);
    border-radius: var(--r-full);
    padding: var(--sp-1) var(--sp-3);
    z-index: 2;
    animation: fade-up var(--fast) var(--ease);
  }

  /* -- Composer ------------------------------------------------------ */

  .composer {
    flex: 0 0 auto;
    padding: var(--sp-3);
  }

  .input-wrap {
    background: var(--surface-sunken);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    padding: var(--sp-2) var(--sp-2) var(--sp-1) var(--sp-3);
    transition:
      border-color var(--fast) var(--ease),
      box-shadow var(--fast) var(--ease);
  }
  .input-wrap:focus-within {
    border-color: var(--accent-line);
    box-shadow: 0 0 0 3px var(--accent-muted);
  }

  textarea {
    resize: none;
    line-height: 1.55;
    max-height: 200px;
    padding: var(--sp-1) 0;
    font-size: var(--text-base);
  }

  /* The wrapper already draws a focus ring around the whole composer, so the
     global outline on the textarea inside it would be a second ring nested
     in the first. */
  textarea:focus-visible {
    outline: none;
  }

  .tools {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
  }

  /* The microphone's live level is a ring that grows out of the button,
     drawn with a box-shadow so it costs no layout. */
  .mic {
    position: relative;
  }
  .mic[data-mode="continuous"] {
    color: var(--accent);
  }
  .mic[data-mode="wake"] {
    color: var(--text-muted);
  }
  .mic[data-mode="continuous"]::after {
    content: "";
    position: absolute;
    inset: 2px;
    border-radius: 50%;
    box-shadow: 0 0 0 calc(var(--level, 0) * 7px) var(--accent-muted);
    transition: box-shadow 80ms linear;
    pointer-events: none;
  }

  .send:not(:disabled) {
    color: var(--accent);
  }
  .send:not(:disabled):hover {
    background: var(--accent-muted);
    color: var(--accent);
  }
</style>

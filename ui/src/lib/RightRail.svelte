<!--
  Right rail: the core, shortcuts, and whichever panel is open.

  The core sits here rather than in the middle so it stays visible while
  the conversation scrolls — state should never be more than a glance away.
-->
<script lang="ts">
  import Core from "./Core.svelte";
  import Panels from "./Panels.svelte";
  import SpotifyPanel from "./SpotifyPanel.svelte";
  import { chat } from "./store.svelte";

  const status = $derived(chat.status);

  const SHORTCUTS: [string, string][] = [
    ["Esc", "stop speech"],
    ["Ctrl+M", "voice mode"],
    ["Ctrl+L", "clear"],
    ["Ctrl+,", "settings"],
    ["F11", "window mode"],
  ];
</script>

<aside class="rail">
  <!-- Settings is a window of its own, not a rail panel, so the rail keeps
       showing the core while it is open. -->
  {#if chat.panel === "none" || chat.panel === "settings"}
    <div class="core-area">
      <Core state={chat.coreState} size={150} />
      <div class="state-label">{chat.coreState}</div>
    </div>

    {#if chat.runningTool}
      <section class="running">
        <div class="panel-title">RUNNING</div>
        <div class="tool-name">{chat.runningTool}</div>
      </section>
    {/if}

    <!-- Music, when something is playing. Hides itself otherwise. -->
    <SpotifyPanel />

    <!--
      Now playing, deliberately smaller than a music panel would be: you do
      not steer a game from a chat window. Its whole job is context, so it is
      one line and disappears when the process does.
    -->
    {#if status?.steamGame}
      <section class="playing">
        <span class="dot"></span>
        <span class="game">{status.steamGame}</span>
      </section>
    {/if}

    <section>
      <div class="panel-title">KEYS</div>
      {#each SHORTCUTS as [key, action]}
        <div class="shortcut">
          <kbd>{key}</kbd>
          <span>{action}</span>
        </div>
      {/each}
    </section>

    <div class="spacer"></div>

    <div class="version">
      v{status?.version ?? "—"}
    </div>
  {:else}
    <Panels />
  {/if}
</aside>

<style>
  /* Now playing: one line, no controls, no artwork. */
  .playing {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-1) var(--sp-2);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: var(--text-xs);
    min-width: 0;
  }

  .playing .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green);
    flex: 0 0 auto;
  }

  .playing .game {
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rail {
    width: 250px;
    flex: 0 0 auto;
    padding: var(--sp-4) var(--sp-3);
    background: rgba(10, 17, 26, 0.7);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    overflow: hidden;
  }

  .core-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-2);
    padding-top: var(--sp-2);
  }

  .state-label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--cyan);
    opacity: 0.8;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .shortcut {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    font-size: var(--text-xs);
    color: var(--fg-faint);
  }

  /* The action text is the part that can be dropped if space runs out —
     the key itself must always stay legible. */
  .shortcut span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
  }

  kbd {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--cyan-dim);
    background: rgba(14, 116, 144, 0.1);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0 4px;
  }

  .running .tool-name {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--amber);
    /* A subtle pulse marks it as in-progress rather than a stale label. */
    animation: pulse 1.4s ease-in-out infinite;
  }

  .spacer {
    flex: 1;
  }

  .version {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--fg-faint);
    text-align: center;
  }
</style>

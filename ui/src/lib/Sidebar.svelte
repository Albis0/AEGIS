<!--
  Left rail: live telemetry and session facts.

  Everything here answers "what is going on right now" at a glance, so
  the user never has to ask the assistant about its own state.
-->
<script lang="ts">
  import { chat } from "./store.svelte";

  const status = $derived(chat.status);

  /** Formats uptime as the largest sensible unit. */
  function uptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  /** Shortens long model names so they fit the rail. */
  function short(name: string, max = 18): string {
    return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
  }
</script>

<aside class="rail">
  <section>
    <div class="panel-title">SYSTEM</div>

    {#if status?.cpu != null}
      <div class="meter">
        <div class="meter-head">
          <span>CPU</span>
          <span class="value">{status.cpu}%</span>
        </div>
        <div class="track">
          <div class="fill" style:width="{status.cpu}%"></div>
        </div>
      </div>
    {/if}

    {#if status?.battery != null}
      <div class="meter">
        <div class="meter-head">
          <span>PWR</span>
          <span class="value" class:warn={status.battery < 20}>
            {status.battery}%
          </span>
        </div>
        <div class="track">
          <div
            class="fill"
            class:warn={status.battery < 20}
            style:width="{status.battery}%"
          ></div>
        </div>
      </div>
    {/if}

    <div class="stat">
      <span>uptime</span><span>{uptime(status?.uptimeSecs ?? 0)}</span>
    </div>
  </section>

  <section>
    <div class="panel-title">SESSION</div>

    <button class="stat clickable" onclick={() => (chat.panel = "settings")}>
      <span>provider</span><span class="accent">{status?.provider ?? "—"}</span>
    </button>

    <button class="stat clickable" onclick={() => (chat.panel = "settings")}>
      <span>model</span>
      <span class="accent" title={status?.model}>
        {short(status?.model ?? "—")}
      </span>
    </button>

    <button class="stat clickable" onclick={() => (chat.panel = "tools")}>
      <span>tools</span><span>{status?.toolCount ?? 0}</span>
    </button>

    <button class="stat clickable" onclick={() => (chat.panel = "memory")}>
      <span>memory</span><span>{status?.factCount ?? 0}</span>
    </button>

    <button class="stat clickable" onclick={() => (chat.panel = "automations")}>
      <span>automations</span><span>{status?.automationCount ?? 0}</span>
    </button>

    <div class="stat">
      <span>history</span><span>{status?.historyLen ?? 0}</span>
    </div>
  </section>

  <section>
    <div class="panel-title">VOICE</div>
    <button class="voice" onclick={() => chat.cycleVoice()}>
      <span class="dot" data-mode={status?.voiceMode ?? "off"}></span>
      {status?.voiceMode ?? "off"}
    </button>
    {#if status?.speaking}
      <button class="stop" onclick={() => chat.stopSpeaking()}>
        stop speaking
      </button>
    {/if}
  </section>
</aside>

<style>
  .rail {
    width: 190px;
    flex: 0 0 auto;
    padding: var(--sp-4) var(--sp-3);
    background: rgba(10, 17, 26, 0.7);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
    overflow-y: auto;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }

  .stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--text-sm);
    color: var(--fg-dim);
    padding: 2px 0;
    /* Buttons in this list must not look like buttons until hovered. */
    background: none;
    border: none;
    width: 100%;
    text-align: left;
  }

  .stat span:last-child {
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stat .accent {
    color: var(--cyan);
  }

  .clickable {
    cursor: pointer;
    border-radius: 3px;
    padding: 2px var(--sp-1);
    margin: 0 calc(var(--sp-1) * -1);
    transition: background var(--fast) var(--ease);
  }
  .clickable:hover {
    background: var(--bg-hover);
  }

  .meter {
    margin-bottom: var(--sp-2);
  }

  .meter-head {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-xs);
    color: var(--fg-dim);
    margin-bottom: 3px;
  }

  .meter-head .value {
    font-family: var(--font-mono);
    color: var(--cyan);
  }
  .meter-head .value.warn {
    color: var(--amber);
  }

  .track {
    height: 3px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: var(--cyan);
    box-shadow: var(--glow-cyan);
    transition: width var(--normal) var(--ease);
  }
  .fill.warn {
    background: var(--amber);
    box-shadow: var(--glow-amber);
  }

  .voice {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    justify-content: flex-start;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--fg-faint);
    flex: 0 0 auto;
  }
  .dot[data-mode="continuous"] {
    background: var(--cyan-bright);
    box-shadow: var(--glow-cyan);
    animation: pulse 2s ease-in-out infinite;
  }
  .dot[data-mode="wake"] {
    background: var(--cyan-dim);
  }

  .stop {
    margin-top: var(--sp-1);
    font-size: var(--text-xs);
    color: var(--amber);
    border-color: rgba(245, 158, 11, 0.4);
  }
</style>

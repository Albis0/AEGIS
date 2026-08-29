<!--
  The council — several models on one question.

  One conversation is one train of thought. Here the same question goes to
  several models at once and the answers sit side by side, which is the only
  way to see where they actually differ.

  Two things this screen must never do. It must never spend money the user did
  not expect: the forecast is on screen before the button is pressed, and the
  real cost replaces it afterwards. And it must never decide for itself how
  many seats to open — every seat here was added by hand.
-->
<script lang="ts">
  import {
    api,
    on,
    type CouncilDeltaEvent,
    type CouncilDoneEvent,
    type CouncilSeatDoneEvent,
    type CouncilSeatFailedEvent,
    type Forecast,
    type Seat,
  } from "./api";
  import { chat } from "./store.svelte";
  import { renderMarkdown } from "./markdown";
  import { onMount } from "svelte";

  type Phase = "idle" | "waiting" | "streaming" | "done" | "failed";

  interface Panel {
    seat: Seat;
    phase: Phase;
    text: string;
    label: string;
    error: string;
    inputTokens: number;
    outputTokens: number;
    dollars: number | null;
    elapsedMs: number;
  }

  let task = $state("");
  let panels = $state<Panel[]>([]);
  let forecast = $state<Forecast | null>(null);
  let running = $state(false);
  let summary = $state("");
  let notice = $state("");
  let nextSeat = 1;

  const providers = $derived(chat.status?.providers ?? []);
  const seats = $derived(panels.map((p) => p.seat));
  const canRun = $derived(!running && task.trim().length > 0 && panels.length > 0);

  onMount(() => {
    // Two seats to begin with: one is not a council, and more than two is a
    // decision the user should make rather than inherit.
    if (panels.length === 0) {
      addSeat();
      addSeat();
    }

    const listeners = Promise.all([
      on<CouncilDeltaEvent>("council:delta", (p) => {
        const panel = panels.find((x) => x.seat.id === p.seat);
        if (!panel) return;
        panel.phase = "streaming";
        panel.text += p.text;
      }),

      on<CouncilSeatDoneEvent>("council:seat-done", (p) => {
        const panel = panels.find((x) => x.seat.id === p.seat);
        if (!panel) return;
        panel.phase = "done";
        panel.text = p.text;
        panel.label = p.label;
        panel.inputTokens = p.inputTokens;
        panel.outputTokens = p.outputTokens;
        panel.dollars = p.dollars;
        panel.elapsedMs = p.elapsedMs;
      }),

      on<CouncilSeatFailedEvent>("council:seat-failed", (p) => {
        const panel = panels.find((x) => x.seat.id === p.seat);
        if (!panel) return;
        // One seat down is one seat down; the rest keep going.
        panel.phase = "failed";
        panel.error = p.message;
      }),

      on<CouncilDoneEvent>("council:done", (p) => {
        running = false;
        const cost = p.dollars > 0 ? ` · ~$${p.dollars.toFixed(4)}` : "";
        const rest = p.unpriced > 0 ? ` (+${p.unpriced} unpriced)` : "";
        summary = `${p.answered} answered, ${p.failed} failed${cost}${rest}`;
      }),
    ]);

    return () => void listeners.then((offs) => offs.forEach((off) => off()));
  });

  function addSeat() {
    if (panels.length >= 8) {
      notice = "eight seats is the most this will run at once";
      return;
    }
    panels.push({
      seat: {
        id: `seat-${nextSeat++}`,
        provider: chat.status?.provider ?? "groq",
        model: "",
        seesOthers: false,
        brief: "",
      },
      phase: "idle",
      text: "",
      label: "",
      error: "",
      inputTokens: 0,
      outputTokens: 0,
      dollars: null,
      elapsedMs: 0,
    });
    void refreshForecast();
  }

  function removeSeat(id: string) {
    panels = panels.filter((p) => p.seat.id !== id);
    void refreshForecast();
  }

  /** Re-reads the estimate. Called on every change that affects the bill. */
  async function refreshForecast() {
    if (panels.length === 0 || !task.trim()) {
      forecast = null;
      return;
    }
    try {
      forecast = await api.councilForecast(task, seats);
    } catch {
      // An estimate that cannot be made is not worth an error message; the
      // run itself will say what is wrong.
      forecast = null;
    }
  }

  async function run() {
    if (!canRun) return;
    notice = "";
    summary = "";
    running = true;

    for (const panel of panels) {
      panel.phase = panel.seat.seesOthers ? "waiting" : "streaming";
      panel.text = "";
      panel.error = "";
      panel.dollars = null;
      panel.elapsedMs = 0;
    }

    try {
      await api.councilRun(task, seats);
    } catch (e) {
      running = false;
      notice = String(e);
      for (const panel of panels) panel.phase = "idle";
    }
  }

  /** Puts one answer into the conversation, where the work continues. */
  async function keep(panel: Panel) {
    try {
      await api.councilKeep(panel.text);
      chat.add("assistant", panel.text);
      chat.view = "chat";
    } catch (e) {
      notice = String(e);
    }
  }

  function copy(panel: Panel) {
    void navigator.clipboard.writeText(panel.text);
    notice = "copied";
  }

  function seconds(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
  }
</script>

<div class="council">
  <header class="task-bar">
    <textarea
      bind:value={task}
      onblur={refreshForecast}
      class="task"
      rows="2"
      placeholder="the question every seat answers…"
    ></textarea>

    <div class="go-column">
      <button class="go" disabled={!canRun} onclick={run}>
        {running ? "running…" : "ask the council"}
      </button>
      {#if forecast}
        <!-- On screen before the button is pressed. Four seats is four times
             the tokens, and nobody should discover that from a bill. -->
        <span class="forecast">
          {forecast.requests} requests · ~{forecast.tokens.toLocaleString()} tokens
          {#if forecast.dollars > 0}
            · ~${forecast.dollars.toFixed(4)}
          {/if}
          {#if forecast.unpriced > 0}
            · {forecast.unpriced} unpriced
          {/if}
        </span>
      {/if}
      {#if summary}
        <span class="summary">{summary}</span>
      {/if}
      {#if notice}
        <span class="notice">{notice}</span>
      {/if}
    </div>
  </header>

  <div class="seats">
    {#each panels as panel (panel.seat.id)}
      <section class="panel" data-phase={panel.phase}>
        <div class="panel-head">
          <select bind:value={panel.seat.provider} onchange={refreshForecast}>
            {#each providers as p (p.id)}
              <option value={p.id}>{p.id}{p.hasKey || !p.needsKey ? "" : " ✕"}</option>
            {/each}
          </select>
          <input
            bind:value={panel.seat.model}
            onblur={refreshForecast}
            placeholder="default model"
            title="Leave empty for the provider's default."
          />
          <button
            class="tiny"
            title="remove this seat"
            onclick={() => removeSeat(panel.seat.id)}>✕</button
          >
        </div>

        <div class="panel-options">
          <label title="Off gives an independent answer. On makes this seat read the others first, so it can build on them or argue with them.">
            <input
              type="checkbox"
              bind:checked={panel.seat.seesOthers}
              onchange={refreshForecast}
            />
            reads the others
          </label>
          <input
            class="brief"
            bind:value={panel.seat.brief}
            placeholder="angle (optional)"
          />
        </div>

        <div class="answer">
          {#if panel.phase === "failed"}
            <p class="failed">{panel.error}</p>
          {:else if panel.phase === "waiting"}
            <p class="dim">waiting for the others…</p>
          {:else if panel.text}
            {@html renderMarkdown(panel.text)}
          {:else if panel.phase === "streaming"}
            <p class="dim">thinking…</p>
          {:else}
            <p class="dim">no answer yet</p>
          {/if}
        </div>

        <div class="panel-foot">
          {#if panel.phase === "done"}
            <span class="stats">
              {panel.inputTokens + panel.outputTokens} tok · {seconds(panel.elapsedMs)}
              {#if panel.dollars !== null}
                · ~${panel.dollars.toFixed(4)}
              {:else}
                · unpriced
              {/if}
            </span>
            <span class="panel-actions">
              <button class="tiny" onclick={() => copy(panel)}>copy</button>
              <button class="tiny" onclick={() => keep(panel)}>keep</button>
            </span>
          {/if}
        </div>
      </section>
    {/each}

    <button class="add" onclick={addSeat} disabled={panels.length >= 8}>
      + seat
    </button>
  </div>
</div>

<style>
  .council {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .task-bar {
    display: flex;
    gap: var(--sp-2);
    padding: var(--sp-3);
    border-bottom: 1px solid var(--line);
  }

  .task {
    flex: 1;
    min-width: 0;
    resize: vertical;
    background: var(--surface-sunken);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: var(--sp-2);
    font-family: inherit;
    font-size: var(--text-sm);
    color: var(--text);
  }

  .go-column {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 0 0 190px;
  }

  .go {
    padding: var(--sp-2);
    font-size: var(--text-xs);
    color: var(--accent-hover);
    border-color: var(--accent-line);
  }
  .go:disabled {
    color: var(--text-faint);
    border-color: var(--line);
  }

  .forecast,
  .summary,
  .notice {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-faint);
    line-height: 1.4;
  }
  .summary {
    color: var(--accent);
  }
  .notice {
    color: var(--warning);
  }

  .seats {
    flex: 1;
    display: flex;
    gap: var(--sp-2);
    padding: var(--sp-3);
    overflow-x: auto;
    min-height: 0;
  }

  .panel {
    flex: 1 0 300px;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: var(--sp-2);
    min-height: 0;
  }
  .panel[data-phase="streaming"] {
    border-color: var(--accent-line);
  }
  .panel[data-phase="failed"] {
    border-color: rgba(245, 158, 11, 0.4);
  }

  .panel-head {
    display: flex;
    gap: var(--sp-1);
    align-items: center;
  }
  .panel-head select,
  .panel-head input,
  .brief {
    background: var(--surface-sunken);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: 2px var(--sp-1);
    font-size: 10px;
    color: var(--text);
    min-width: 0;
  }
  .panel-head select {
    flex: 0 0 auto;
  }
  .panel-head input {
    flex: 1;
  }

  .panel-options {
    display: flex;
    gap: var(--sp-2);
    align-items: center;
  }
  .panel-options label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--text-faint);
    white-space: nowrap;
  }
  .brief {
    flex: 1;
  }

  .answer {
    flex: 1;
    overflow-y: auto;
    font-size: var(--text-xs);
    line-height: 1.55;
    color: var(--text-muted);
    min-height: 0;
  }
  .answer :global(pre) {
    overflow-x: auto;
  }

  .dim {
    color: var(--text-faint);
    font-size: var(--text-xs);
  }
  .failed {
    color: var(--warning);
    font-size: var(--text-xs);
  }

  .panel-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-2);
    min-height: 18px;
  }

  .stats {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-faint);
  }

  .panel-actions {
    display: flex;
    gap: var(--sp-1);
  }

  .add {
    flex: 0 0 auto;
    align-self: flex-start;
    font-size: var(--text-xs);
    padding: var(--sp-1) var(--sp-2);
  }

  .tiny {
    font-size: 10px;
    padding: 1px 6px;
  }
</style>

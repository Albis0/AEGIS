<!--
    The council — several models on one question.

    One conversation is one train of thought. Here the same question goes to
    several models at once and the answers sit side by side, which is the only
    way to see where they actually differ.

    Two things this screen must never do. It must never spend money the user
    did not expect: the forecast is on screen before the button is pressed, and
    the real cost replaces it afterwards. And it must never decide for itself
    how many seats to open — every seat here was added by hand.

    A seat's configuration is folded away once it has an answer. While you are
    setting the council up the provider and model are the whole point; the
    moment the answers arrive they are noise between you and the text you asked
    for.
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
    import Icon from "./Icon.svelte";
    import { renderMarkdown } from "./markdown";
    import { chat } from "./store.svelte";
    import { toast } from "./toast.svelte";
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
            toast.warning("Eight seats is the most this will run at once.");
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
            // An estimate that cannot be made is not worth an error message;
            // the run itself will say what is wrong.
            forecast = null;
        }
    }

    async function run() {
        if (!canRun) return;
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
            toast.failure("The council could not start.", e);
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
            toast.failure("Could not keep that answer.", e);
        }
    }

    function copy(panel: Panel) {
        // Unlike the copy button on a chat message, this one has nowhere to
        // show a tick — the label is one word in a crowded column header — so
        // the confirmation goes to a toast instead of nothing at all.
        void navigator.clipboard
            .writeText(panel.text)
            .then(() => toast.success(`Copied ${panel.label || panel.seat.model}.`))
            .catch((e) => toast.failure("Could not copy that.", e));
    }

    function seconds(ms: number): string {
        return `${(ms / 1000).toFixed(1)}s`;
    }

    /** A seat's name, once it has one. Falls back to what was asked for. */
    function seatName(panel: Panel): string {
        return panel.label || panel.seat.model || `${panel.seat.provider} default`;
    }

    /** True once anything has been asked, which is when setup stops mattering. */
    const started = $derived(panels.some((p) => p.phase !== "idle"));
</script>

<div class="council">
    <header class="task-bar">
        <textarea
            bind:value={task}
            onblur={refreshForecast}
            class="task"
            rows="2"
            placeholder="The question every seat answers…"
            aria-label="The question every seat answers"
        ></textarea>

        <div class="go-column">
            <button class="primary go" disabled={!canRun} onclick={run}>
                {#if running}
                    <span class="spinner" aria-hidden="true"></span>
                    Running…
                {:else}
                    <Icon name="council" size={15} />
                    Ask the council
                {/if}
            </button>

            {#if summary}
                <span class="summary">{summary}</span>
            {:else if forecast}
                <!-- On screen before the button is pressed. Four seats is four
                     times the tokens, and nobody should discover that from a
                     bill. -->
                <span class="forecast">
                    {forecast.requests} requests · ~{forecast.tokens.toLocaleString()}
                    tokens{#if forecast.dollars > 0}
                        · ~${forecast.dollars.toFixed(4)}
                    {/if}{#if forecast.unpriced > 0}
                        · {forecast.unpriced} unpriced
                    {/if}
                </span>
            {/if}
        </div>
    </header>

    <div class="seats">
        {#each panels as panel (panel.seat.id)}
            <section class="panel" data-phase={panel.phase}>
                <div class="panel-head">
                    <span class="seat-name" title={seatName(panel)}>
                        {seatName(panel)}
                    </span>
                    <span class="phase" data-phase={panel.phase}>
                        {#if panel.phase === "streaming"}Writing
                        {:else if panel.phase === "waiting"}Waiting
                        {:else if panel.phase === "failed"}Failed
                        {:else if panel.phase === "done"}Done
                        {/if}
                    </span>
                    <button
                        class="seat-close"
                        title="Remove this seat"
                        aria-label="Remove this seat"
                        onclick={() => removeSeat(panel.seat.id)}
                    >
                        <Icon name="close" size={13} />
                    </button>
                </div>

                <!-- Folded away once the council has run: while you are setting
                     it up these are the point, and afterwards they sit between
                     you and the answer you asked for. -->
                {#if !started}
                    <div class="setup">
                        <div class="setup-row">
                            <select
                                bind:value={panel.seat.provider}
                                onchange={refreshForecast}
                                aria-label="Provider"
                            >
                                {#each providers as p (p.id)}
                                    <option value={p.id}>
                                        {p.id}{p.hasKey || !p.needsKey ? "" : " — no key"}
                                    </option>
                                {/each}
                            </select>
                            <input
                                bind:value={panel.seat.model}
                                onblur={refreshForecast}
                                placeholder="Default model"
                                aria-label="Model"
                                title="Leave empty for the provider's default."
                            />
                        </div>

                        <input
                            class="brief"
                            bind:value={panel.seat.brief}
                            placeholder="Angle for this seat (optional)"
                            aria-label="Angle for this seat"
                        />

                        <label
                            class="sees"
                            title="Off gives an independent answer. On makes this seat read the others first, so it can build on them or argue with them."
                        >
                            <input
                                type="checkbox"
                                bind:checked={panel.seat.seesOthers}
                                onchange={refreshForecast}
                            />
                            Reads the others first
                        </label>
                    </div>
                {/if}

                <div class="answer">
                    {#if panel.phase === "failed"}
                        <p class="failed">
                            <Icon name="warning" size={14} />
                            <span class="selectable">{panel.error}</span>
                        </p>
                    {:else if panel.phase === "waiting"}
                        <p class="dim">Waiting for the others…</p>
                    {:else if panel.text}
                        <div class="md selectable">
                            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                            {@html renderMarkdown(panel.text)}
                        </div>
                    {:else if panel.phase === "streaming"}
                        <div class="skeletons" aria-hidden="true">
                            {#each { length: 5 } as _, row (row)}
                                <div class="skeleton" style:width="{92 - row * 11}%"></div>
                            {/each}
                        </div>
                    {:else}
                        <p class="dim">No answer yet.</p>
                    {/if}
                </div>

                {#if panel.phase === "done"}
                    <div class="panel-foot">
                        <span class="stats">
                            {panel.inputTokens + panel.outputTokens} tok · {seconds(
                                panel.elapsedMs,
                            )}{#if panel.dollars !== null}
                                · ~${panel.dollars.toFixed(4)}
                            {:else}
                                · unpriced
                            {/if}
                        </span>
                        <span class="panel-actions">
                            <button onclick={() => copy(panel)}>
                                <Icon name="copy" size={13} />
                                Copy
                            </button>
                            <button class="primary" onclick={() => keep(panel)}>
                                Keep
                            </button>
                        </span>
                    </div>
                {/if}
            </section>
        {/each}

        <button class="add" onclick={addSeat} disabled={panels.length >= 8}>
            <Icon name="plus" size={14} />
            Seat
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

    /* -- Task bar ------------------------------------------------------ */

    .task-bar {
        display: flex;
        gap: var(--sp-3);
        padding: var(--sp-4);
        border-bottom: 1px solid var(--line);
        flex: 0 0 auto;
    }

    .task {
        flex: 1;
        min-width: 0;
        resize: vertical;
        background: var(--surface-sunken);
        border: 1px solid var(--line);
        border-radius: var(--r-md);
        padding: var(--sp-3);
        font-family: inherit;
        font-size: var(--text-base);
        line-height: 1.5;
        color: var(--text);
        transition: border-color var(--fast) var(--ease);
    }
    .task:focus {
        border-color: var(--accent-line);
    }

    .go-column {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        flex: 0 0 210px;
    }

    .go {
        justify-content: center;
        padding: var(--sp-3);
        font-size: var(--text-base);
    }

    .spinner {
        width: 12px;
        height: 12px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-top-color: #fff;
        border-radius: var(--r-full);
        animation: spin 700ms linear infinite;
    }

    .forecast,
    .summary {
        font-size: var(--text-xs);
        line-height: 1.5;
        color: var(--text-faint);
    }
    .summary {
        color: var(--text-muted);
    }

    /* -- Seats --------------------------------------------------------- */

    .seats {
        flex: 1;
        display: flex;
        gap: var(--sp-3);
        padding: var(--sp-4);
        overflow-x: auto;
        min-height: 0;
    }

    .panel {
        flex: 1 0 320px;
        max-width: 520px;
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--r-lg);
        padding: var(--sp-3) var(--sp-4) var(--sp-4);
        min-height: 0;
        transition: border-color var(--normal) var(--ease);
    }
    .panel[data-phase="streaming"] {
        border-color: var(--accent-line);
    }
    .panel[data-phase="failed"] {
        border-color: rgba(248, 113, 113, 0.4);
    }

    .panel-head {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        flex: 0 0 auto;
    }

    .seat-name {
        flex: 1;
        min-width: 0;
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* Status as a word, not a border colour alone. A tinted edge says
       something changed; it does not say what. */
    .phase {
        flex: 0 0 auto;
        font-size: var(--text-xs);
        color: var(--text-faint);
    }
    .phase[data-phase="streaming"] {
        color: var(--accent-text);
    }
    .phase[data-phase="failed"] {
        color: var(--danger);
    }
    .phase[data-phase="done"] {
        color: var(--success);
    }

    .seat-close {
        padding: var(--sp-1);
        color: var(--text-faint);
        flex: 0 0 auto;
    }

    .setup {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        flex: 0 0 auto;
    }
    .setup-row {
        display: flex;
        gap: var(--sp-2);
    }
    .setup select,
    .setup input:not([type="checkbox"]) {
        background: var(--surface-sunken);
        border: 1px solid var(--line);
        border-radius: var(--r-md);
        padding: var(--sp-2) var(--sp-3);
        font-size: var(--text-sm);
        color: var(--text);
        min-width: 0;
        transition: border-color var(--fast) var(--ease);
    }
    .setup select:focus,
    .setup input:focus {
        border-color: var(--accent-line);
    }
    /* An explicit basis, not `auto`. Fields are `width: 100%` globally, so an
       auto basis made the provider select claim the whole row and shove the
       model field out past the edge of the panel. */
    .setup select {
        flex: 0 0 132px;
    }
    .setup-row input {
        flex: 1 1 auto;
        min-width: 0;
    }

    .sees {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        font-size: var(--text-sm);
        color: var(--text-muted);
        cursor: pointer;
    }
    .sees input {
        width: auto;
        accent-color: var(--accent);
        cursor: pointer;
    }

    .answer {
        flex: 1;
        overflow-y: auto;
        font-size: var(--text-sm);
        line-height: 1.65;
        color: var(--text);
        min-height: 0;
    }
    .answer :global(pre) {
        overflow-x: auto;
        background: var(--surface-sunken);
        border-radius: var(--r-md);
        padding: var(--sp-3);
        font-size: var(--text-xs);
    }
    .answer :global(p) {
        margin-bottom: var(--sp-3);
    }
    .answer :global(p:last-child) {
        margin-bottom: 0;
    }

    .dim {
        color: var(--text-faint);
    }
    .failed {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-2);
        color: var(--danger);
        overflow-wrap: anywhere;
    }

    .skeletons {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
    }
    .skeleton {
        height: 12px;
        border-radius: var(--r-sm);
        background: var(--surface-hover);
        animation: pulse 1.4s var(--ease-soft) infinite;
    }

    .panel-foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--sp-2);
        padding-top: var(--sp-3);
        border-top: 1px solid var(--line);
        flex: 0 0 auto;
    }

    .stats {
        font-size: var(--text-xs);
        color: var(--text-faint);
    }

    .panel-actions {
        display: flex;
        gap: var(--sp-1);
    }
    .panel-actions button {
        font-size: var(--text-xs);
        padding: var(--sp-1) var(--sp-3);
    }

    .add {
        flex: 0 0 auto;
        align-self: flex-start;
        border: 1px dashed var(--line-strong);
        padding: var(--sp-3) var(--sp-4);
    }
</style>

<!--
    Memory, automations and tools.

    These three answer "what does it remember", "what fires when" and "what can
    it do". They used to live in a rail permanently docked to the right of the
    window; now they open as a sheet over the stage and close again, because
    they are things you consult occasionally rather than watch.

    Settings is not among them — fourteen categories outgrew this shape long
    ago and has its own window in Settings.svelte.
-->
<script lang="ts">
    import Icon, { type IconName } from "./Icon.svelte";
    import Modal from "./Modal.svelte";
    import { api, type Automation, type Fact, type Tool } from "./api";
    import { ask } from "./confirm.svelte";
    import { chat } from "./store.svelte";
    import { toast } from "./toast.svelte";

    let facts = $state<Fact[]>([]);
    let automations = $state<Automation[]>([]);
    let tools = $state<Tool[]>([]);
    /** Set when the load failed, so the panel can offer a retry rather than
        showing an empty list that looks like "you have none of these". */
    let failure = $state("");
    let loading = $state(false);
    let query = $state("");

    const TITLES: Record<string, string> = {
        memory: "Remembered facts",
        automations: "Automations",
        tools: "Tools",
    };

    const title = $derived(TITLES[chat.panel] ?? "");

    /**
     * What an empty panel says.
     *
     * Each one names the thing that is missing and then shows how to create
     * it, in the words the user would actually type. "No items" tells a
     * first-time reader nothing they had not already worked out from the
     * blank space.
     */
    const EMPTY: Record<string, { icon: IconName; title: string; body: string }> = {
        memory: {
            icon: "memory",
            title: "Nothing remembered yet",
            body: "Say “remember that I prefer metric units” and it will be kept here, across every conversation.",
        },
        automations: {
            icon: "clock",
            title: "No automations",
            body: "Say “every morning at 09:00 tell me the weather” and it will run on its own from then on.",
        },
        tools: {
            icon: "tool",
            title: "No tools registered",
            body: "Tools come from the built-in set and from any MCP servers you add in settings.",
        },
    };

    /** Rows in the open panel, before filtering. */
    const listLength = $derived.by(() => {
        if (chat.panel === "memory") return facts.length;
        if (chat.panel === "automations") return automations.length;
        if (chat.panel === "tools") return tools.length;
        return 0;
    });

    /** Below this many rows, a filter field costs more than it saves. */
    const SEARCHABLE = 8;

    /** Reloads whatever the open panel shows. */
    async function load() {
        failure = "";
        loading = true;
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
            failure = e instanceof Error ? e.message : String(e);
        } finally {
            loading = false;
        }
    }

    // Reload when the panel changes.
    $effect(() => {
        void chat.panel;
        query = "";
        void load();
    });

    function close() {
        chat.panel = "none";
    }

    /** Case-insensitive substring match, used by all three lists. */
    function hit(...fields: string[]): boolean {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return fields.join(" ").toLowerCase().includes(q);
    }

    const shownFacts = $derived(facts.filter((f) => hit(f.text)));
    const shownAutomations = $derived(
        automations.filter((a) => hit(a.trigger, a.prompt)),
    );
    const shownTools = $derived(tools.filter((t) => hit(t.name, t.description)));

    /** True once the list is loaded, succeeded, and has nothing in it. */
    const isEmpty = $derived.by(() => {
        if (loading || failure) return false;
        if (chat.panel === "memory") return facts.length === 0;
        if (chat.panel === "automations") return automations.length === 0;
        if (chat.panel === "tools") return tools.length === 0;
        return false;
    });

    /** Loaded and non-empty, but the search matched nothing. */
    const noMatches = $derived.by(() => {
        if (loading || failure || isEmpty || !query.trim()) return false;
        if (chat.panel === "memory") return shownFacts.length === 0;
        if (chat.panel === "automations") return shownAutomations.length === 0;
        if (chat.panel === "tools") return shownTools.length === 0;
        return false;
    });

    async function forget(fact: Fact) {
        const confirmed = await ask({
            title: "Forget this?",
            body: fact.text,
            confirmLabel: "Forget",
            danger: true,
        });
        if (!confirmed) return;

        try {
            await api.forgetFact(fact.id);
            toast.success("Forgotten.");
            await load();
            await chat.refresh();
        } catch (e) {
            toast.failure("Could not forget that.", e);
        }
    }

    async function toggle(automation: Automation) {
        try {
            await api.toggleAutomation(automation.id, !automation.enabled);
            toast.success(automation.enabled ? "Paused." : "Resumed.");
            await load();
        } catch (e) {
            toast.failure("Could not change that automation.", e);
        }
    }

    async function remove(automation: Automation) {
        const confirmed = await ask({
            title: "Delete this automation?",
            body: `${automation.trigger} — ${automation.prompt}`,
            confirmLabel: "Delete",
            danger: true,
        });
        if (!confirmed) return;

        try {
            await api.deleteAutomation(automation.id);
            toast.success("Automation deleted.");
            await load();
            await chat.refresh();
        } catch (e) {
            toast.failure("Could not delete that automation.", e);
        }
    }
</script>

<Modal {title} size="lg" bare onClose={close}>
    <!-- The search field is offered only once a list is long enough to need
         one. Below that it is a control that can only ever narrow three rows
         to two, which is friction rather than help. -->
    {#if !loading && !failure && !isEmpty && listLength >= SEARCHABLE}
        <div class="search">
            <input
                bind:value={query}
                placeholder="Filter {title.toLowerCase()}…"
                spellcheck="false"
                aria-label="Filter {title.toLowerCase()}"
            />
            {#if query}
                <button
                    class="clear"
                    onclick={() => (query = "")}
                    aria-label="Clear filter"
                >
                    <Icon name="close" size={13} />
                </button>
            {/if}
        </div>
    {/if}

    <div class="content">
        {#if loading}
            <!-- Skeleton rows rather than a spinner: they occupy the shape the
                 answer will, so the panel does not jump when it arrives. -->
            <div class="skeletons" aria-hidden="true">
                {#each { length: 4 } as _, row (row)}
                    <div class="skeleton" style:width="{88 - row * 9}%"></div>
                {/each}
            </div>
            <span class="sr-only">Loading…</span>
        {:else if failure}
            <div class="state">
                <Icon name="warning" size={22} />
                <p class="state-title">That did not load.</p>
                <p class="state-body selectable">{failure}</p>
                <button class="outline" onclick={load}>Try again</button>
            </div>
        {:else if isEmpty}
            <div class="state">
                <Icon name={EMPTY[chat.panel].icon} size={22} />
                <p class="state-title">{EMPTY[chat.panel].title}</p>
                <p class="state-body">{EMPTY[chat.panel].body}</p>
            </div>
        {:else if noMatches}
            <div class="state">
                <p class="state-title">Nothing matches “{query}”</p>
                <button class="outline" onclick={() => (query = "")}>
                    Clear filter
                </button>
            </div>
        {:else if chat.panel === "memory"}
            {#each shownFacts as fact (fact.id)}
                <div class="entry">
                    <span class="entry-text selectable">{fact.text}</span>
                    <div class="row-actions">
                        <button class="danger row-action" onclick={() => forget(fact)}>
                            <Icon name="trash" size={13} />
                            Forget
                        </button>
                    </div>
                </div>
            {/each}
        {:else if chat.panel === "automations"}
            {#each shownAutomations as a (a.id)}
                <div class="entry" class:off={!a.enabled}>
                    <div class="entry-main">
                        <span class="trigger">{a.trigger}</span>
                        <span class="entry-text selectable">{a.prompt}</span>
                    </div>
                    <div class="row-actions">
                        <button class="row-action" onclick={() => toggle(a)}>
                            {a.enabled ? "Pause" : "Resume"}
                        </button>
                        <button
                            class="danger row-action"
                            onclick={() => remove(a)}
                            aria-label="Delete automation"
                        >
                            <Icon name="trash" size={13} />
                        </button>
                    </div>
                </div>
            {/each}
        {:else if chat.panel === "tools"}
            <p class="hint">
                {tools.length} tools. At most 12 reach the model on any one request,
                chosen by what the request is about.
            </p>
            {#each shownTools as tool (tool.name)}
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
        {/if}
    </div>
</Modal>

<style>
    .search {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        padding: var(--sp-2) var(--sp-4) var(--sp-3);
    }
    .search input {
        font-size: var(--text-sm);
        background: var(--surface-sunken);
        border: 1px solid var(--line);
        border-radius: var(--r-md);
        padding: var(--sp-2) var(--sp-3);
        transition: border-color var(--fast) var(--ease);
    }
    .search input:focus {
        border-color: var(--accent-line);
    }
    .clear {
        padding: var(--sp-2);
        color: var(--text-faint);
        flex: 0 0 auto;
    }

    .content {
        padding: var(--sp-2) var(--sp-3) var(--sp-3);
    }

    .hint {
        font-size: var(--text-sm);
        color: var(--text-faint);
        padding: var(--sp-2) var(--sp-3) var(--sp-3);
        line-height: 1.5;
    }

    /* -- Loading, empty and failed ------------------------------------- */

    .state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--sp-2);
        padding: var(--sp-7) var(--sp-5);
        text-align: center;
        color: var(--text-faint);
    }

    .state-title {
        font-size: var(--text-base);
        font-weight: 600;
        color: var(--text);
    }

    .state-body {
        font-size: var(--text-sm);
        color: var(--text-muted);
        line-height: 1.6;
        max-width: 44ch;
        overflow-wrap: anywhere;
    }

    .state button {
        margin-top: var(--sp-2);
    }

    .skeletons {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
        padding: var(--sp-4) var(--sp-3);
    }

    .skeleton {
        height: 14px;
        border-radius: var(--r-sm);
        background: var(--surface-hover);
        animation: pulse 1.4s var(--ease-soft) infinite;
    }

    /* Announced to a screen reader, drawn for nobody. */
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }

    .entry {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-3);
        padding: var(--sp-3);
        border-radius: var(--r-md);
        transition: background var(--fast) var(--ease);
    }
    .entry:hover {
        background: var(--surface-hover);
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

    .entry-text {
        font-size: var(--text-sm);
        color: var(--text);
        line-height: 1.5;
        overflow-wrap: anywhere;
    }

    .trigger {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--accent-text);
    }

    /* Row actions stay hidden until the row is hovered: a delete button on
     every row of a long list is a list you are afraid to scroll. */
    .row-actions {
        display: flex;
        gap: var(--sp-1);
        flex: 0 0 auto;
    }

    .row-action {
        font-size: var(--text-xs);
        padding: var(--sp-1) var(--sp-2);
        opacity: 0;
        transition: opacity var(--fast) var(--ease);
    }
    .entry:hover .row-action,
    .row-action:focus-visible {
        opacity: 1;
    }

    .tool-entry:hover {
        background: transparent;
    }

    .tool-name {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--text);
    }

    .tool-desc {
        font-size: var(--text-sm);
        color: var(--text-faint);
        line-height: 1.5;
    }

    .risk {
        font-family: var(--font);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 1px 6px;
        border-radius: var(--r-full);
        background: var(--surface-active);
        color: var(--text-faint);
    }
    .risk[data-risk="destructive"] {
        background: rgba(248, 113, 113, 0.14);
        color: var(--danger);
    }
</style>

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
    import Icon from "./Icon.svelte";
    import { api, type Automation, type Fact, type Tool } from "./api";
    import { chat } from "./store.svelte";

    let facts = $state<Fact[]>([]);
    let automations = $state<Automation[]>([]);
    let tools = $state<Tool[]>([]);
    let notice = $state("");
    let loading = $state(false);

    const TITLES: Record<string, string> = {
        memory: "Remembered facts",
        automations: "Automations",
        tools: "Tools",
    };

    const title = $derived(TITLES[chat.panel] ?? "");

    /** Reloads whatever the open panel shows. */
    async function load() {
        notice = "";
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
            notice = String(e);
        } finally {
            loading = false;
        }
    }

    // Reload when the panel changes.
    $effect(() => {
        void chat.panel;
        void load();
    });

    function close() {
        chat.panel = "none";
    }
</script>

<div class="scrim" role="presentation" onclick={close} onkeydown={() => {}}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
    <header>
        <span class="title">{title}</span>
        <button class="icon-btn" onclick={close} title="Close (Esc)">
            <Icon name="close" size={16} />
        </button>
    </header>

    {#if notice}
        <div class="notice">
            <Icon name="warning" size={14} />
            {notice}
        </div>
    {/if}

    <div class="content">
        {#if chat.panel === "memory"}
            {#if facts.length === 0 && !loading}
                <p class="empty">
                    Nothing remembered yet. Tell me something starting with
                    “remember that…”.
                </p>
            {:else}
                {#each facts as fact (fact.id)}
                    <div class="entry">
                        <span class="entry-text selectable">{fact.text}</span>
                        <button
                            class="danger row-action"
                            onclick={async () => {
                                await api.forgetFact(fact.id);
                                await load();
                                await chat.refresh();
                            }}
                        >
                            <Icon name="trash" size={13} />
                            Forget
                        </button>
                    </div>
                {/each}
            {/if}
        {:else if chat.panel === "automations"}
            {#if automations.length === 0 && !loading}
                <p class="empty">
                    None set. Try “every morning at 09:00 tell me the weather”.
                </p>
            {:else}
                {#each automations as a (a.id)}
                    <div class="entry" class:off={!a.enabled}>
                        <div class="entry-main">
                            <span class="trigger">{a.trigger}</span>
                            <span class="entry-text selectable">{a.prompt}</span>
                        </div>
                        <div class="row-actions">
                            <button
                                class="row-action"
                                onclick={async () => {
                                    await api.toggleAutomation(a.id, !a.enabled);
                                    await load();
                                }}
                            >
                                {a.enabled ? "Pause" : "Resume"}
                            </button>
                            <button
                                class="danger row-action"
                                onclick={async () => {
                                    await api.deleteAutomation(a.id);
                                    await load();
                                    await chat.refresh();
                                }}
                            >
                                <Icon name="trash" size={13} />
                            </button>
                        </div>
                    </div>
                {/each}
            {/if}
        {:else if chat.panel === "tools"}
            <p class="hint">
                {tools.length} tools. At most 12 reach the model on any one request,
                chosen by what the request is about.
            </p>
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
        {/if}
    </div>
</div>

<style>
    .scrim {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(2px);
        z-index: 40;
        animation: fade-in var(--fast) var(--ease);
    }

    .sheet {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(640px, calc(100vw - 48px));
        max-height: 72vh;
        display: flex;
        flex-direction: column;
        background: var(--surface-raised);
        border: 1px solid var(--line-strong);
        border-radius: var(--r-lg);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        z-index: 41;
        animation: sheet-in var(--normal) var(--ease);
    }

    @keyframes sheet-in {
        from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.985);
        }
        to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
        border-bottom: 1px solid var(--line);
        flex: 0 0 auto;
    }

    .title {
        font-size: var(--text-md);
        font-weight: 600;
        color: var(--text);
    }

    .icon-btn {
        padding: var(--sp-2);
        color: var(--text-faint);
    }

    .notice {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        font-size: var(--text-sm);
        color: var(--warning);
        padding: var(--sp-2) var(--sp-4);
        background: rgba(251, 191, 36, 0.08);
    }

    .content {
        overflow-y: auto;
        padding: var(--sp-2) var(--sp-3) var(--sp-3);
        min-height: 0;
    }

    .empty,
    .hint {
        font-size: var(--text-sm);
        color: var(--text-faint);
        padding: var(--sp-4);
        line-height: 1.5;
    }
    .empty {
        text-align: center;
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

<!--
    The status bar.

    A single quiet line along the bottom. It replaces a 190-pixel telemetry
    rail that ran the full height of the window showing CPU meters, uptime and
    a shortcut list -- none of which is worth a column of permanent real estate
    in an interface whose whole point is an empty stage.

    What survives is only what answers a question the user might actually have
    mid-conversation: which model is about to answer, how many tools it can
    reach, and whether anything is wrong. Each one is a button that opens the
    thing it describes, so reading a value and changing it are the same
    gesture.

    Load is shown only when it is high enough to explain something feeling
    slow. A meter that reads 4% all day is decoration.
-->
<script lang="ts">
    import Icon from "./Icon.svelte";
    import { chat } from "./store.svelte";

    interface Props {
        onOpenSettings: () => void;
    }

    const { onOpenSettings }: Props = $props();

    const status = $derived(chat.status);

    /** Above this, load is worth mentioning; below it, it is noise. */
    const BUSY_CPU = 55;

    /** Shortens a model id so it fits without wrapping the bar. */
    function short(name: string, max = 26): string {
        return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
    }
</script>

<footer class="bar">
    <div class="left">
        {#if !status?.keys.length}
            <!-- The one genuine error state: with no key nothing can work, so it
           gets colour and says what to do about it. -->
            <button class="item warn" onclick={onOpenSettings}>
                <Icon name="warning" size={13} />
                <span>No API key — open settings</span>
            </button>
        {:else}
            <button class="item" onclick={onOpenSettings} title="Change model">
                <span class="provider">{status.provider}</span>
                <span class="sep">/</span>
                <span class="model" title={status.model}>{short(status.model)}</span>
            </button>
        {/if}
    </div>

    <div class="right">
        {#if status?.fullAuthority}
            <!-- The one indicator that has to be here rather than in settings.
           Full authority's whole effect is that nothing appears -- no prompts,
           no budget warnings -- so without a standing marker the mode is
           indistinguishable from a quiet session. Clicking goes to the switch
           that turns it off. -->
            <button
                class="item warn"
                onclick={onOpenSettings}
                title="Every approval is off. Click to change."
            >
                <Icon name="warning" size={12} />
                <span>Full authority</span>
            </button>
        {/if}

        {#if status?.steamGame}
            <!-- Context, not a control: you do not steer a game from a chat
           window. One line, and it disappears when the process does. -->
            <span class="item quiet" title="Running now">
                <span class="playing-dot"></span>
                {status.steamGame}
            </span>
        {/if}

        {#if (status?.cpu ?? 0) >= BUSY_CPU}
            <span class="item quiet" title="System load">
                {status?.cpu}% CPU
            </span>
        {/if}

        {#if status?.battery != null && status.battery < 20}
            <span class="item warn" title="Battery low">
                {status.battery}%
            </span>
        {/if}

        <button
            class="item"
            onclick={() => (chat.panel = "tools")}
            title="Tools available to the model"
        >
            <Icon name="tool" size={12} />
            {status?.toolCount ?? 0}
        </button>

        {#if (status?.factCount ?? 0) > 0}
            <button
                class="item"
                onclick={() => (chat.panel = "memory")}
                title="Facts remembered about you"
            >
                <Icon name="memory" size={12} />
                {status?.factCount}
            </button>
        {/if}

        <span class="item version">v{status?.version ?? "—"}</span>
    </div>
</footer>

<style>
    .bar {
        flex: 0 0 auto;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-3);
        padding: 0 var(--sp-3);
        font-size: var(--text-xs);
        color: var(--text-faint);
        border-top: 1px solid var(--line);
        background: var(--bg);
        /* Above the reactor's canvas, which fills the stage behind it. */
        position: relative;
        z-index: 10;
    }

    .left,
    .right {
        display: flex;
        align-items: center;
        gap: var(--sp-1);
        min-width: 0;
    }

    .item {
        display: flex;
        align-items: center;
        gap: var(--sp-1);
        font-size: var(--text-xs);
        color: var(--text-faint);
        padding: 2px var(--sp-2);
        border-radius: var(--r-sm);
        min-width: 0;
        white-space: nowrap;
    }

    button.item:hover {
        color: var(--text-muted);
        background: var(--surface-hover);
    }

    .quiet,
    .version {
        cursor: default;
    }

    .provider {
        color: var(--text-muted);
    }

    .sep {
        opacity: 0.4;
    }

    .model {
        font-family: var(--font-mono);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .warn {
        color: var(--warning);
    }
    button.warn:hover {
        color: var(--warning);
        background: rgba(251, 191, 36, 0.1);
    }

    .playing-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--success);
        flex: 0 0 auto;
    }
</style>

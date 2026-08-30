<!--
    The toast stack.

    Mounted once, at the root, and driven entirely by the `toast` store — so
    anything anywhere can report an outcome without knowing this component
    exists or having somewhere on screen to put the result.

    It sits bottom-right, clear of the status bar, and above every layer
    including modals: a save that fails inside settings has to be visible from
    inside settings, and a toast that a dialog covers is a toast nobody reads.

    Newest at the bottom, nearest the corner the eye is drawn to, with older
    ones pushed up. Hovering holds a toast open, because reading a four-line
    error should not be a race against its own timer.
-->
<script lang="ts">
    import { flip } from "svelte/animate";
    import { fly } from "svelte/transition";
    import Icon, { type IconName } from "./Icon.svelte";
    import { toast, type ToastKind } from "./toast.svelte";

    const ICONS: Record<ToastKind, IconName> = {
        info: "info",
        success: "check",
        warning: "warning",
        error: "warning",
    };
</script>

<!-- `aria-live` polite, not assertive: these announce things that already
     happened, and cutting off whatever the reader is on to say "copied" is
     worse than waiting for a pause. -->
<div class="stack" role="status" aria-live="polite">
    {#each toast.items as item (item.id)}
        <div
            class="toast {item.kind}"
            animate:flip={{ duration: 180 }}
            in:fly={{ x: 16, duration: 200 }}
            out:fly={{ x: 16, duration: 140 }}
            onmouseenter={() => toast.hold(item.id)}
            onmouseleave={() => toast.release(item.id)}
            role="presentation"
        >
            <span class="mark"><Icon name={ICONS[item.kind]} size={15} /></span>

            <div class="body">
                <span class="text">{item.text}</span>
                {#if item.detail}
                    <span class="detail selectable">{item.detail}</span>
                {/if}
            </div>

            {#if item.action}
                <button
                    class="action"
                    onclick={() => {
                        item.action?.run();
                        toast.dismiss(item.id);
                    }}
                >
                    {item.action.label}
                </button>
            {/if}

            <button
                class="dismiss"
                onclick={() => toast.dismiss(item.id)}
                aria-label="Dismiss"
            >
                <Icon name="close" size={13} />
            </button>
        </div>
    {/each}
</div>

<style>
    .stack {
        position: fixed;
        /* Clears the 26px status bar with a gap under it. */
        bottom: calc(26px + var(--sp-3));
        right: var(--sp-4);
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: var(--sp-2);
        /* Above every modal layer. A failure raised from inside a dialog has
           to be readable from inside that dialog. */
        z-index: 200;
        /* The stack itself is not a surface; only the toasts in it take
           clicks, or the corner of the window would stop responding. */
        pointer-events: none;
    }

    .toast {
        pointer-events: auto;
        display: flex;
        align-items: flex-start;
        gap: var(--sp-3);
        width: min(400px, calc(100vw - 48px));
        padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
        background: var(--surface-raised);
        border: 1px solid var(--line-strong);
        border-radius: var(--r-md);
        box-shadow: var(--shadow-md);
    }

    /* Severity is a tinted rule down the leading edge rather than a coloured
       panel: the text stays on the normal surface and stays readable, and
       four stacked errors do not turn the corner of the window red. */
    .toast::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        border-radius: var(--r-md) 0 0 var(--r-md);
        background: var(--tone);
    }
    .toast {
        position: relative;
        --tone: var(--text-faint);
    }
    .toast.success {
        --tone: var(--success);
    }
    .toast.warning {
        --tone: var(--warning);
    }
    .toast.error {
        --tone: var(--danger);
    }
    .toast.info {
        --tone: var(--accent);
    }

    .mark {
        display: flex;
        color: var(--tone);
        /* Nudged to sit on the first line of text rather than above it. */
        margin-top: 1px;
        flex: 0 0 auto;
    }

    .body {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
    }

    .text {
        font-size: var(--text-sm);
        color: var(--text);
        line-height: 1.5;
        overflow-wrap: anywhere;
    }

    .detail {
        font-size: var(--text-xs);
        color: var(--text-muted);
        line-height: 1.5;
        overflow-wrap: anywhere;
        /* Long backend errors are unbounded; four lines is enough to identify
           one, and the rest is in the console. */
        display: -webkit-box;
        -webkit-line-clamp: 4;
        line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .action {
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--accent-text);
        padding: var(--sp-1) var(--sp-2);
        flex: 0 0 auto;
    }

    .dismiss {
        padding: var(--sp-1);
        color: var(--text-faint);
        flex: 0 0 auto;
        opacity: 0;
        transition: opacity var(--fast) var(--ease);
    }
    .toast:hover .dismiss,
    .dismiss:focus-visible {
        opacity: 1;
    }
</style>

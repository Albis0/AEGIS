<!--
    The overlay primitive.

    Every floating layer in the app goes through this: the command palette,
    the memory and automation sheets, settings, confirmations. Before it, each
    one hand-rolled its own scrim and its own z-index, and none of them trapped
    focus — so Tab walked straight out of an open dialog into the window
    behind it, where the reactor and the chat box were still tabbable but no
    longer visible.

    What it guarantees, so no caller has to think about it again:

    **Focus goes in and cannot leave.** The first thing worth focusing gets
    focus on open (mark it `data-autofocus` to choose which), Tab cycles
    inside, and on close focus returns to whatever the user was on before — so
    dismissing a dialog puts the caret back where they were typing.

    **Escape closes the top layer only.** Layers are tracked in a stack and a
    keystroke is acted on by the last one opened. With a confirmation open over
    settings, one Escape answers the question and leaves settings up. The event
    is then stopped, so the window-level handler in App.svelte does not unwind
    a second layer on the same press.

    **Layers stack in the order they opened.** Two z-index values per layer,
    handed out from the stack depth, which is what makes a dialog above a
    dialog possible at all.
-->
<script lang="ts" module>
    /**
     * Open layers, oldest first.
     *
     * A plain array rather than `$state`: it is only ever consulted from
     * inside an event handler, so nothing needs to re-render when it changes.
     */
    const stack: symbol[] = [];

    /** First layer sits here; each one after it two above — scrim, then panel. */
    const BASE_Z = 60;

    /**
     * What counts as focusable.
     *
     * `[tabindex="-1"]` is excluded deliberately: it means "focusable by
     * script, not by Tab", which is exactly the distinction the trap needs.
     */
    const FOCUSABLE = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "textarea:not([disabled])",
        "select:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
    ].join(",");
</script>

<script lang="ts">
    import { onMount, type Snippet } from "svelte";
    import Icon from "./Icon.svelte";

    interface Props {
        /** Drawn as a heading, and used as the accessible name. */
        title?: string;
        /** Accessible name when there is no visible title, as on the palette. */
        label?: string;
        /** Sub-heading under the title, for a dialog that needs a sentence. */
        description?: string;
        size?: "sm" | "md" | "lg" | "xl" | "full";
        /** `top` sits the panel in the upper third, where the eye rests. */
        align?: "center" | "top";
        /**
         * Whether clicking the backdrop closes it. Off for a dialog that has
         * to be answered rather than avoided by a stray click.
         *
         * This governs the backdrop only. Escape is a separate question — a
         * confirmation should refuse a click that lands beside it and still
         * cancel on Escape, which is the one gesture that cannot be
         * accidental.
         */
        dismissable?: boolean;
        /**
         * Whether Escape closes it. Escape is *consumed* either way while this
         * is the top layer: a press aimed at this dialog must never be acted
         * on by a layer underneath.
         */
        escapable?: boolean;
        /** Hides the corner close button without making the layer sticky. */
        showClose?: boolean;
        /** Removes the panel's own padding, for content that lays itself out. */
        bare?: boolean;
        onClose: () => void;
        children: Snippet;
        /** Pinned to the bottom of the panel, outside the scroll area. */
        footer?: Snippet;
        /** Extra controls in the header, beside the close button. */
        actions?: Snippet;
    }

    const {
        title,
        label,
        description,
        size = "md",
        align = "center",
        dismissable = true,
        escapable = true,
        showClose = true,
        bare = false,
        onClose,
        children,
        footer,
        actions,
    }: Props = $props();

    const id = Symbol("modal");

    let panel = $state<HTMLElement | null>(null);
    let depth = $state(0);

    function focusables(): HTMLElement[] {
        if (!panel) return [];
        return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            // `offsetParent` is null for anything display:none or inside a
            // collapsed section, which should not be a Tab stop.
            (element) => element.offsetParent !== null,
        );
    }

    /** True when this is the layer a keystroke belongs to. */
    function topmost(): boolean {
        return stack[stack.length - 1] === id;
    }

    onMount(() => {
        stack.push(id);
        depth = stack.length - 1;

        // Captured before focus moves, so it can be given back on close. If the
        // trigger has since left the page, focusing it is a harmless no-op.
        const opener = document.activeElement as HTMLElement | null;

        // Deferred a tick: children with their own mount-time focus, such as the
        // search field in the palette, have not run yet on this one.
        //
        // The fallback is the panel itself, not its first focusable. Reaching
        // for the first one put the ring on the close button of every sheet
        // that opens to be read, which both looks like the primary action and
        // is the one control nobody arrived wanting. Focusing the panel names
        // the dialog, makes Escape work, and leaves Tab to enter the content
        // in reading order.
        queueMicrotask(() => {
            const chosen =
                panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
            chosen?.focus();
        });

        return () => {
            const at = stack.indexOf(id);
            if (at !== -1) stack.splice(at, 1);
            opener?.focus?.();
        };
    });

    function dismiss() {
        if (dismissable) onClose();
    }

    function onKeydown(event: KeyboardEvent) {
        if (!topmost()) return;

        if (event.key === "Escape") {
            // Consumed whether or not it closes anything. App.svelte listens on
            // the window, so letting the press through would have a *lower*
            // layer act on an Escape aimed at this one — which is how a
            // confirmation over settings used to close settings and leave the
            // question up.
            event.preventDefault();
            event.stopPropagation();
            if (escapable) onClose();
            return;
        }

        if (event.key !== "Tab") return;

        const items = focusables();
        if (items.length === 0) {
            // Nothing to move to, so Tab must not escape to the page behind.
            event.preventDefault();
            return;
        }

        const first = items[0];
        const last = items[items.length - 1];
        const current = document.activeElement;

        if (event.shiftKey && (current === first || current === panel)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && current === last) {
            event.preventDefault();
            first.focus();
        }
    }
</script>

<div
    class="scrim"
    class:soft={!dismissable}
    style:z-index={BASE_Z + depth * 2}
    role="presentation"
    onclick={dismiss}
></div>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
    class="panel {size} {align}"
    class:bare
    bind:this={panel}
    style:z-index={BASE_Z + depth * 2 + 1}
    role="dialog"
    aria-modal="true"
    aria-label={title ? undefined : label}
    aria-labelledby={title ? "modal-title" : undefined}
    aria-describedby={description ? "modal-description" : undefined}
    tabindex="-1"
    onkeydown={onKeydown}
>
    {#if title || actions || showClose}
        <header class:titled={Boolean(title)}>
            <div class="heading">
                {#if title}
                    <h2 id="modal-title">{title}</h2>
                {/if}
                {#if description}
                    <p id="modal-description">{description}</p>
                {/if}
            </div>

            <div class="header-actions">
                {@render actions?.()}
                {#if showClose}
                    <button
                        class="close"
                        onclick={onClose}
                        title={dismissable ? "Close (Esc)" : "Close"}
                        aria-label="Close"
                    >
                        <Icon name="close" size={16} />
                    </button>
                {/if}
            </div>
        </header>
    {/if}

    <div class="content" class:padded={!bare}>
        {@render children()}
    </div>

    {#if footer}
        <div class="footer">{@render footer()}</div>
    {/if}
</div>

<style>
    .scrim {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(2px);
        animation: fade-in var(--fast) var(--ease);
    }

    /* A layer that cannot be dismissed by clicking away should not look as
       though it can. Darker, with no hint that the page behind is still live. */
    .scrim.soft {
        background: rgba(0, 0, 0, 0.58);
    }

    .panel {
        position: fixed;
        left: 50%;
        display: flex;
        flex-direction: column;
        background: var(--surface-raised);
        border: 1px solid var(--line-strong);
        border-radius: var(--r-lg);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        animation: panel-in var(--normal) var(--ease);
    }

    .panel.center {
        top: 50%;
        transform: translate(-50%, -50%);
        max-height: min(78vh, 900px);
    }

    /* The upper third, so the panel opens where the eye already is and leaves
       the stage behind it visible. */
    .panel.top {
        top: 16vh;
        transform: translateX(-50%);
        max-height: 68vh;
    }

    /* Scale alone, so the keyframes do not have to know which `transform` the
       alignment above already put on the element. */
    @keyframes panel-in {
        from {
            opacity: 0;
            scale: 0.985;
        }
        to {
            opacity: 1;
            scale: 1;
        }
    }

    .panel.sm {
        width: min(420px, calc(100vw - 48px));
    }
    .panel.md {
        width: min(560px, calc(100vw - 48px));
    }
    .panel.lg {
        width: min(680px, calc(100vw - 48px));
    }
    .panel.xl {
        width: min(920px, calc(100vw - 48px));
    }
    .panel.full {
        width: calc(100vw - 64px);
        height: calc(100vh - 64px);
        max-height: none;
    }

    header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-3);
        padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-5);
        flex: 0 0 auto;
    }

    /* The rule under the header appears only when there is a title above it.
       On a headerless layer it would be a line floating over nothing. */
    header.titled {
        border-bottom: 1px solid var(--line);
    }

    .heading {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    h2 {
        font-size: var(--text-md);
        font-weight: 600;
        color: var(--text);
        line-height: 1.4;
    }

    .heading p {
        font-size: var(--text-sm);
        color: var(--text-muted);
        line-height: 1.5;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-1);
        flex: 0 0 auto;
    }

    .close {
        padding: var(--sp-2);
        color: var(--text-faint);
    }

    .content {
        overflow-y: auto;
        min-height: 0;
        flex: 1;
    }
    .content.padded {
        padding: var(--sp-4) var(--sp-5) var(--sp-5);
    }

    .footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--sp-2);
        padding: var(--sp-3) var(--sp-5);
        border-top: 1px solid var(--line);
        background: var(--surface);
        flex: 0 0 auto;
    }
</style>

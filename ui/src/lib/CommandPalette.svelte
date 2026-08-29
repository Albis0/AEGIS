<!--
    The command palette.

    One place to reach everything, opened with Ctrl+K. The brief was explicit
    that the user should not have to hunt through menus or remember a command
    to type -- so every action the interface can perform is listed here, found
    by typing part of its name, and run with Enter.

    This is also what keeps the rest of the window empty. Actions do not need
    a permanent button on screen if they are all one keystroke away, which is
    what lets the stage be a reactor and nothing else.
-->
<!-- `Command` is exported from a module script: that is the only scope
     Svelte allows a type export from. -->
<script lang="ts" module>
    import type { IconName } from "./Icon.svelte";

    export interface Command {
        id: string;
        label: string;
        /** Grouping heading. Commands are listed under it in insertion order. */
        group: string;
        icon: IconName;
        /** Shown right-aligned, when the action also has a shortcut. */
        hint?: string;
        /** Extra words to match on, for things the label does not say. */
        keywords?: string;
        run: () => void;
    }
</script>

<script lang="ts">
    import Icon from "./Icon.svelte";

    interface Props {
        commands: Command[];
        onClose: () => void;
    }

    const { commands, onClose }: Props = $props();

    let query = $state("");
    let selected = $state(0);
    let inputEl = $state<HTMLInputElement | null>(null);
    let listEl = $state<HTMLElement | null>(null);

    /**
     * Filter and rank.
     *
     * A label that *starts* with what was typed outranks one that merely
     * contains it, so typing "se" puts "Settings" above "Toggle voice mode".
     * Anything past that is ordering by relevance nobody asked for.
     */
    const matches = $derived.by(() => {
        const q = query.trim().toLowerCase();
        if (!q) return commands;

        return commands
            .map((command) => {
                const label = command.label.toLowerCase();
                const haystack = `${label} ${command.keywords ?? ""} ${command.group.toLowerCase()}`;
                if (!haystack.includes(q)) return null;
                return { command, rank: label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2 };
            })
            .filter((hit): hit is { command: Command; rank: number } => hit !== null)
            .sort((a, b) => a.rank - b.rank)
            .map((hit) => hit.command);
    });

    /** Reset the cursor whenever the result set changes under it. */
    $effect(() => {
        void matches;
        selected = 0;
    });

    $effect(() => {
        inputEl?.focus();
    });

    /** Keeps the highlighted row in view during keyboard navigation. */
    $effect(() => {
        void selected;
        queueMicrotask(() => {
            listEl
                ?.querySelector<HTMLElement>('[data-selected="true"]')
                ?.scrollIntoView({ block: "nearest" });
        });
    });

    function run(command: Command) {
        onClose();
        command.run();
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            // Wraps, so holding Down never dead-ends at the bottom.
            selected = (selected + 1) % Math.max(matches.length, 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            selected = (selected - 1 + matches.length) % Math.max(matches.length, 1);
        } else if (event.key === "Enter") {
            event.preventDefault();
            const command = matches[selected];
            if (command) run(command);
        } else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
        }
    }

    /** Group heading, emitted only when it changes down the list. */
    function headingFor(index: number): string | null {
        const group = matches[index]?.group;
        return index === 0 || matches[index - 1]?.group !== group
            ? (group ?? null)
            : null;
    }
</script>

<!-- The scrim closes on click. It is a plain div with a role rather than a
     <button> because it wraps interactive content. -->
<div
    class="scrim"
    role="presentation"
    onclick={onClose}
    onkeydown={() => {}}
></div>

<div class="palette" role="dialog" aria-modal="true" aria-label="Commands">
    <div class="search">
        <Icon name="chevronRight" size={16} />
        <input
            bind:this={inputEl}
            bind:value={query}
            onkeydown={onKeydown}
            placeholder="Search commands…"
            spellcheck="false"
            aria-label="Search commands"
        />
        <kbd>Esc</kbd>
    </div>

    <div class="list" bind:this={listEl} role="listbox" tabindex="-1">
        {#each matches as command, index (command.id)}
            {@const heading = headingFor(index)}
            {#if heading}
                <div class="group">{heading}</div>
            {/if}

            <button
                class="item"
                role="option"
                aria-selected={index === selected}
                data-selected={index === selected}
                onclick={() => run(command)}
                onmouseenter={() => (selected = index)}
            >
                <Icon name={command.icon} size={16} />
                <span class="label">{command.label}</span>
                {#if command.hint}
                    <kbd class="hint">{command.hint}</kbd>
                {/if}
            </button>
        {/each}

        {#if matches.length === 0}
            <div class="none">No commands match “{query}”</div>
        {/if}
    </div>
</div>

<style>
    .scrim {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(2px);
        z-index: 50;
        animation: fade-in var(--fast) var(--ease);
    }

    .palette {
        position: fixed;
        /* Sits in the upper third rather than dead centre: it is the natural
       resting place for the eye, and it leaves the reactor visible. */
        top: 16vh;
        left: 50%;
        transform: translateX(-50%);
        width: min(560px, calc(100vw - 48px));
        max-height: 60vh;
        display: flex;
        flex-direction: column;
        background: var(--surface-raised);
        border: 1px solid var(--line-strong);
        border-radius: var(--r-lg);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        z-index: 51;
        animation: palette-in var(--normal) var(--ease);
    }

    @keyframes palette-in {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-6px) scale(0.99);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
        }
    }

    .search {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        padding: var(--sp-3) var(--sp-4);
        border-bottom: 1px solid var(--line);
        color: var(--text-faint);
        flex: 0 0 auto;
    }

    .search input {
        font-size: var(--text-md);
    }

    .list {
        overflow-y: auto;
        padding: var(--sp-2);
        min-height: 0;
    }

    .group {
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--text-faint);
        padding: var(--sp-2) var(--sp-2) var(--sp-1);
    }

    .item {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        width: 100%;
        padding: var(--sp-2) var(--sp-2);
        border-radius: var(--r-sm);
        color: var(--text-muted);
        font-size: var(--text-base);
        text-align: left;
    }

    /* Selection is driven by `data-selected`, not `:hover`, so the keyboard
     and the mouse cannot disagree about which row is active. */
    .item[data-selected="true"] {
        background: var(--surface-active);
        color: var(--text);
    }

    .label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    kbd {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--text-faint);
        background: var(--surface-sunken);
        border: 1px solid var(--line);
        border-radius: var(--r-sm);
        padding: 1px 6px;
        flex: 0 0 auto;
    }

    .none {
        padding: var(--sp-5);
        text-align: center;
        font-size: var(--text-sm);
        color: var(--text-faint);
    }
</style>

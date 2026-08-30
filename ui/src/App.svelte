<!--
    The window.

    A single full-bleed stage with the reactor at its centre and nothing else,
    and a chat panel docked to the right that can be resized or hidden. That is
    the whole layout. Everything the old interface kept permanently on screen --
    telemetry rails, meters, a shortcut list, a view switcher -- now lives in
    the command palette on Ctrl+K, where it is one keystroke away instead of
    occupying a column full time.

    The other interfaces (code, canvas, council) take the stage over when they
    are open, keeping the chat panel beside them so the conversation is never
    left behind.
-->
<script lang="ts">
    import { getCurrentWindow } from "@tauri-apps/api/window";
    import { onMount } from "svelte";
    import { api } from "./lib/api";
    import CanvasView from "./lib/CanvasView.svelte";
    import ChatPanel from "./lib/ChatPanel.svelte";
    import CodeView from "./lib/CodeView.svelte";
    import CommandPalette, { type Command } from "./lib/CommandPalette.svelte";
    import ConfirmDialog from "./lib/ConfirmDialog.svelte";
    import CouncilView from "./lib/CouncilView.svelte";
    import Icon from "./lib/Icon.svelte";
    import Panels from "./lib/Panels.svelte";
    import Reactor from "./lib/Reactor.svelte";
    import Settings from "./lib/Settings.svelte";
    import SpotifyPanel from "./lib/SpotifyPanel.svelte";
    import StatusBar from "./lib/StatusBar.svelte";
    import Toasts from "./lib/Toasts.svelte";
    import { nowPlaying } from "./lib/nowplaying.svelte";
    import { chat } from "./lib/store.svelte";
    import { toast } from "./lib/toast.svelte";

    const appWindow = getCurrentWindow();

    const THEME_KEY = "vavis.theme";

    let chatOpen = $state(true);
    let paletteOpen = $state(false);
    // Seeded from the DOM rather than from storage. `main.ts` has already
    // applied the saved theme before the app mounted -- components read
    // `data-theme` as they initialise, so it cannot wait for an effect here --
    // and reading it back keeps this the single source of truth afterwards.
    let theme = $state<"dark" | "light">(
        document.documentElement.dataset.theme === "light" ? "light" : "dark",
    );
    let chatPanel = $state<ChatPanel | null>(null);

    const status = $derived(chat.status);

    onMount(() => {
        void chat.start();
        // Polls whether or not the box is on screen: music starting is what
        // puts it there, so detection cannot live inside the thing it shows.
        nowPlaying.start();
        return () => {
            chat.stop();
            nowPlaying.stop();
        };
    });

    // Theme is presentation and per-machine, so it lives in localStorage rather
    // than in the app config: there is nothing for the backend or another
    // device to do with it.
    $effect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem(THEME_KEY, theme);
    });

    function toggleChat() {
        chatOpen = !chatOpen;
        // Opening the panel should put the caret in it. Making the user click
        // into a panel they just summoned is exactly the friction this layout
        // is meant to remove.
        if (chatOpen) queueMicrotask(() => chatPanel?.focus());
    }

    async function cycleWindowMode() {
        const order = ["windowed", "borderless", "fullscreen"];
        const current = status?.windowMode ?? "windowed";
        const next = order[(order.indexOf(current) + 1) % order.length];

        try {
            // Applied first so the change is instant, then persisted.
            //
            // Decorations stay off throughout: the interface draws its own
            // title strip, and turning the OS one back on gives two of them.
            await appWindow.setFullscreen(next === "fullscreen");
            if (next !== "fullscreen") {
                if (next === "borderless") await appWindow.maximize();
                else await appWindow.unmaximize();
            }

            await api.setSetting("windowMode", next);
            await chat.refresh();
        } catch (e) {
            // The window is now in a state the config does not describe, which
            // is worth saying: the next launch will not reproduce it.
            toast.failure("Could not change the window mode.", e);
        }
    }

    /**
     * Everything the interface can do, in one list.
     *
     * This is the only registry of actions: the palette reads it, and so does
     * the shortcut handler below, so a command and its key can never drift
     * apart.
     */
    const commands = $derived<Command[]>([
        {
            id: "view.chat",
            label: "Reactor",
            group: "Go to",
            icon: "chat",
            keywords: "home stage main",
            run: () => (chat.view = "chat"),
        },
        {
            id: "view.code",
            label: "Code",
            group: "Go to",
            icon: "code",
            keywords: "workspace files editor",
            run: () => (chat.view = "code"),
        },
        {
            id: "view.canvas",
            label: "Canvas",
            group: "Go to",
            icon: "canvas",
            keywords: "image video generate gallery",
            run: () => (chat.view = "canvas"),
        },
        {
            id: "view.council",
            label: "Council",
            group: "Go to",
            icon: "council",
            keywords: "models compare panel",
            run: () => (chat.view = "council"),
        },

        {
            id: "chat.toggle",
            label: chatOpen ? "Hide chat panel" : "Show chat panel",
            group: "Chat",
            icon: "panelRight",
            hint: "Ctrl+B",
            run: toggleChat,
        },
        {
            id: "chat.clear",
            label: "New conversation",
            group: "Chat",
            icon: "plus",
            hint: "Ctrl+L",
            keywords: "clear reset",
            run: () => void chat.clearWithConfirm(),
        },
        {
            id: "voice.cycle",
            label: `Voice: ${status?.voiceMode ?? "off"}`,
            group: "Chat",
            icon: status?.voiceMode === "off" ? "micOff" : "mic",
            hint: "Ctrl+M",
            keywords: "microphone listen speech wake",
            run: () => void chat.cycleVoice(),
        },

        {
            id: "spotify.nowPlaying",
            label: nowPlaying.visible ? "Hide now playing" : "Show now playing",
            group: "Chat",
            icon: "info",
            keywords: "spotify music track player playing drag box popup",
            run: () => nowPlaying.toggle(),
        },

        {
            id: "app.settings",
            label: "Settings",
            group: "Application",
            icon: "settings",
            hint: "Ctrl+,",
            keywords: "keys providers preferences api language",
            run: () => (chat.panel = "settings"),
        },
        {
            id: "app.theme",
            label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
            group: "Application",
            icon: theme === "dark" ? "sun" : "moon",
            keywords: "appearance colour color mode",
            run: () => (theme = theme === "dark" ? "light" : "dark"),
        },
        {
            id: "app.window",
            label: `Window: ${status?.windowMode ?? "windowed"}`,
            group: "Application",
            icon: "maximise",
            hint: "F11",
            keywords: "fullscreen borderless maximise",
            run: () => void cycleWindowMode(),
        },
        {
            id: "app.memory",
            label: "Remembered facts",
            group: "Application",
            icon: "memory",
            keywords: "memory knows about me",
            run: () => (chat.panel = "memory"),
        },
        {
            id: "app.automations",
            label: "Automations",
            group: "Application",
            icon: "clock",
            keywords: "schedule triggers timers",
            run: () => (chat.panel = "automations"),
        },
        {
            id: "app.tools",
            label: "Tools",
            group: "Application",
            icon: "tool",
            keywords: "abilities capabilities integrations",
            run: () => (chat.panel = "tools"),
        },
    ]);

    function onGlobalKey(event: KeyboardEvent) {
        const ctrl = event.ctrlKey || event.metaKey;

        if (event.key === "Escape") {
            // Escape unwinds one layer at a time, most transient first. Closing
            // everything at once would lose a panel the user was reading because
            // they wanted the speech to stop.
            //
            // Modals answer Escape themselves and stop the event, so the
            // overlay branches below are only reached when focus has somehow
            // left the trapped layer. They stay as the fallback for that.
            if (paletteOpen) paletteOpen = false;
            else if (status?.speaking) void chat.stopSpeaking();
            else if (chat.approval) void chat.answerApproval("deny");
            else if (chat.panel !== "none") chat.panel = "none";
            else if (chat.view !== "chat") chat.view = "chat";
            return;
        }

        if (ctrl && event.key.toLowerCase() === "k") {
            event.preventDefault();
            paletteOpen = !paletteOpen;
            return;
        }
        if (ctrl && event.key.toLowerCase() === "b") {
            event.preventDefault();
            toggleChat();
            return;
        }
        if (ctrl && event.key.toLowerCase() === "m") {
            event.preventDefault();
            void chat.cycleVoice();
            return;
        }
        if (ctrl && event.key.toLowerCase() === "l") {
            event.preventDefault();
            void chat.clearWithConfirm();
            return;
        }
        if (ctrl && event.key === ",") {
            event.preventDefault();
            chat.panel = chat.panel === "settings" ? "none" : "settings";
            return;
        }
        if (event.key === "F11") {
            event.preventDefault();
            void cycleWindowMode();
        }
    }
</script>

<svelte:window onkeydown={onGlobalKey} />

<div class="shell">
    <!-- Title strip. The window is undecorated, so this is what the user
       grabs to move it. It stays deliberately sparse: a name, and the
       window controls. -->
    <div class="titlebar" data-tauri-drag-region>
        <span class="brand" data-tauri-drag-region>Vavis</span>

        <div class="titlebar-actions">
            <button
                class="chip"
                onclick={() => (paletteOpen = true)}
                title="Commands (Ctrl+K)"
            >
                <Icon name="chevronRight" size={13} />
                <span>Commands</span>
                <kbd>Ctrl K</kbd>
            </button>

            {#if !chatOpen}
                <button class="wb" title="Show chat (Ctrl+B)" onclick={toggleChat}>
                    <Icon name="panelRight" size={15} />
                </button>
            {/if}

            <button class="wb" title="Minimise" onclick={() => appWindow.minimize()}>
                <Icon name="minimise" size={15} />
            </button>
            <button class="wb" title="Window mode (F11)" onclick={cycleWindowMode}>
                <Icon name="maximise" size={15} />
            </button>
            <button class="wb close" title="Close" onclick={() => appWindow.close()}>
                <Icon name="close" size={15} />
            </button>
        </div>
    </div>

    <div class="body">
        <main class="stage">
            {#if chat.view === "code"}
                <CodeView />
            {:else if chat.view === "canvas"}
                <CanvasView />
            {:else if chat.view === "council"}
                <CouncilView />
            {:else}
                <!-- The stage: the reactor, and nothing else. -->
                <Reactor mode={chat.coreState} level={chat.micLevel} />
            {/if}
        </main>

        {#if chatOpen}
            <ChatPanel bind:this={chatPanel} onClose={toggleChat} />
        {/if}
    </div>

    <StatusBar onOpenSettings={() => (chat.panel = "settings")} />
</div>

<!-- Outside `.shell` so it floats over every view rather than being clipped
     by the stage, and above the chat panel it may be dragged across. -->
{#if nowPlaying.visible}
    <SpotifyPanel onClose={() => nowPlaying.dismiss()} />
{/if}

{#if paletteOpen}
    <CommandPalette {commands} onClose={() => (paletteOpen = false)} />
{/if}

<!-- Settings is a window of its own rather than a sheet: fourteen
     categories never fit the shape the other panels use. -->
{#if chat.panel === "settings"}
    <Settings />
{:else if chat.panel !== "none"}
    <Panels />
{/if}

<!-- Both are mounted once, here, and driven by their stores: anything
     anywhere can raise a question or report an outcome without needing
     somewhere of its own on screen to put it. -->
<ConfirmDialog />
<Toasts />

<style>
    .shell {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--bg);
        overflow: hidden;
    }

    /* -- Title strip --------------------------------------------------- */

    .titlebar {
        height: 38px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 var(--sp-2) 0 var(--sp-4);
        /* No border: a line under the title strip boxes the window in. The
       strip is told apart from the stage by its content, not a rule. */
        z-index: 10;
    }

    .brand {
        font-size: var(--text-sm);
        font-weight: 600;
        letter-spacing: 0.01em;
        color: var(--text-muted);
    }

    .titlebar-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-1);
    }

    /* The palette's own affordance. Without it Ctrl+K is a secret, and the
     brief was explicit that nothing should have to be memorised. */
    .chip {
        font-size: var(--text-xs);
        color: var(--text-faint);
        padding: var(--sp-1) var(--sp-2);
        border-radius: var(--r-full);
        margin-right: var(--sp-2);
    }
    .chip kbd {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: var(--text-faint);
        background: var(--surface-hover);
        border-radius: var(--r-sm);
        padding: 1px 5px;
    }

    .wb {
        padding: var(--sp-2);
        color: var(--text-faint);
        border-radius: var(--r-sm);
    }
    .wb:hover {
        color: var(--text);
    }
    .wb.close:hover {
        background: var(--danger);
        color: #fff;
    }

    /* -- Body ---------------------------------------------------------- */

    .body {
        flex: 1;
        display: flex;
        min-height: 0;
    }

    .stage {
        flex: 1;
        position: relative;
        min-width: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
</style>

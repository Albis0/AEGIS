<!--
  The window.

  Layout: a slim draggable title strip, three columns (telemetry, feed,
  core), and the input bar. The window is undecorated, so the strip is
  what the user grabs to move it.
-->
<script lang="ts">
    import {getCurrentWindow} from "@tauri-apps/api/window";
    import {api} from "./lib/api";
    import CodeView from "./lib/CodeView.svelte";
    import CanvasView from "./lib/CanvasView.svelte";
    import CouncilView from "./lib/CouncilView.svelte";
    import Settings from "./lib/Settings.svelte";
    import Message from "./lib/Message.svelte";
    import RightRail from "./lib/RightRail.svelte";
    import Sidebar from "./lib/Sidebar.svelte";
    import {chat} from "./lib/store.svelte";
    import {onMount} from "svelte";

    let feedEl = $state<HTMLElement | null>(null);
    let inputEl = $state<HTMLTextAreaElement | null>(null);
    let atBottom = $state(true);

    const appWindow = getCurrentWindow();

    onMount(() => {
        void chat.start();
        inputEl?.focus();
        return () => chat.stop();
    });

    /**
     * Follows the conversation as it grows — but only if the user is
     * already at the bottom. Yanking the view while they read back is
     * the fastest way to make a chat feel hostile.
     */
    $effect(() => {
        void chat.messages.length;
        void chat.messages[chat.messages.length - 1]?.text;

        if (atBottom && feedEl) {
            queueMicrotask(() => {
                feedEl?.scrollTo({top: feedEl.scrollHeight, behavior: "smooth"});
            });
        }
    });

    function trackScroll() {
        if (!feedEl) return;
        const slack = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight;
        atBottom = slack < 80;
    }

    function submit() {
        void chat.send(chat.input);
        // Reset the height the textarea grew to while typing.
        if (inputEl) inputEl.style.height = "auto";
    }

    function onKeydown(event: KeyboardEvent) {
        // Enter sends; Shift+Enter writes a newline. Multi-line input matters
        // when pasting code or a log.
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
        }
    }

    /** Grows the input up to a limit, then scrolls inside itself. */
    function autoGrow() {
        if (!inputEl) return;
        inputEl.style.height = "auto";
        inputEl.style.height = `${Math.min(inputEl.scrollHeight, 160)}px`;
    }

    async function cycleWindowMode() {
        const order = ["windowed", "borderless", "fullscreen"];
        const current = chat.status?.windowMode ?? "windowed";
        const next = order[(order.indexOf(current) + 1) % order.length];

        // Apply first so the change is instant, then persist.
        //
        // Decorations stay off throughout: the interface draws its own title
        // strip, and turning the OS one back on gives two of them.
        await appWindow.setFullscreen(next === "fullscreen");
        if (next !== "fullscreen") {
            if (next === "borderless") await appWindow.maximize();
            else await appWindow.unmaximize();
        }

        await api.setSetting("windowMode", next);
        await chat.refresh();
    }

    function onGlobalKey(event: KeyboardEvent) {
        // Escape: stop speech first, then close a panel, then a dialog.
        if (event.key === "Escape") {
            if (chat.status?.speaking) {
                void chat.stopSpeaking();
            } else if (chat.approval) {
                void chat.answerApproval("deny");
            } else if (chat.panel !== "none") {
                chat.panel = "none";
            }
            return;
        }

        if (event.ctrlKey && event.key.toLowerCase() === "m") {
            event.preventDefault();
            void chat.cycleVoice();
        }
        if (event.ctrlKey && event.key.toLowerCase() === "l") {
            event.preventDefault();
            void chat.clear();
        }
        if (event.ctrlKey && event.key === ",") {
            event.preventDefault();
            chat.panel = chat.panel === "settings" ? "none" : "settings";
        }
        if (event.key === "F11") {
            event.preventDefault();
            void cycleWindowMode();
        }
    }
</script>

<svelte:window onkeydown={onGlobalKey} />

<div class="shell">
    <!-- Drag strip: the window has no title bar of its own. -->
    <div class="titlebar" data-tauri-drag-region>
        <span class="brand" data-tauri-drag-region>
            VAVIS
            <span class="sub">{chat.status?.assistantName ?? ""}</span>
        </span>

        <div class="window-buttons">
            <button class="wb" title="settings" onclick={() => (chat.panel = chat.panel === "settings" ? "none" : "settings")}>⚙</button>
            <button class="wb" title="minimise" onclick={() => appWindow.minimize()}>—</button>
            <button class="wb" title="window mode (F11)" onclick={cycleWindowMode}>□</button>
            <button class="wb close" title="close" onclick={() => appWindow.close()}>✕</button>
        </div>
    </div>

    <div class="body">
        <Sidebar />

        {#if chat.view === "code"}
            <CodeView />
        {:else if chat.view === "canvas"}
            <CanvasView />
        {:else if chat.view === "council"}
            <CouncilView />
        {:else}
        <main>
            <div class="feed" bind:this={feedEl} onscroll={trackScroll}>
                {#each chat.messages as message (message.id)}
                    <Message {message} />
                {/each}

                {#if chat.messages.length === 0}
                    <div class="welcome">
                        <p>Ready.</p>
                        <p class="dim">
                            Ask anything, or press <kbd>Ctrl</kbd>+<kbd>,</kbd> to set an API key.
                        </p>
                    </div>
                {/if}
            </div>

            {#if !atBottom}
                <button
                    class="jump"
                    onclick={() => {
                        atBottom = true;
                        feedEl?.scrollTo({top: feedEl.scrollHeight, behavior: "smooth"});
                    }}>↓ latest</button
                >
            {/if}

            <div class="composer" class:busy={chat.status?.busy}>
                <span class="prompt" data-state={chat.coreState}>
                    {#if chat.coreState === "thinking"}◈
                    {:else if chat.coreState === "speaking"}♪
                    {:else if chat.coreState === "working"}⚙
                    {:else if chat.coreState === "listening"}◉
                    {:else}❯{/if}
                </span>

                <textarea
                    bind:this={inputEl}
                    bind:value={chat.input}
                    onkeydown={onKeydown}
                    oninput={autoGrow}
                    placeholder={chat.status?.busy ? "waiting for a reply…" : "message…"}
                    rows="1"
                    spellcheck="false"
                ></textarea>

                <!--
                    The microphone sits next to send, the same size, because
                    voice is a primary way to use this and not an afterthought
                    tucked into a corner. The bar under it is the live level:
                    it answers "is it hearing me" while you are still talking,
                    which no amount of status text does.
                -->
                <button
                    class="mic"
                    data-mode={chat.status?.voiceMode ?? "off"}
                    onclick={() => chat.cycleVoice()}
                    title="voice: {chat.status?.voiceMode ?? 'off'} — click to cycle (Ctrl+M)"
                >
                    <span class="mic-glyph">
                        {#if chat.status?.voiceMode === "off"}◌{:else}◉{/if}
                    </span>
                    <span class="level" aria-hidden="true">
                        <span
                            class="level-fill"
                            style:width="{Math.min(chat.micLevel * 100, 100)}%"
                        ></span>
                    </span>
                </button>

                <button class="send" onclick={submit} disabled={!chat.input.trim() || chat.status?.busy} title="send (Enter)">↵</button>
            </div>
        </main>
        {/if}

        <RightRail />
    </div>
</div>

<!-- Settings: a window over the interface rather than a rail panel. Fourteen
     categories never fit in a 260-pixel column. -->
{#if chat.panel === "settings"}
    <Settings />
{/if}

<!--
    Permission requests are answered inline, in the feed — see Message.svelte.
    They used to be a modal here, which stole the keyboard mid-sentence every
    time a destructive tool came up.
-->

<style>
    .shell {
        height: 100%;
        display: flex;
        flex-direction: column;
        /* A faint grid gives the empty space some texture without competing
       with the content. */
        background-image: linear-gradient(rgba(30, 51, 66, 0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 51, 66, 0.25) 1px, transparent 1px);
        background-size: 48px 48px;
    }

    .titlebar {
        height: 34px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 var(--sp-2) 0 var(--sp-4);
        background: rgba(5, 8, 13, 0.9);
        border-bottom: 1px solid var(--border);
    }

    .brand {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        letter-spacing: 0.22em;
        color: var(--cyan);
        text-shadow: var(--glow-cyan);
    }

    .brand .sub {
        margin-left: var(--sp-2);
        letter-spacing: normal;
        color: var(--fg-faint);
        font-size: var(--text-xs);
    }

    .window-buttons {
        display: flex;
        gap: 2px;
    }

    .wb {
        border: none;
        background: transparent;
        color: var(--fg-dim);
        width: 30px;
        height: 24px;
        font-size: var(--text-sm);
        border-radius: 3px;
    }
    .wb:hover {
        background: var(--bg-hover);
        color: var(--cyan-bright);
    }
    .wb.close:hover {
        background: rgba(248, 113, 113, 0.18);
        color: var(--red);
    }

    .body {
        flex: 1;
        display: flex;
        min-height: 0;
    }

    main {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        position: relative;
    }

    .feed {
        flex: 1;
        overflow-y: auto;
        padding: var(--sp-4) var(--sp-5);
        scroll-behavior: smooth;
    }

    .welcome {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--sp-2);
        color: var(--fg-dim);
    }
    .welcome .dim {
        font-size: var(--text-sm);
        color: var(--fg-faint);
    }
    .welcome kbd {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--cyan-dim);
        border: 1px solid var(--border);
        border-radius: 3px;
        padding: 0 4px;
    }

    .jump {
        position: absolute;
        bottom: 78px;
        left: 50%;
        transform: translateX(-50%);
        font-size: var(--text-xs);
        background: var(--bg-panel);
        box-shadow: var(--glow-cyan-soft);
        z-index: 5;
    }

    .composer {
        flex: 0 0 auto;
        display: flex;
        align-items: flex-end;
        gap: var(--sp-2);
        padding: var(--sp-3) var(--sp-4);
        background: rgba(10, 17, 26, 0.92);
        border-top: 1px solid var(--border);
        transition: border-color var(--normal) var(--ease);
    }
    .composer:focus-within {
        border-top-color: var(--cyan-dim);
    }

    .prompt {
        font-family: var(--font-mono);
        font-size: var(--text-lg);
        color: var(--cyan);
        line-height: 1.4;
        flex: 0 0 auto;
    }
    .prompt[data-state="thinking"] {
        color: var(--amber);
        animation: pulse 1.2s ease-in-out infinite;
    }
    .prompt[data-state="speaking"] {
        color: var(--blue);
    }
    .prompt[data-state="listening"] {
        color: var(--cyan-bright);
        animation: pulse 2s ease-in-out infinite;
    }
    .prompt[data-state="working"] {
        color: var(--amber);
    }

    textarea {
        flex: 1;
        resize: none;
        line-height: 1.5;
        max-height: 160px;
        padding: 2px 0;
        font-size: var(--text-base);
    }

    /* ── Microphone ────────────────────────────────────────────────── */

    .mic {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 2px 10px;
        line-height: 1.2;
    }

    .mic-glyph {
        font-size: var(--text-lg);
        color: var(--fg-faint);
    }
    .mic[data-mode="continuous"] .mic-glyph {
        color: var(--cyan-bright);
        text-shadow: var(--glow-cyan);
    }
    .mic[data-mode="wake"] .mic-glyph {
        color: var(--cyan-dim);
    }

    .level {
        display: block;
        width: 20px;
        height: 2px;
        background: var(--border);
        border-radius: 1px;
        overflow: hidden;
    }

    .level-fill {
        display: block;
        height: 100%;
        background: var(--cyan);
        /* Short enough to feel live, long enough not to strobe on every
           audio frame. */
        transition: width 80ms linear;
    }
    /* Off means no signal, so the bar is not merely empty — it is absent. */
    .mic[data-mode="off"] .level {
        opacity: 0.35;
    }

    .send {
        flex: 0 0 auto;
        font-size: var(--text-lg);
        padding: 2px 10px;
        line-height: 1.2;
    }
    .send:disabled {
        opacity: 0.3;
        cursor: default;
    }
    .send:disabled:hover {
        color: var(--fg-dim);
        border-color: var(--border);
        background: transparent;
    }

</style>

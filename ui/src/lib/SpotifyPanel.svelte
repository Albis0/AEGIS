<!--
    Now playing.

    A floating box you can pick up and put anywhere, not a docked rail and not
    an always-on-top window of its own: it belongs to the app, not to the
    desktop, but it should not have to fight the stage for a column either.
    It opens near the left edge, which is the empty side of the layout when
    the chat panel is docked to the right.

    It is deliberately *not* modal and not part of the overlay stack. Nothing
    here has to be answered, so it must never take focus or trap it — you drag
    it out of the way and keep typing.

    Where it sits is remembered per machine in localStorage, kept inside the
    window on every resize, and clamped again on load: a box restored to
    coordinates from a larger monitor would otherwise open off screen with no
    way to reach it.

    Whether it is on screen at all is not this component's business —
    `nowplaying.svelte.ts` polls whether or not the box exists and decides,
    because a panel that only polls while mounted can never be the thing that
    mounts itself. This draws whatever that store found.

    The progress bar is counted forward locally between polls. Asking Spotify
    every second would burn the rate limit for a number we can work out
    ourselves.
-->
<script lang="ts">
    import { api } from "./api";
    import Icon from "./Icon.svelte";
    import { nowPlaying } from "./nowplaying.svelte";
    import { onMount } from "svelte";

    interface Props {
        onClose: () => void;
    }

    const { onClose }: Props = $props();

    /** How often the local progress estimate advances. */
    const TICK_MS = 1000;

    const POSITION_KEY = "vavis.nowPlaying.position";
    const WIDTH = 268;
    /** Kept clear of the title strip above and the status bar below. */
    const TOP_LIMIT = 44;
    const BOTTOM_LIMIT = 32;

    const now = $derived(nowPlaying.track);
    let progress = $state(0);
    let busy = $state(false);

    /** Data URI of the current cover, and the remote URL it came from. */
    let art = $state<string | null>(null);
    let artFor = $state<string | null>(null);

    let box = $state<HTMLElement | null>(null);
    let x = $state(24);
    // Replaced on mount with a bottom-left resting place. Anchoring to the top
    // put the box over whatever header the view on the left happens to have —
    // the file tree's path field, the canvas controls — which is the one part
    // of a side rail you cannot afford to cover.
    let y = $state(96);
    let dragging = $state(false);

    /** Pointer offset within the box when the drag started. */
    let grabX = 0;
    let grabY = 0;

    /** Holds the position inside the window, whatever the window is now. */
    function clamp(nextX: number, nextY: number): [number, number] {
        const height = box?.offsetHeight ?? 180;
        const maxX = Math.max(0, window.innerWidth - WIDTH - 8);
        const maxY = Math.max(TOP_LIMIT, window.innerHeight - height - BOTTOM_LIMIT);
        return [
            Math.min(Math.max(nextX, 8), maxX),
            Math.min(Math.max(nextY, TOP_LIMIT), maxY),
        ];
    }

    // Follows the store's track. Progress is reseeded from every poll, and the
    // cover is fetched only when the track actually changes -- the backend
    // caches it on disk, but the round trip is still worth skipping.
    $effect(() => {
        const fresh = nowPlaying.track;
        if (fresh) progress = fresh.progressMs;

        if (fresh?.albumArt && fresh.albumArt !== artFor) {
            artFor = fresh.albumArt;
            void api
                .spotifyAlbumArt(fresh.albumArt)
                .then((data) => (art = data))
                .catch(() => (art = null));
        } else if (!fresh?.albumArt) {
            art = null;
            artFor = null;
        }
    });

    onMount(() => {
        const saved = localStorage.getItem(POSITION_KEY);
        let restored = false;
        if (saved) {
            try {
                const parsed = JSON.parse(saved) as { x: number; y: number };
                // Clamped on the way in as well as on the way out: a position
                // saved on a larger monitor would open off screen otherwise.
                [x, y] = clamp(parsed.x, parsed.y);
                restored = true;
            } catch {
                // A corrupt entry is not worth reporting; the default stands.
            }
        }

        // Deferred a frame so the box has been laid out and `clamp` can read
        // its real height rather than guessing.
        if (!restored) {
            queueMicrotask(() => ([x, y] = clamp(24, window.innerHeight)));
        }

        const tickTimer = setInterval(() => {
            if (now?.playing) progress = Math.min(progress + TICK_MS, now.durationMs);
        }, TICK_MS);

        const onResize = () => ([x, y] = clamp(x, y));
        window.addEventListener("resize", onResize);

        // The box changes height when a track starts — the idle line is one
        // sentence, a playing track is art, a bar and transport buttons — and
        // anchored near the bottom it would grow straight off the edge. This
        // re-clamps it against its own height rather than the window's alone.
        const observer = new ResizeObserver(onResize);
        if (box) observer.observe(box);

        return () => {
            clearInterval(tickTimer);
            window.removeEventListener("resize", onResize);
            observer.disconnect();
        };
    });

    function startDrag(event: PointerEvent) {
        // Only the header drags, and only with the primary button. Dragging
        // from anywhere would make the transport buttons unclickable.
        if (event.button !== 0) return;

        // The close button lives in the header, and capturing the pointer
        // retargets the rest of the gesture to whatever captured it -- so the
        // click never arrived and the box could not be shut.
        if ((event.target as HTMLElement).closest("button")) return;

        dragging = true;
        grabX = event.clientX - x;
        grabY = event.clientY - y;
        // Captured so the box keeps following the pointer even when it moves
        // faster than the box and leaves it behind.
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }

    function onDrag(event: PointerEvent) {
        if (!dragging) return;
        [x, y] = clamp(event.clientX - grabX, event.clientY - grabY);
    }

    function endDrag(event: PointerEvent) {
        if (!dragging) return;
        dragging = false;
        localStorage.setItem(POSITION_KEY, JSON.stringify({ x, y }));

        // The handle is focusable so it can be moved with the arrow keys, but
        // a pointer drag focuses it too, and Chromium then treats that as
        // keyboard focus and paints the ring. Dropping focus after a drag
        // leaves the keyboard route intact without the ring following the
        // pointer around.
        (event.currentTarget as HTMLElement | null)?.blur();
    }

    /** Moves the box with the keyboard, for anyone not using a pointer. */
    function nudge(event: KeyboardEvent) {
        const step = event.shiftKey ? 24 : 8;
        const moves: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
        };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        [x, y] = clamp(x + move[0], y + move[1]);
        localStorage.setItem(POSITION_KEY, JSON.stringify({ x, y }));
    }

    /** Milliseconds as m:ss. */
    function clock(ms: number): string {
        const total = Math.floor(ms / 1000);
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    const percent = $derived(
        now && now.durationMs > 0 ? (progress / now.durationMs) * 100 : 0,
    );

    /** Runs a transport command, then re-reads rather than guessing the result. */
    async function control(action: "play" | "pause" | "next" | "previous") {
        if (busy) return;
        busy = true;
        try {
            await api.spotifyControl(action);
        } catch {
            // Premium-only, or no active device. The box is ambient; the error
            // belongs in a conversation, not blinking here.
        } finally {
            busy = false;
            // Spotify needs a moment to settle before it reports the new state.
            nowPlaying.refreshSoon();
        }
    }
</script>

<section
    class="np"
    class:dragging
    bind:this={box}
    style:left="{x}px"
    style:top="{y}px"
    style:width="{WIDTH}px"
    aria-label="Now playing"
>
    <!-- The drag handle. A header rather than the whole box, so the transport
         buttons underneath stay clickable. -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <header
        onpointerdown={startDrag}
        onpointermove={onDrag}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        onkeydown={nudge}
        role="toolbar"
        tabindex="0"
        aria-label="Move the now playing box with the arrow keys"
    >
        <span class="grip" aria-hidden="true"></span>
        <span class="label">Now playing</span>
        <button class="close" onclick={onClose} aria-label="Hide">
            <Icon name="close" size={13} />
        </button>
    </header>

    {#if now}
        <div class="row">
            {#if art}
                <img class="art" src={art} alt="" />
            {:else}
                <div class="art placeholder">♪</div>
            {/if}

            <div class="meta">
                <div class="track" title={now.track}>{now.track}</div>
                <div class="artist" title={now.artist}>{now.artist}</div>
                {#if now.device}
                    <div class="device" title={now.device}>{now.device}</div>
                {/if}
            </div>
        </div>

        <div
            class="bar"
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Progress"
        >
            <div class="fill" style:width="{percent}%"></div>
        </div>

        <div class="times">
            <span>{clock(progress)}</span>
            <span>{clock(now.durationMs)}</span>
        </div>

        <div class="controls">
            <button aria-label="Previous" onclick={() => control("previous")}>
                ⏮
            </button>
            <button
                class="play"
                aria-label={now.playing ? "Pause" : "Play"}
                onclick={() => control(now?.playing ? "pause" : "play")}
            >
                {now.playing ? "⏸" : "▶"}
            </button>
            <button aria-label="Next" onclick={() => control("next")}>⏭</button>
        </div>
    {:else}
        <p class="idle">
            Nothing playing. Start something in Spotify, or ask for a track by
            name.
        </p>
    {/if}
</section>

<style>
    .np {
        position: fixed;
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        padding: 0 var(--sp-3) var(--sp-3);
        background: var(--surface-raised);
        border: 1px solid var(--line-strong);
        border-radius: var(--r-lg);
        box-shadow: var(--shadow-lg);
        /* Above the stage and the chat panel, below every modal layer: a
           dialog that opens must cover this, not sit behind it. */
        z-index: 30;
        animation: fade-up var(--normal) var(--ease);
    }

    /* The shadow lifts while it is being carried, and the transition is
       dropped so the box tracks the pointer exactly. */
    .np.dragging {
        box-shadow:
            var(--shadow-lg),
            0 0 0 1px var(--accent-line);
        user-select: none;
    }

    header {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        padding: var(--sp-2) 0;
        cursor: grab;
        touch-action: none;
    }
    .np.dragging header {
        cursor: grabbing;
    }

    /* Two short rules, the universal "pick this up" mark. */
    .grip {
        width: 12px;
        height: 8px;
        flex: 0 0 auto;
        background-image: linear-gradient(
            var(--text-faint) 1px,
            transparent 1px
        );
        background-size: 100% 3px;
        opacity: 0.7;
    }

    .label {
        flex: 1;
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--text-faint);
        white-space: nowrap;
    }

    .close {
        padding: var(--sp-1);
        color: var(--text-faint);
        flex: 0 0 auto;
    }

    .row {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        min-width: 0;
    }

    .art {
        width: 52px;
        height: 52px;
        border-radius: var(--r-sm);
        object-fit: cover;
        flex: 0 0 auto;
    }

    .placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface-sunken);
        color: var(--text-faint);
        font-size: 20px;
    }

    .meta {
        flex: 1;
        min-width: 0;
    }

    /* The box is narrow; long titles must clip rather than widen it. */
    .track,
    .artist,
    .device {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .track {
        font-size: var(--text-sm);
        font-weight: 500;
        color: var(--text);
    }

    .artist {
        font-size: var(--text-xs);
        color: var(--text-muted);
    }

    .device {
        font-size: var(--text-xs);
        color: var(--text-faint);
    }

    .bar {
        height: 3px;
        background: var(--surface-sunken);
        border-radius: var(--r-full);
        overflow: hidden;
    }

    .fill {
        height: 100%;
        background: var(--accent);
        border-radius: var(--r-full);
        /* Matches the local tick, so the bar creeps rather than stepping. */
        transition: width 1s linear;
    }

    .times {
        display: flex;
        justify-content: space-between;
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-faint);
        margin-top: calc(-1 * var(--sp-1));
    }

    .controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--sp-2);
    }

    .controls button {
        padding: var(--sp-1) var(--sp-2);
        font-size: var(--text-base);
        color: var(--text-muted);
        line-height: 1;
    }
    .controls button:hover:not(:disabled) {
        color: var(--text);
    }

    /* The one control anybody reaches for without looking gets a target. */
    .play {
        width: 34px;
        height: 34px;
        justify-content: center;
        border-radius: var(--r-full);
        background: var(--surface-active);
    }

    .idle {
        font-size: var(--text-sm);
        color: var(--text-faint);
        line-height: 1.55;
        padding-bottom: var(--sp-1);
    }
</style>

<!--
    Now playing.

    A panel inside the app, not an always-on-top window of its own: it belongs
    to the conversation, not to the desktop. It appears when something starts
    playing and disappears when it stops.

    The progress bar is counted forward locally between polls. Asking Spotify
    every second would burn the rate limit for a number we can work out
    ourselves.
-->
<script lang="ts">
    import { api, type SpotifyNowPlaying } from "./api";
    import { onMount } from "svelte";

    /** How often Spotify is actually asked. */
    const POLL_MS = 4000;
    /** How often the local progress estimate advances. */
    const TICK_MS = 1000;

    let now = $state<SpotifyNowPlaying | null>(null);
    let progress = $state(0);
    let busy = $state(false);

    /** Data URI of the current cover, and the remote URL it came from. */
    let art = $state<string | null>(null);
    let artFor = $state<string | null>(null);

    async function poll() {
        try {
            const fresh = await api.spotifyNowPlaying();
            now = fresh;
            if (fresh) progress = fresh.progressMs;

            // Fetch the cover only when the track actually changes; the backend
            // caches it on disk, but the round trip is still worth skipping.
            if (fresh?.albumArt && fresh.albumArt !== artFor) {
                artFor = fresh.albumArt;
                art = await api.spotifyAlbumArt(fresh.albumArt).catch(() => null);
            } else if (!fresh?.albumArt) {
                art = null;
                artFor = null;
            }
        } catch {
            // Not connected, or Spotify is unreachable. The panel simply hides
            // rather than shouting about it — this is ambient, not a task.
            now = null;
        }
    }

    onMount(() => {
        void poll();
        const pollTimer = setInterval(() => void poll(), POLL_MS);
        const tickTimer = setInterval(() => {
            if (now?.playing) progress = Math.min(progress + TICK_MS, now.durationMs);
        }, TICK_MS);

        return () => {
            clearInterval(pollTimer);
            clearInterval(tickTimer);
        };
    });

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
            // Premium-only, or no active device. The panel is ambient; the error
            // belongs in a conversation, not blinking here.
        } finally {
            busy = false;
            // Spotify needs a moment to settle before it reports the new state.
            setTimeout(() => void poll(), 400);
        }
    }
</script>

{#if now}
    {@const isPlaying = now.playing}
    <section class="np">
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
                    <div class="device">{now.device}</div>
                {/if}
            </div>
        </div>

        <div class="bar" role="progressbar" aria-valuenow={percent}>
            <div class="fill" style="width: {percent}%"></div>
        </div>

        <div class="times">
            <span>{clock(progress)}</span>
            <span>{clock(now.durationMs)}</span>
        </div>

        <div class="controls">
            <button title="previous" onclick={() => control("previous")}>⏮</button>
            <button
                title={isPlaying ? "pause" : "play"}
                onclick={() => control(isPlaying ? "pause" : "play")}
            >
                {isPlaying ? "⏸" : "▶"}
            </button>
            <button title="next" onclick={() => control("next")}>⏭</button>
        </div>
    </section>
{/if}

<style>
    .np {
        display: flex;
        flex-direction: column;
        gap: var(--sp-1);
        padding: var(--sp-2);
        background: var(--surface-raised);
        border: 1px solid var(--line);
        border-radius: var(--r-md);
        min-width: 0;
    }

    .row {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        min-width: 0;
    }

    .art {
        width: 40px;
        height: 40px;
        border-radius: 3px;
        object-fit: cover;
        flex: 0 0 auto;
    }

    .placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface-sunken);
        color: var(--accent-line);
        font-size: 18px;
    }

    .meta {
        flex: 1;
        min-width: 0;
    }

    /* The rail is narrow; long titles must clip rather than push the layout. */
    .track,
    .artist,
    .device {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .track {
        font-size: var(--text-xs);
        color: var(--text);
    }

    .artist {
        font-size: 10px;
        color: var(--text-muted);
    }

    .device {
        font-size: 10px;
        color: var(--accent-line);
    }

    .bar {
        height: 2px;
        background: var(--surface-sunken);
        border-radius: 1px;
        overflow: hidden;
    }

    .fill {
        height: 100%;
        background: var(--accent);
        transition: width 1s linear;
    }

    .times {
        display: flex;
        justify-content: space-between;
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-faint);
    }

    .controls {
        display: flex;
        justify-content: center;
        gap: var(--sp-2);
    }

    .controls button {
        border: none;
        padding: 1px 5px;
        font-size: var(--text-xs);
        color: var(--text-muted);
        background: none;
    }
    .controls button:hover {
        color: var(--accent);
    }
</style>

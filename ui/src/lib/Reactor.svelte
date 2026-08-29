<!--
  The reactor, mounted.

  This component owns the lifetime of the WebGL context and translates
  assistant state into the reactor's drive values. The 3D work itself lives
  in `reactor.ts`, which knows nothing about the app.

  The mapping below is the whole vocabulary of the visual: hue says what kind
  of thing is happening, speed says how hard it is working, and the pulse
  says it is talking. It is deliberately small -- a state you cannot name at
  a glance is a state that communicates nothing.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { createReactor, type Reactor } from "./reactor";
  import type { CoreState } from "./store.svelte";

  interface Props {
    /**
     * What the assistant is doing.
     *
     * Called `mode` rather than `state` because a binding named `state`
     * shadows the `$state` rune, and Svelte then reads `$state(...)` in
     * this file as a store subscription rather than a rune.
     */
    mode: CoreState;
    /** Live microphone level, 0-1. Spikes the core while speaking to it. */
    level?: number;
  }

  const { mode, level = 0 }: Props = $props();

  let host = $state<HTMLDivElement | null>(null);
  let reactor: Reactor | null = null;
  /** Set when WebGL is unavailable, so the fallback can take over. */
  let failed = $state(false);

  /**
   * How each state looks.
   *
   * `spin` is revolutions per second. Thinking runs backwards on purpose:
   * reversal is legible at a glance in a way that a speed change is not,
   * and thinking is the state the user most needs to recognise instantly.
   */
  const LOOK: Record<CoreState, { spin: number; glow: number; hue: number }> = {
    idle: { spin: 0.045, glow: 0.72, hue: 205 },
    listening: { spin: 0.16, glow: 1.15, hue: 190 },
    thinking: { spin: -0.34, glow: 1.35, hue: 38 },
    working: { spin: 0.42, glow: 1.25, hue: 265 },
    speaking: { spin: 0.13, glow: 1.4, hue: 210 },
  };

  onMount(() => {
    if (!host) return;
    try {
      reactor = createReactor(host);
    } catch (error) {
      // Software rendering, a driver reset, or a WebView2 without GPU
      // access. The interface must still work, so fall back rather than
      // leaving a blank hole in the middle of the window.
      console.error("reactor failed to start", error);
      failed = true;
    }
    return () => reactor?.dispose();
  });

  // Push state into the reactor. Its loop reads these every frame and eases
  // toward them, so assigning is enough -- there is nothing to animate here.
  $effect(() => {
    if (!reactor) return;
    const look = LOOK[mode];
    reactor.drive.spin = look.spin;
    reactor.drive.glow = look.glow;
    reactor.drive.hue = look.hue;
    reactor.drive.pulse = mode === "speaking" ? 1 : 0;
    reactor.drive.level = level;
  });
</script>

<div class="stage" aria-hidden="true">
  <div class="host" bind:this={host}></div>

  {#if failed}
    <!-- No WebGL: a plain CSS ring, so the centre of the window is still
         something rather than nothing. -->
    <div class="fallback" data-state={mode}></div>
  {/if}
</div>

<style>
  .stage {
    position: absolute;
    inset: 0;
    /* Not a centring grid: the canvas is full-bleed and centres the reactor
       itself through the camera. A grid would size the host to its content
       and leave the canvas as a box in the middle of the stage. */
    display: block;
    /* Purely decorative: it must never eat a click meant for the stage
       behind it. */
    pointer-events: none;
  }

  /* The canvas fills the whole stage rather than being a square in the
     middle of it. The reactor paints its own background (the bloom pass
     cannot preserve transparency), so anything less than full bleed shows
     as a visible box against the page. How large the reactor appears is set
     by the camera distance in `reactor.ts`, not by this element. */
  .host {
    width: 100%;
    height: 100%;
  }

  .fallback {
    position: absolute;
    top: 50%;
    left: 50%;
    margin: -110px 0 0 -110px;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    border: 2px solid var(--accent-line);
    border-top-color: var(--accent);
    animation: spin 8s linear infinite;
  }
  .fallback[data-state="thinking"] {
    animation-duration: 2.4s;
    animation-direction: reverse;
  }
  .fallback[data-state="working"] {
    animation-duration: 1.6s;
  }
</style>

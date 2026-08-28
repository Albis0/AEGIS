<!--
  The energy core.

  Shows what the assistant is doing without asking the user to read
  anything: it breathes when idle, flares while listening, spins backwards
  with sparks while thinking, and pushes out waves while speaking.

  Drawn as SVG with CSS animation rather than a canvas loop — the browser
  compositor handles it on the GPU, so it costs nothing while the app is
  otherwise idle, and it stays sharp at any scale.
-->
<script lang="ts">
  import type { CoreState } from "./store.svelte";

  interface Props {
    state: CoreState;
    size?: number;
  }

  const { state, size = 160 }: Props = $props();

  /** Ring dash patterns, chosen so the gaps read as machined segments. */
  const OUTER_DASH = "14 8";
  const MIDDLE_DASH = "22 14";

  // Speed and colour come from the state. Keeping them in one place makes
  // the mapping easy to read and to tune.
  const config = $derived(
    {
      idle: { spin: 40, pulse: 4, colour: "var(--cyan-dim)" },
      listening: { spin: 16, pulse: 1.6, colour: "var(--cyan-bright)" },
      thinking: { spin: -7, pulse: 1.1, colour: "var(--amber)" },
      speaking: { spin: 11, pulse: 0.9, colour: "var(--blue)" },
      working: { spin: 5, pulse: 1.3, colour: "var(--cyan)" },
    }[state],
  );
</script>

<div
  class="core"
  style:--size="{size}px"
  style:--spin="{Math.abs(config.spin)}s"
  style:--spin-dir={config.spin < 0 ? "reverse" : "normal"}
  style:--pulse="{config.pulse}s"
  style:--core-colour={config.colour}
  data-state={state}
>
  <svg viewBox="0 0 200 200" aria-hidden="true">
    <!-- Outer ring: slow, many segments -->
    <circle
      class="ring outer"
      cx="100"
      cy="100"
      r="92"
      stroke-dasharray={OUTER_DASH}
    />

    <!-- Middle ring: counter-rotating -->
    <circle
      class="ring middle"
      cx="100"
      cy="100"
      r="72"
      stroke-dasharray={MIDDLE_DASH}
    />

    <!-- Inner ring: solid, pulses with the state -->
    <circle class="ring inner" cx="100" cy="100" r="54" />

    <!-- Rays from the core -->
    <g class="rays">
      {#each Array(8) as _, i}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="52"
          transform="rotate({i * 45} 100 100)"
        />
      {/each}
    </g>

    <!-- The core itself -->
    <circle class="orb-glow" cx="100" cy="100" r="34" />
    <circle class="orb" cx="100" cy="100" r="22" />
    <circle class="orb-hot" cx="100" cy="100" r="11" />

    <!-- Sparks, only while thinking -->
    {#if state === "thinking"}
      <g class="sparks">
        {#each Array(5) as _, i}
          <circle
            class="spark"
            cx="100"
            cy="42"
            r="3"
            style:--delay="{i * 0.4}s"
            style:--orbit="{i * 72}deg"
          />
        {/each}
      </g>
    {/if}

    <!-- Waves, only while speaking -->
    {#if state === "speaking"}
      <g class="waves">
        {#each Array(3) as _, i}
          <circle
            class="wave"
            cx="100"
            cy="100"
            r="60"
            style:--delay="{i * 0.6}s"
          />
        {/each}
      </g>
    {/if}
  </svg>
</div>

<style>
  .core {
    width: var(--size);
    height: var(--size);
    position: relative;
    filter: drop-shadow(0 0 20px color-mix(in srgb, var(--core-colour) 35%, transparent));
    transition: filter var(--normal) var(--ease);
  }

  svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .ring {
    fill: none;
    stroke: var(--core-colour);
    transform-origin: 100px 100px;
  }

  .outer {
    stroke-width: 2;
    opacity: 0.45;
    animation: spin var(--spin) linear infinite var(--spin-dir);
  }

  .middle {
    stroke-width: 2.5;
    opacity: 0.65;
    /* Counter-rotation: the two rings moving against each other is what
       makes the thing read as machinery rather than a loading spinner. */
    animation: spin calc(var(--spin) * 0.7) linear infinite
      var(--spin-dir, normal);
    animation-direction: reverse;
  }

  .inner {
    stroke-width: 1.5;
    opacity: 0.8;
    animation: breathe var(--pulse) ease-in-out infinite;
  }

  .rays line {
    stroke: var(--core-colour);
    stroke-width: 1.5;
    opacity: 0.3;
    transform-origin: 100px 100px;
  }

  .rays {
    transform-origin: 100px 100px;
    animation: spin calc(var(--spin) * 2.5) linear infinite;
  }

  .orb-glow {
    fill: var(--core-colour);
    opacity: 0.18;
    animation: breathe var(--pulse) ease-in-out infinite;
  }

  .orb {
    fill: var(--core-colour);
    opacity: 0.85;
  }

  .orb-hot {
    fill: var(--cyan-bright);
    animation: breathe calc(var(--pulse) * 0.6) ease-in-out infinite;
  }

  .spark {
    fill: var(--amber);
    transform-origin: 100px 100px;
    animation: orbit 2.4s linear infinite;
    animation-delay: var(--delay);
    transform: rotate(var(--orbit));
  }

  .wave {
    fill: none;
    stroke: var(--core-colour);
    stroke-width: 2;
    transform-origin: 100px 100px;
    animation: ripple 1.8s ease-out infinite;
    animation-delay: var(--delay);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes breathe {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }

  @keyframes orbit {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes ripple {
    from {
      transform: scale(0.9);
      opacity: 0.6;
    }
    to {
      transform: scale(1.6);
      opacity: 0;
    }
  }
</style>

<!--
  The canvas interface — image and video generation.

  A separate interface rather than a chat feature, for one reason: twenty
  variations in a message feed destroy the feed. Here the results stay in a
  grid, the prompt stays in one place, and nothing scrolls away.

  Everything a result was made with is kept next to it. A picture you liked is
  worth nothing if you cannot make it again, so seed, model, size and prompt
  all come back with the tile — and when a provider gave no seed, the detail
  panel says the result cannot be repeated exactly rather than pretending.
-->
<script lang="ts">
  import {
    api,
    on,
    type CanvasDoneEvent,
    type CanvasSettings,
    type GalleryItem,
  } from "./api";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { onMount } from "svelte";

  type Kind = "image" | "video";

  /** Named sizes, so nobody has to remember what 1536×640 is for. */
  const SIZES: [string, number, number][] = [
    ["square", 1024, 1024],
    ["landscape", 1536, 1024],
    ["portrait", 1024, 1536],
    ["wide", 1920, 1080],
    ["tall", 1080, 1920],
  ];

  let settings = $state<CanvasSettings | null>(null);
  let items = $state<GalleryItem[]>([]);

  let prompt = $state("");
  let negative = $state("");
  let kind = $state<Kind>("image");
  let sizeIndex = $state(0);
  let count = $state(1);
  let seedText = $state("");
  let model = $state("");
  let duration = $state(5);
  let strength = $state(0.6);

  /** The result being continued from, if any. */
  let source = $state<GalleryItem | null>(null);
  /** The result open in the detail panel. */
  let open = $state<GalleryItem | null>(null);

  let busy = $state(false);
  let notice = $state("");
  let elapsed = $state(0);

  const size = $derived(SIZES[sizeIndex] ?? SIZES[0]);
  const canGo = $derived(
    !busy &&
      prompt.trim().length > 0 &&
      (kind === "image" ? settings?.canImage : settings?.canVideo),
  );

  onMount(() => {
    void refresh();

    const listeners = Promise.all([
      on<CanvasDoneEvent>("canvas:done", (payload) => {
        busy = false;
        // Newest first, matching the order the backend lists them in.
        items = [...payload.items.slice().reverse(), ...items];
        notice = payload.notes.length
          ? `${payload.provider} · ${payload.notes.join(" · ")}`
          : `${payload.provider}`;
        void loadSettings();
      }),
      on<{ message: string }>("canvas:error", (payload) => {
        busy = false;
        notice = payload.message;
      }),
    ]);

    // A generation has no progress to report, so the elapsed seconds are the
    // only honest signal that something is still happening.
    const timer = setInterval(() => {
      if (busy) elapsed += 1;
    }, 1000);

    return () => {
      void listeners.then((offs) => offs.forEach((off) => off()));
      clearInterval(timer);
    };
  });

  async function loadSettings() {
    try {
      settings = await api.canvasSettings();
      if (!model && settings) {
        model = kind === "video" ? settings.videoModel : settings.imageModel;
      }
    } catch (e) {
      notice = String(e);
    }
  }

  async function refresh() {
    await loadSettings();
    try {
      items = await api.listGallery(300);
    } catch (e) {
      notice = String(e);
    }
  }

  async function generate(options: { upscale?: boolean } = {}) {
    if (busy) return;
    busy = true;
    elapsed = 0;
    notice = options.upscale ? "enlarging…" : "generating…";

    const parsedSeed = seedText.trim() === "" ? null : Number(seedText.trim());

    try {
      await api.canvasGenerate({
        prompt: prompt.trim(),
        kind,
        model: model.trim(),
        width: size[1],
        height: size[2],
        count,
        seed: Number.isFinite(parsedSeed) ? parsedSeed : null,
        negative: negative.trim(),
        durationSecs: duration,
        fromId: source?.id ?? null,
        strength,
        upscale: options.upscale ?? false,
      });
    } catch (e) {
      busy = false;
      notice = String(e);
    }
  }

  /** Sets up a variation: same prompt and settings, that image as the start. */
  function variationOf(item: GalleryItem) {
    source = item;
    kind = "image";
    prompt = item.prompt;
    open = null;
    notice = "continuing from that result — adjust the prompt and go";
  }

  /** Sets up an animation with the image as the first frame. */
  function animate(item: GalleryItem) {
    source = item;
    kind = "video";
    prompt = item.prompt;
    open = null;
    notice = settings?.canVideo
      ? "that image will be the first frame"
      : "no video provider has a key yet — add one in settings";
  }

  async function enlarge(item: GalleryItem) {
    source = item;
    open = null;
    await generate({ upscale: true });
  }

  /** Loads a result's exact parameters back into the form. */
  function reuse(item: GalleryItem) {
    prompt = item.prompt;
    model = item.model;
    seedText = item.seed === null ? "" : String(item.seed);
    kind = item.kind;
    source = null;

    const params = readParams(item);
    const found = SIZES.findIndex(([, w, h]) => `${w}x${h}` === params.size);
    if (found >= 0) sizeIndex = found;
    negative = params.negative ?? "";

    open = null;
    notice = item.seed === null
      ? "loaded — no seed was recorded, so this will not repeat exactly"
      : "loaded — same seed, same result";
  }

  function readParams(item: GalleryItem): Record<string, string> {
    try {
      return JSON.parse(item.params);
    } catch {
      return {};
    }
  }

  async function remove(item: GalleryItem) {
    if (!confirm("Delete this permanently?")) return;
    try {
      await api.deleteGalleryItem(item.id);
      items = items.filter((i) => i.id !== item.id);
      if (open?.id === item.id) open = null;
      if (source?.id === item.id) source = null;
      void loadSettings();
    } catch (e) {
      notice = String(e);
    }
  }

  async function toggleFavourite(item: GalleryItem) {
    const next = !item.favourite;
    try {
      await api.favouriteGalleryItem(item.id, next);
      items = items.map((i) => (i.id === item.id ? { ...i, favourite: next } : i));
      if (open?.id === item.id) open = { ...open, favourite: next };
    } catch (e) {
      notice = String(e);
    }
  }

  async function clearAll() {
    if (!confirm("Delete everything except starred results?")) return;
    try {
      const freed = await api.clearGallery(true);
      notice = `freed ${bytes(freed)}`;
      await refresh();
    } catch (e) {
      notice = String(e);
    }
  }

  function bytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function src(item: GalleryItem): string {
    return convertFileSrc(item.path);
  }

  function when(seconds: number): string {
    return new Date(seconds * 1000).toLocaleString();
  }
</script>

<div class="canvas">
  <aside class="controls">
    <div class="kinds">
      <button class:active={kind === "image"} onclick={() => (kind = "image")}>
        image
      </button>
      <button
        class:active={kind === "video"}
        disabled={!settings?.canVideo}
        title={settings?.canVideo ? "" : "needs a video provider key"}
        onclick={() => (kind = "video")}
      >
        video
      </button>
    </div>

    {#if source}
      <div class="source">
        <img src={src(source)} alt="" />
        <div class="source-text">
          <span>continuing from #{source.id}</span>
          <button class="tiny" onclick={() => (source = null)}>drop</button>
        </div>
      </div>
    {/if}

    <textarea
      bind:value={prompt}
      class="prompt"
      rows="5"
      placeholder="what should it look like?"
      onkeydown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          if (canGo) void generate();
        }
      }}
    ></textarea>

    <input
      bind:value={negative}
      class="field"
      placeholder="what to avoid (optional)"
    />

    <div class="row">
      <label for="canvas-size">size</label>
      <select id="canvas-size" bind:value={sizeIndex}>
        {#each SIZES as [label, w, h], i (label)}
          <option value={i}>{label} · {w}×{h}</option>
        {/each}
      </select>
    </div>

    {#if kind === "image"}
      <div class="row">
        <label for="canvas-count">how many</label>
        <input
          id="canvas-count"
          type="number"
          min="1"
          max="8"
          bind:value={count}
        />
      </div>
    {:else}
      <div class="row">
        <label for="canvas-duration">seconds</label>
        <input
          id="canvas-duration"
          type="number"
          min="1"
          max="60"
          bind:value={duration}
        />
      </div>
    {/if}

    <div class="row">
      <label for="canvas-seed">seed</label>
      <input
        id="canvas-seed"
        bind:value={seedText}
        placeholder="random"
        title="Leave empty to let the provider choose. The one it used is saved with the result."
      />
    </div>

    {#if source && kind === "image"}
      <div class="row">
        <label for="canvas-strength">drift</label>
        <input
          id="canvas-strength"
          type="range"
          min="0"
          max="1"
          step="0.05"
          bind:value={strength}
        />
        <span class="value">{strength.toFixed(2)}</span>
      </div>
    {/if}

    <div class="row">
      <label for="canvas-model">model</label>
      <input
        id="canvas-model"
        bind:value={model}
        placeholder="provider default"
      />
    </div>

    <button class="go" disabled={!canGo} onclick={() => generate()}>
      {#if busy}
        working… {elapsed}s
      {:else}
        generate
      {/if}
    </button>

    {#if notice}
      <p class="notice">{notice}</p>
    {/if}

    {#if settings && !settings.canImage}
      <p class="warn">
        No image provider has a key. Add one in settings — OpenAI, Stability,
        Replicate, or your own endpoint.
      </p>
    {/if}

    <div class="usage">
      <span>{settings?.items ?? 0} results · {bytes(settings?.bytes ?? 0)}</span>
      <div class="usage-actions">
        <button class="tiny" onclick={() => api.openMediaFolder()}>folder</button>
        <button class="tiny" onclick={clearAll}>clear</button>
      </div>
    </div>
  </aside>

  <main class="grid-pane">
    {#if items.length === 0}
      <p class="empty">Nothing generated yet. Results stay here.</p>
    {:else}
      <div class="grid">
        {#each items as item (item.id)}
          <button class="tile" onclick={() => (open = item)}>
            {#if item.kind === "video"}
              <!-- Muted and loopable: a grid of talking videos is unusable. -->
              <video src={src(item)} muted loop playsinline preload="metadata"
              ></video>
              <span class="badge">▶</span>
            {:else}
              <img src={src(item)} alt={item.prompt} loading="lazy" />
            {/if}
            {#if item.favourite}<span class="star">★</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
  </main>

  {#if open}
    {@const params = readParams(open)}
    {@const current = open}
    <aside class="detail">
      <div class="detail-head">
        <span class="detail-title">#{current.id}</span>
        <button class="tiny" onclick={() => (open = null)}>close</button>
      </div>

      <div class="preview">
        {#if current.kind === "video"}
          <!-- No caption track exists: this video was generated seconds ago
               and has no dialogue to caption. -->
          <!-- svelte-ignore a11y_media_has_caption -->
          <video src={src(current)} controls loop></video>
        {:else}
          <img src={src(current)} alt={current.prompt} />
        {/if}
      </div>

      <p class="detail-prompt">{current.prompt}</p>

      <dl class="facts">
        <dt>provider</dt>
        <dd>{current.provider}</dd>
        <dt>model</dt>
        <dd>{current.model || "default"}</dd>
        <dt>seed</dt>
        <dd class:missing={current.seed === null}>
          {current.seed ?? "not reported — cannot be repeated exactly"}
        </dd>
        <dt>size</dt>
        <dd>{current.width}×{current.height}</dd>
        <dt>file</dt>
        <dd>{bytes(current.bytes)}</dd>
        {#if params.negative}
          <dt>avoided</dt>
          <dd>{params.negative}</dd>
        {/if}
        {#if current.parentId !== null}
          <dt>from</dt>
          <dd>#{current.parentId}</dd>
        {/if}
        <dt>made</dt>
        <dd>{when(current.createdAt)}</dd>
      </dl>

      <div class="detail-actions">
        <button onclick={() => reuse(current)}>same settings</button>
        {#if current.kind === "image"}
          <button onclick={() => variationOf(current)}>variation</button>
          <button
            disabled={!settings?.canVideo}
            title={settings?.canVideo ? "" : "needs a video provider key"}
            onclick={() => animate(current)}
          >
            animate
          </button>
          <button
            disabled={!settings?.canUpscale || busy}
            title={settings?.canUpscale
              ? "four times the size, same picture"
              : "needs a Stability or Replicate key"}
            onclick={() => enlarge(current)}
          >
            enlarge
          </button>
        {/if}
        <button onclick={() => toggleFavourite(current)}>
          {current.favourite ? "unstar" : "star"}
        </button>
        <button class="danger" onclick={() => remove(current)}>delete</button>
      </div>
    </aside>
  {/if}
</div>

<style>
  .canvas {
    display: flex;
    flex: 1;
    min-height: 0;
    min-width: 0;
  }

  .controls {
    width: 260px;
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-3);
    border-right: 1px solid var(--line);
    overflow-y: auto;
  }

  .kinds {
    display: flex;
    gap: var(--sp-1);
  }
  .kinds button {
    flex: 1;
    font-size: var(--text-xs);
    padding: 3px;
  }
  .kinds button.active {
    color: var(--accent-hover);
    border-color: var(--accent-line);
    background: var(--surface-hover);
  }

  .source {
    display: flex;
    gap: var(--sp-2);
    align-items: center;
    padding: var(--sp-1);
    border: 1px solid var(--accent-line);
    border-radius: var(--r-md);
  }
  .source img {
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: 3px;
  }
  .source-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    font-size: 10px;
    color: var(--text-muted);
  }

  .prompt,
  .field,
  .row input,
  .row select {
    background: var(--surface-sunken);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: var(--sp-1);
    font-size: var(--text-xs);
    color: var(--text);
    font-family: inherit;
    width: 100%;
    min-width: 0;
  }

  .prompt {
    resize: vertical;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .row label {
    flex: 0 0 58px;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .row .value {
    flex: 0 0 auto;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--accent);
  }

  .go {
    margin-top: var(--sp-1);
    padding: var(--sp-2);
    font-size: var(--text-xs);
    color: var(--accent-hover);
    border-color: var(--accent-line);
  }
  .go:disabled {
    color: var(--text-faint);
    border-color: var(--line);
  }

  .notice,
  .warn,
  .empty {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin: 0;
  }
  .warn {
    color: var(--warning);
  }
  .empty {
    padding: var(--sp-4);
    color: var(--text-faint);
  }

  .usage {
    margin-top: auto;
    padding-top: var(--sp-2);
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    font-size: 10px;
    color: var(--text-faint);
  }
  .usage-actions {
    display: flex;
    gap: var(--sp-1);
  }

  .grid-pane {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: var(--sp-3);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--sp-2);
  }

  .tile {
    position: relative;
    aspect-ratio: 1;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    overflow: hidden;
    background: var(--surface-sunken);
  }
  .tile:hover {
    border-color: var(--accent-line);
  }
  .tile img,
  .tile video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .badge,
  .star {
    position: absolute;
    top: 4px;
    font-size: 11px;
    text-shadow: 0 0 4px #000;
  }
  .badge {
    left: 6px;
    color: var(--accent-hover);
  }
  .star {
    right: 6px;
    color: var(--warning);
  }

  .detail {
    width: 300px;
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-3);
    border-left: 1px solid var(--line);
    overflow-y: auto;
  }

  .detail-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .detail-title {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--accent);
  }

  .preview img,
  .preview video {
    width: 100%;
    border-radius: var(--r-md);
    display: block;
  }

  .detail-prompt {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text);
  }

  .facts {
    display: grid;
    grid-template-columns: 58px 1fr;
    gap: 2px var(--sp-2);
    margin: 0;
    font-size: 10px;
  }
  .facts dt {
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .facts dd {
    margin: 0;
    color: var(--text-muted);
    font-family: var(--font-mono);
    word-break: break-word;
  }
  .facts dd.missing {
    color: var(--warning);
    font-family: inherit;
  }

  .detail-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1);
  }
  .detail-actions button {
    font-size: 10px;
    padding: 2px 8px;
  }
  .detail-actions .danger {
    color: var(--warning);
    border-color: rgba(245, 158, 11, 0.4);
  }

  .tiny {
    font-size: 10px;
    padding: 1px 6px;
  }
</style>

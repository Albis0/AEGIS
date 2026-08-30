<!--
    The canvas interface — image and video generation.

    A separate interface rather than a chat feature, for one reason: twenty
    variations in a message feed destroy the feed. Here the results stay in a
    grid, the prompt stays in one place, and nothing scrolls away.

    Everything a result was made with is kept next to it. A picture you liked
    is worth nothing if you cannot make it again, so seed, model, size and
    prompt all come back with the tile — and when a provider gave no seed, the
    detail panel says the result cannot be repeated exactly rather than
    pretending.

    The detail opens as a modal rather than a third column. As a column it was
    three hundred pixels wide, which is not enough to look at a picture, and it
    took that width away from the grid whether or not anything was open.
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
    import { ask } from "./confirm.svelte";
    import Icon from "./Icon.svelte";
    import Modal from "./Modal.svelte";
    import { toast } from "./toast.svelte";
    import { onMount } from "svelte";

    type Kind = "image" | "video";

    /** Named sizes, so nobody has to remember what 1536×640 is for. */
    const SIZES: [string, number, number][] = [
        ["Square", 1024, 1024],
        ["Landscape", 1536, 1024],
        ["Portrait", 1024, 1536],
        ["Wide", 1920, 1080],
        ["Tall", 1080, 1920],
    ];

    let settings = $state<CanvasSettings | null>(null);
    let items = $state<GalleryItem[]>([]);
    /** False until the first load finishes, so an empty grid is not asserted. */
    let loaded = $state(false);

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
    /** The result open in the detail dialog. */
    let open = $state<GalleryItem | null>(null);

    let busy = $state(false);
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
                toast.success(
                    `${payload.items.length} from ${payload.provider}.`,
                    payload.notes.length
                        ? { detail: payload.notes.join(" · ") }
                        : undefined,
                );
                void loadSettings();
            }),
            on<{ message: string }>("canvas:error", (payload) => {
                busy = false;
                toast.error("Generation failed.", { detail: payload.message });
            }),
        ]);

        // A generation has no progress to report, so the elapsed seconds are
        // the only honest signal that something is still happening.
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
            toast.failure("Could not read the canvas settings.", e);
        }
    }

    async function refresh() {
        await loadSettings();
        try {
            items = await api.listGallery(300);
        } catch (e) {
            toast.failure("Could not load the gallery.", e);
        } finally {
            loaded = true;
        }
    }

    async function generate(options: { upscale?: boolean } = {}) {
        if (busy) return;
        busy = true;
        elapsed = 0;

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
            toast.failure("Could not start that generation.", e);
        }
    }

    /** Sets up a variation: same prompt and settings, that image as the start. */
    function variationOf(item: GalleryItem) {
        source = item;
        kind = "image";
        prompt = item.prompt;
        open = null;
    }

    /** Sets up an animation with the image as the first frame. */
    function animate(item: GalleryItem) {
        source = item;
        kind = "video";
        prompt = item.prompt;
        open = null;
        if (!settings?.canVideo) {
            toast.warning("No video provider has a key yet.", {
                detail: "Add one under Image & video in settings.",
            });
        }
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
        if (item.seed === null) {
            toast.info("Settings loaded.", {
                detail: "No seed was recorded, so this will not repeat exactly.",
            });
        } else {
            toast.success("Settings loaded — same seed, same result.");
        }
    }

    function readParams(item: GalleryItem): Record<string, string> {
        try {
            return JSON.parse(item.params);
        } catch {
            return {};
        }
    }

    async function remove(item: GalleryItem) {
        const confirmed = await ask({
            title: "Delete this result?",
            body: `“${item.prompt}” — the file is removed from disk and cannot be recovered.`,
            confirmLabel: "Delete",
            danger: true,
        });
        if (!confirmed) return;

        try {
            await api.deleteGalleryItem(item.id);
            items = items.filter((i) => i.id !== item.id);
            if (open?.id === item.id) open = null;
            if (source?.id === item.id) source = null;
            void loadSettings();
            toast.success("Deleted.");
        } catch (e) {
            toast.failure("Could not delete that.", e);
        }
    }

    async function toggleFavourite(item: GalleryItem) {
        const next = !item.favourite;
        try {
            await api.favouriteGalleryItem(item.id, next);
            items = items.map((i) => (i.id === item.id ? { ...i, favourite: next } : i));
            if (open?.id === item.id) open = { ...open, favourite: next };
        } catch (e) {
            toast.failure("Could not star that.", e);
        }
    }

    async function clearAll() {
        const confirmed = await ask({
            title: "Clear the gallery?",
            body: "Everything goes except the results you starred. The files are removed from disk and cannot be recovered.",
            confirmLabel: "Clear",
            danger: true,
        });
        if (!confirmed) return;

        try {
            const freed = await api.clearGallery(true);
            toast.success(`Freed ${bytes(freed)}.`);
            await refresh();
        } catch (e) {
            toast.failure("Could not clear the gallery.", e);
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
        <div class="kinds" role="group" aria-label="What to generate">
            <button class:active={kind === "image"} onclick={() => (kind = "image")}>
                Image
            </button>
            <button
                class:active={kind === "video"}
                disabled={!settings?.canVideo}
                title={settings?.canVideo ? "" : "Needs a video provider key"}
                onclick={() => (kind = "video")}
            >
                Video
            </button>
        </div>

        {#if source}
            <div class="source">
                <img src={src(source)} alt="" />
                <div class="source-text">
                    <span>Continuing from #{source.id}</span>
                    <button onclick={() => (source = null)}>Drop</button>
                </div>
            </div>
        {/if}

        <textarea
            bind:value={prompt}
            class="prompt"
            rows="5"
            placeholder="What should it look like?"
            aria-label="Prompt"
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
            placeholder="What to avoid (optional)"
            aria-label="What to avoid"
        />

        <div class="row">
            <label for="canvas-size">Size</label>
            <select id="canvas-size" bind:value={sizeIndex}>
                {#each SIZES as [label, w, h], i (label)}
                    <option value={i}>{label} · {w}×{h}</option>
                {/each}
            </select>
        </div>

        {#if kind === "image"}
            <div class="row">
                <label for="canvas-count">How many</label>
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
                <label for="canvas-duration">Seconds</label>
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
            <label for="canvas-seed">Seed</label>
            <input
                id="canvas-seed"
                bind:value={seedText}
                placeholder="Random"
                title="Leave empty to let the provider choose. The one it used is saved with the result."
            />
        </div>

        {#if source && kind === "image"}
            <div class="row">
                <label for="canvas-strength">Drift</label>
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
            <label for="canvas-model">Model</label>
            <input
                id="canvas-model"
                bind:value={model}
                placeholder="Provider default"
            />
        </div>

        <button class="primary go" disabled={!canGo} onclick={() => generate()}>
            {#if busy}
                <span class="spinner" aria-hidden="true"></span>
                Working… {elapsed}s
            {:else}
                Generate
                <kbd>Ctrl ⏎</kbd>
            {/if}
        </button>

        {#if settings && !settings.canImage}
            <p class="warn">
                <Icon name="warning" size={14} />
                No image provider has a key. Add one under Image &amp; video in
                settings — OpenAI, Stability, Replicate, or your own endpoint.
            </p>
        {/if}

        <div class="usage">
            <span>{settings?.items ?? 0} results · {bytes(settings?.bytes ?? 0)}</span>
            <div class="usage-actions">
                <button onclick={() => api.openMediaFolder()}>Open folder</button>
                <button class="danger" onclick={clearAll}>Clear</button>
            </div>
        </div>
    </aside>

    <main class="grid-pane">
        {#if !loaded}
            <div class="grid" aria-hidden="true">
                {#each { length: 8 } as _, i (i)}
                    <div class="tile skeleton"></div>
                {/each}
            </div>
        {:else if items.length === 0}
            <div class="state">
                <Icon name="canvas" size={26} />
                <p class="state-title">Nothing generated yet</p>
                <p class="state-body">
                    Describe a picture on the left and press Generate. Results
                    stay here with the seed and settings that made them, so you
                    can come back and make the same one again.
                </p>
            </div>
        {:else}
            <div class="grid">
                {#each items as item (item.id)}
                    <button class="tile" onclick={() => (open = item)}>
                        {#if item.kind === "video"}
                            <!-- Muted and loopable: a grid of talking videos is
                                 unusable. -->
                            <video
                                src={src(item)}
                                muted
                                loop
                                playsinline
                                preload="metadata"
                            ></video>
                            <span class="badge">Video</span>
                        {:else}
                            <img src={src(item)} alt={item.prompt} loading="lazy" />
                        {/if}
                        {#if item.favourite}
                            <span class="star" title="Starred">★</span>
                        {/if}
                        <span class="caption">{item.prompt}</span>
                    </button>
                {/each}
            </div>
        {/if}
    </main>
</div>

{#if open}
    {@const current = open}
    {@const params = readParams(current)}
    <Modal
        size="xl"
        title="#{current.id}"
        description={current.prompt}
        onClose={() => (open = null)}
    >
        <div class="detail">
            <div class="preview">
                {#if current.kind === "video"}
                    <!-- No caption track exists: this video was generated
                         seconds ago and has no dialogue to caption. -->
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <video src={src(current)} controls loop></video>
                {:else}
                    <img src={src(current)} alt={current.prompt} />
                {/if}
            </div>

            <dl class="facts">
                <dt>Provider</dt>
                <dd>{current.provider}</dd>
                <dt>Model</dt>
                <dd>{current.model || "default"}</dd>
                <dt>Seed</dt>
                <dd class:missing={current.seed === null}>
                    {current.seed ?? "Not reported — cannot be repeated exactly"}
                </dd>
                <dt>Size</dt>
                <dd>{current.width}×{current.height}</dd>
                <dt>File</dt>
                <dd>{bytes(current.bytes)}</dd>
                {#if params.negative}
                    <dt>Avoided</dt>
                    <dd>{params.negative}</dd>
                {/if}
                {#if current.parentId !== null}
                    <dt>From</dt>
                    <dd>#{current.parentId}</dd>
                {/if}
                <dt>Made</dt>
                <dd>{when(current.createdAt)}</dd>
            </dl>
        </div>

        {#snippet footer()}
            <button class="danger" onclick={() => remove(current)}>
                <Icon name="trash" size={14} />
                Delete
            </button>
            <span class="spacer"></span>
            <button onclick={() => toggleFavourite(current)}>
                {current.favourite ? "Unstar" : "Star"}
            </button>
            {#if current.kind === "image"}
                <button
                    disabled={!settings?.canUpscale || busy}
                    title={settings?.canUpscale
                        ? "Four times the size, same picture"
                        : "Needs a Stability or Replicate key"}
                    onclick={() => enlarge(current)}
                >
                    Enlarge
                </button>
                <button
                    disabled={!settings?.canVideo}
                    title={settings?.canVideo ? "" : "Needs a video provider key"}
                    onclick={() => animate(current)}
                >
                    Animate
                </button>
                <button onclick={() => variationOf(current)}>Variation</button>
            {/if}
            <button class="primary" onclick={() => reuse(current)}>
                Same settings
            </button>
        {/snippet}
    </Modal>
{/if}

<style>
    .canvas {
        display: flex;
        flex: 1;
        min-height: 0;
        min-width: 0;
    }

    /* -- Controls ------------------------------------------------------ */

    .controls {
        width: 288px;
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
        padding: var(--sp-4);
        border-right: 1px solid var(--line);
        background: var(--surface-sunken);
        overflow-y: auto;
    }

    /* A segmented control: one filled track, the active half raised out of
       it. Two outlined buttons read as two separate decisions. */
    .kinds {
        display: flex;
        gap: 2px;
        padding: 2px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--r-md);
    }
    .kinds button {
        flex: 1;
        justify-content: center;
        font-size: var(--text-sm);
        padding: var(--sp-2);
        border-radius: var(--r-sm);
    }
    .kinds button.active {
        color: var(--text);
        background: var(--surface-active);
        font-weight: 500;
    }

    .source {
        display: flex;
        gap: var(--sp-3);
        align-items: center;
        padding: var(--sp-2);
        background: var(--accent-muted);
        border-radius: var(--r-md);
    }
    .source img {
        width: 44px;
        height: 44px;
        object-fit: cover;
        border-radius: var(--r-sm);
        flex: 0 0 auto;
    }
    .source-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        font-size: var(--text-xs);
        color: var(--text-muted);
        min-width: 0;
    }
    .source-text button {
        padding: 0;
        font-size: var(--text-xs);
        color: var(--accent-text);
    }

    .prompt,
    .field,
    .row input,
    .row select {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--r-md);
        padding: var(--sp-2) var(--sp-3);
        font-size: var(--text-sm);
        color: var(--text);
        font-family: inherit;
        width: 100%;
        min-width: 0;
        transition: border-color var(--fast) var(--ease);
    }
    .prompt:focus,
    .field:focus,
    .row input:focus,
    .row select:focus {
        border-color: var(--accent-line);
    }

    .prompt {
        resize: vertical;
        line-height: 1.5;
    }

    .row {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
    }
    .row label {
        flex: 0 0 68px;
        font-size: var(--text-sm);
        color: var(--text-muted);
    }
    .row .value {
        flex: 0 0 auto;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--text-muted);
    }
    .row input[type="range"] {
        padding: 0;
        border: none;
        background: none;
        accent-color: var(--accent);
    }

    .go {
        justify-content: center;
        padding: var(--sp-3);
        font-size: var(--text-base);
    }
    .go kbd {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: rgba(255, 255, 255, 0.72);
        background: rgba(0, 0, 0, 0.2);
        border-radius: var(--r-sm);
        padding: 1px 5px;
    }

    .spinner {
        width: 12px;
        height: 12px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-top-color: #fff;
        border-radius: var(--r-full);
        animation: spin 700ms linear infinite;
    }

    .warn {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-2);
        margin: 0;
        font-size: var(--text-sm);
        line-height: 1.55;
        color: var(--warning);
    }

    .usage {
        margin-top: auto;
        padding-top: var(--sp-3);
        border-top: 1px solid var(--line);
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        font-size: var(--text-xs);
        color: var(--text-faint);
    }
    .usage-actions {
        display: flex;
        gap: var(--sp-1);
    }
    .usage-actions button {
        font-size: var(--text-xs);
        padding: var(--sp-1) var(--sp-2);
    }

    /* -- Grid ---------------------------------------------------------- */

    .grid-pane {
        flex: 1;
        min-width: 0;
        overflow-y: auto;
        padding: var(--sp-4);
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: var(--sp-3);
    }

    .tile {
        position: relative;
        aspect-ratio: 1;
        padding: 0;
        border-radius: var(--r-md);
        overflow: hidden;
        background: var(--surface-sunken);
        transition:
            transform var(--fast) var(--ease),
            box-shadow var(--fast) var(--ease);
    }
    .tile:hover {
        background: var(--surface-sunken);
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
    }
    .tile img,
    .tile video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    /* The prompt on a scrim along the bottom edge, on hover only. A grid of
       pictures with a permanent caption band is a grid of captions. */
    .caption {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: var(--sp-4) var(--sp-2) var(--sp-2);
        font-size: var(--text-xs);
        line-height: 1.4;
        color: #fff;
        text-align: left;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.78));
        opacity: 0;
        transition: opacity var(--fast) var(--ease);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .tile:hover .caption,
    .tile:focus-visible .caption {
        opacity: 1;
    }

    .badge,
    .star {
        position: absolute;
        top: var(--sp-2);
        font-size: var(--text-xs);
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    }
    .badge {
        left: var(--sp-2);
        padding: 1px 6px;
        border-radius: var(--r-full);
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        text-shadow: none;
    }
    .star {
        right: var(--sp-2);
        color: var(--warning);
    }

    .tile.skeleton {
        animation: pulse 1.4s var(--ease-soft) infinite;
    }

    .state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--sp-2);
        height: 100%;
        padding: var(--sp-7);
        text-align: center;
        color: var(--text-faint);
    }
    .state-title {
        font-size: var(--text-base);
        font-weight: 600;
        color: var(--text);
    }
    .state-body {
        font-size: var(--text-sm);
        color: var(--text-muted);
        line-height: 1.6;
        max-width: 46ch;
    }

    /* -- Detail -------------------------------------------------------- */

    /* The picture and its facts side by side. At this width the picture is
       finally big enough to judge, which was the point of moving it out of a
       three-hundred-pixel column. */
    .detail {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(220px, 1fr);
        gap: var(--sp-5);
        align-items: start;
    }
    @media (max-width: 720px) {
        .detail {
            grid-template-columns: 1fr;
        }
    }

    .preview img,
    .preview video {
        width: 100%;
        max-height: 58vh;
        object-fit: contain;
        border-radius: var(--r-md);
        background: var(--surface-sunken);
        display: block;
    }

    .facts {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--sp-2) var(--sp-3);
        margin: 0;
        font-size: var(--text-sm);
    }
    .facts dt {
        color: var(--text-faint);
    }
    .facts dd {
        margin: 0;
        color: var(--text);
        overflow-wrap: anywhere;
    }
    .facts dd.missing {
        color: var(--warning);
    }

    /* Pushes the destructive action to the far end of the footer, away from
       the one the user is most likely reaching for. */
    .spacer {
        flex: 1;
    }
</style>

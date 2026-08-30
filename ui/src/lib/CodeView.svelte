<!--
    The code interface.

    A file tree, an editor, and search — the parts of an editor you actually
    need while working with an assistant. It is not trying to be VS Code; it is
    trying to be the thing you keep open next to the conversation, so a change
    the assistant suggests can be read, edited and saved without leaving.

    The editor is a plain textarea with a gutter rather than a syntax-
    highlighting component: highlighting means shipping a tokenizer per
    language, and the point here is editing a file the assistant just touched,
    not replacing your editor.

    The gutter and the textarea take their size and line height from the same
    two custom properties, and scroll in step. They have to be two elements —
    nothing can be drawn inside a textarea's scroll box — so any disagreement
    between them shows up immediately as numbers drifting off their lines.
-->
<script lang="ts">
    import { api, type SearchHit, type WorkspaceEntry } from "./api";
    import { ask } from "./confirm.svelte";
    import Icon from "./Icon.svelte";
    import { chat } from "./store.svelte";
    import { toast } from "./toast.svelte";
    import { onMount } from "svelte";

    let root = $state<string | null>(null);
    let pathDraft = $state("");

    /** Expanded folders, by path. */
    let open = $state<Record<string, WorkspaceEntry[]>>({});
    let expanded = $state<Set<string>>(new Set());

    let file = $state<string | null>(null);
    let text = $state("");
    /** What was last read or saved, to know whether there are changes. */
    let saved = $state("");
    let dirty = $derived(text !== saved);

    let query = $state("");
    let hits = $state<SearchHit[]>([]);
    let searching = $state(false);
    /** True once a search has run and come back with nothing. */
    let searchedEmpty = $state(false);

    let editor = $state<HTMLTextAreaElement | null>(null);
    let gutter = $state<HTMLElement | null>(null);

    onMount(async () => {
        root = await api.currentWorkspace();
        if (root) await loadFolder("");
    });

    async function openFolder() {
        const path = pathDraft.trim();
        if (!path) return;
        try {
            const name = await api.openWorkspace(path);
            root = path;
            open = {};
            expanded = new Set();
            file = null;
            clearSearch();
            await loadFolder("");
            toast.success(`Opened ${name}.`);
        } catch (e) {
            toast.failure(`Could not open ${path}.`, e);
        }
    }

    async function loadFolder(path: string) {
        try {
            open[path] = await api.listWorkspace(path);
        } catch (e) {
            toast.failure(`Could not read ${path || "the workspace root"}.`, e);
        }
    }

    async function toggle(entry: WorkspaceEntry) {
        if (!entry.isDir) return void openFile(entry.path);

        const next = new Set(expanded);
        if (next.has(entry.path)) {
            next.delete(entry.path);
        } else {
            next.add(entry.path);
            if (!open[entry.path]) await loadFolder(entry.path);
        }
        expanded = next;
    }

    async function openFile(path: string) {
        // Losing unsaved edits by clicking another file would be unforgivable.
        if (dirty) {
            const discard = await ask({
                title: "Discard unsaved changes?",
                body: `${file} has edits that have not been written to disk.`,
                confirmLabel: "Discard",
                cancelLabel: "Keep editing",
                danger: true,
            });
            if (!discard) return;
        }

        try {
            text = await api.readWorkspaceFile(path);
            saved = text;
            file = path;
        } catch (e) {
            toast.failure(`Could not open ${path}.`, e);
        }
    }

    async function save() {
        if (!file) return;
        try {
            await api.writeWorkspaceFile(file, text);
            saved = text;
            toast.success(`Saved ${file}.`);
        } catch (e) {
            toast.failure(`Could not save ${file}.`, e);
        }
    }

    async function runSearch() {
        if (query.trim().length < 2) return;
        searching = true;
        searchedEmpty = false;
        try {
            hits = await api.searchWorkspace(query.trim());
            searchedEmpty = hits.length === 0;
        } catch (e) {
            toast.failure("Search failed.", e);
        } finally {
            searching = false;
        }
    }

    function clearSearch() {
        query = "";
        hits = [];
        searchedEmpty = false;
    }

    /** Asks the assistant about the open file, with the file as context. */
    function askAboutFile() {
        if (!file) return;
        chat.view = "chat";
        chat.input = `In ${file}, `;
    }

    function onKeydown(event: KeyboardEvent) {
        // Ctrl+S saves, as it does everywhere else.
        if (event.ctrlKey && event.key.toLowerCase() === "s") {
            event.preventDefault();
            void save();
        }
        // Tab indents rather than leaving the editor. Four spaces, matching
        // the rest of this repository.
        if (event.key === "Tab" && editor) {
            event.preventDefault();
            const { selectionStart: start, selectionEnd: end } = editor;
            text = `${text.slice(0, start)}    ${text.slice(end)}`;
            queueMicrotask(() => {
                if (editor) editor.selectionStart = editor.selectionEnd = start + 4;
            });
        }
    }

    /** Keeps the gutter level with the text as the editor scrolls. */
    function syncScroll() {
        if (gutter && editor) gutter.scrollTop = editor.scrollTop;
    }

    const lineCount = $derived(text.split("\n").length);
    /** Just the file name: the bar would otherwise show a whole path. */
    const fileName = $derived(file?.split(/[\\/]/).pop() ?? "");
</script>

<div class="code">
    <aside class="tree">
        <div class="tree-head">
            <input
                bind:value={pathDraft}
                placeholder={root ?? "Folder path…"}
                spellcheck="false"
                aria-label="Workspace folder path"
                onkeydown={(e) => e.key === "Enter" && openFolder()}
            />
            <button class="outline" onclick={openFolder} disabled={!pathDraft.trim()}>
                Open
            </button>
        </div>

        {#if root}
            <div class="search">
                <input
                    bind:value={query}
                    disabled={searching}
                    placeholder={searching ? "Searching…" : "Search in files…"}
                    spellcheck="false"
                    aria-label="Search in files"
                    onkeydown={(e) => e.key === "Enter" && runSearch()}
                />
                {#if query}
                    <button class="clear" onclick={clearSearch} aria-label="Clear search">
                        <Icon name="close" size={13} />
                    </button>
                {/if}
            </div>

            {#if searching}
                <div class="skeletons" aria-hidden="true">
                    {#each { length: 6 } as _, row (row)}
                        <div class="skeleton" style:width="{82 - row * 7}%"></div>
                    {/each}
                </div>
            {:else if hits.length}
                <div class="hits">
                    <div class="section">
                        <span>{hits.length} matches</span>
                        <button onclick={clearSearch}>Clear</button>
                    </div>
                    {#each hits as hit (hit.path + hit.line)}
                        <button class="hit" onclick={() => openFile(hit.path)}>
                            <span class="hit-path">{hit.path}:{hit.line}</span>
                            <span class="hit-text">{hit.text}</span>
                        </button>
                    {/each}
                </div>
            {:else if searchedEmpty}
                <div class="state">
                    <p class="state-title">Nothing matches “{query}”</p>
                    <button class="outline" onclick={clearSearch}>
                        Back to the tree
                    </button>
                </div>
            {:else}
                <div class="entries">
                    {#each open[""] ?? [] as entry (entry.path)}
                        {@render node(entry, 0)}
                    {/each}
                </div>
            {/if}
        {:else}
            <div class="state">
                <Icon name="code" size={22} />
                <p class="state-title">No folder open</p>
                <p class="state-body">
                    Put a folder path in the box above and press Enter. The
                    assistant reads and writes inside it, and nowhere else.
                </p>
            </div>
        {/if}
    </aside>

    <main class="editor">
        <div class="bar">
            <span class="filename" title={file ?? ""}>
                {#if file}
                    {fileName}
                    {#if dirty}
                        <span class="dot" title="Unsaved changes"></span>
                    {/if}
                {:else}
                    <span class="muted">No file open</span>
                {/if}
            </span>

            {#if file}
                <div class="bar-actions">
                    <button onclick={askAboutFile}>
                        <Icon name="chat" size={14} />
                        Ask about this
                    </button>
                    <button class="primary" disabled={!dirty} onclick={save}>
                        Save
                        <kbd>Ctrl S</kbd>
                    </button>
                </div>
            {/if}
        </div>

        {#if file}
            <div class="pane">
                <!-- A gutter rather than nothing: line numbers are how people
                     talk about code, and the assistant quotes them back. -->
                <div class="gutter" bind:this={gutter} aria-hidden="true">
                    {#each { length: lineCount } as _, i (i)}
                        <div>{i + 1}</div>
                    {/each}
                </div>
                <textarea
                    bind:this={editor}
                    bind:value={text}
                    onkeydown={onKeydown}
                    onscroll={syncScroll}
                    spellcheck="false"
                    wrap="off"
                    aria-label={file}
                ></textarea>
            </div>
        {:else}
            <div class="state blank">
                <Icon name="code" size={26} />
                <p class="state-title">Nothing open</p>
                <p class="state-body">
                    Pick a file from the tree, or search the workspace to jump
                    straight to a line.
                </p>
            </div>
        {/if}
    </main>
</div>

{#snippet node(entry: WorkspaceEntry, depth: number)}
    <button
        class="entry"
        class:active={file === entry.path}
        class:folder={entry.isDir}
        style:padding-left="{8 + depth * 14}px"
        onclick={() => toggle(entry)}
    >
        <span class="twist" class:open={expanded.has(entry.path)}>
            {#if entry.isDir}
                <Icon name="chevronRight" size={12} />
            {/if}
        </span>
        <span class="entry-name">{entry.name}</span>
    </button>

    {#if entry.isDir && expanded.has(entry.path)}
        {#each open[entry.path] ?? [] as child (child.path)}
            {@render node(child, depth + 1)}
        {/each}
    {/if}
{/snippet}

<style>
    .code {
        display: flex;
        flex: 1;
        min-height: 0;
        min-width: 0;
    }

    /* -- Tree ---------------------------------------------------------- */

    .tree {
        width: 264px;
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        padding: var(--sp-3);
        border-right: 1px solid var(--line);
        background: var(--surface-sunken);
        overflow: hidden;
    }

    .tree-head,
    .search {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        flex: 0 0 auto;
    }

    .tree-head input,
    .search input {
        flex: 1;
        min-width: 0;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--r-md);
        padding: var(--sp-2) var(--sp-3);
        font-size: var(--text-sm);
        color: var(--text);
        transition: border-color var(--fast) var(--ease);
    }
    .tree-head input:focus,
    .search input:focus {
        border-color: var(--accent-line);
    }

    .clear {
        padding: var(--sp-2);
        color: var(--text-faint);
        flex: 0 0 auto;
    }

    .entries,
    .hits {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        /* Pulled out to the rail edges so a hovered row reads as a full-width
           band, while the fields above keep their padding. */
        margin: 0 calc(-1 * var(--sp-2));
    }

    .section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: var(--text-xs);
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--text-faint);
        padding: var(--sp-2) var(--sp-2) var(--sp-1);
    }
    .section button {
        font-size: var(--text-xs);
        padding: 0 var(--sp-1);
        color: var(--accent-text);
    }

    .entry {
        display: flex;
        align-items: center;
        gap: var(--sp-1);
        width: 100%;
        text-align: left;
        font-size: var(--text-sm);
        color: var(--text-muted);
        padding: var(--sp-1) var(--sp-2);
        border-radius: var(--r-sm);
    }
    .entry:hover {
        color: var(--text);
        background: var(--surface-hover);
    }
    .entry.active {
        color: var(--text);
        background: var(--surface-active);
        font-weight: 500;
    }
    /* Folders read a shade stronger than the files inside them, which is what
       gives a deep tree any structure at a glance. */
    .entry.folder {
        color: var(--text);
    }

    .entry-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* A fixed-width slot whether or not there is a chevron in it, so file
       names line up under the folder names above them. */
    .twist {
        width: 14px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-faint);
        transition: transform var(--fast) var(--ease);
    }
    .twist.open {
        transform: rotate(90deg);
    }

    .hit {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1px;
        width: 100%;
        text-align: left;
        padding: var(--sp-2);
        border-radius: var(--r-sm);
        overflow: hidden;
    }
    .hit:hover {
        background: var(--surface-hover);
    }

    .hit-path,
    .hit-text {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    }
    .hit-path {
        color: var(--accent-text);
    }
    .hit-text {
        color: var(--text-muted);
    }

    /* -- Editor -------------------------------------------------------- */

    .editor {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
    }

    .bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-3);
        padding: var(--sp-2) var(--sp-3);
        border-bottom: 1px solid var(--line);
        flex: 0 0 auto;
    }

    .filename {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        font-size: var(--text-sm);
        font-weight: 500;
        color: var(--text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .filename .muted {
        font-weight: 400;
        color: var(--text-faint);
    }

    /* Unsaved state is a dot beside the name, not a bullet character in it.
       A glyph inside the label shifts the name every time it appears. */
    .dot {
        width: 6px;
        height: 6px;
        border-radius: var(--r-full);
        background: var(--accent);
        flex: 0 0 auto;
    }

    .bar-actions {
        display: flex;
        gap: var(--sp-1);
        flex: 0 0 auto;
    }

    .bar-actions kbd {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: rgba(255, 255, 255, 0.72);
        background: rgba(0, 0, 0, 0.2);
        border-radius: var(--r-sm);
        padding: 1px 5px;
    }

    /* The gutter and the textarea have to agree on both of these to the
       pixel, so they are declared once here and inherited by each. */
    .pane {
        --code-size: 13px;
        --code-line: 1.55;
        flex: 1;
        display: flex;
        min-height: 0;
        overflow: hidden;
    }

    .gutter {
        flex: 0 0 auto;
        padding: var(--sp-3) var(--sp-2);
        text-align: right;
        font-family: var(--font-mono);
        font-size: var(--code-size);
        line-height: var(--code-line);
        color: var(--text-faint);
        background: var(--surface-sunken);
        border-right: 1px solid var(--line);
        user-select: none;
        overflow: hidden;
    }

    textarea {
        flex: 1;
        min-width: 0;
        border: none;
        outline: none;
        resize: none;
        padding: var(--sp-3);
        background: transparent;
        color: var(--text);
        font-family: var(--font-mono);
        font-size: var(--code-size);
        line-height: var(--code-line);
        white-space: pre;
        overflow: auto;
        tab-size: 4;
    }

    /* -- States -------------------------------------------------------- */

    .state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--sp-2);
        padding: var(--sp-6) var(--sp-4);
        text-align: center;
        color: var(--text-faint);
    }
    .state.blank {
        flex: 1;
        justify-content: center;
        padding: var(--sp-7);
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
        max-width: 40ch;
    }

    .state button {
        margin-top: var(--sp-2);
    }

    .skeletons {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
        padding: var(--sp-3) var(--sp-2);
    }

    .skeleton {
        height: 12px;
        border-radius: var(--r-sm);
        background: var(--surface-hover);
        animation: pulse 1.4s var(--ease-soft) infinite;
    }
</style>

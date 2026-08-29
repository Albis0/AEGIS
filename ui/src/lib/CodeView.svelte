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
-->
<script lang="ts">
    import { api, type SearchHit, type WorkspaceEntry } from "./api";
    import { chat } from "./store.svelte";
    import { onMount } from "svelte";

    let root = $state<string | null>(null);
    let pathDraft = $state("");
    let notice = $state("");

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

    let editor = $state<HTMLTextAreaElement | null>(null);

    onMount(async () => {
        root = await api.currentWorkspace();
        if (root) await loadFolder("");
    });

    async function openFolder() {
        try {
            const name = await api.openWorkspace(pathDraft.trim());
            root = pathDraft.trim();
            notice = `Opened ${name}`;
            open = {};
            expanded = new Set();
            file = null;
            await loadFolder("");
        } catch (e) {
            notice = String(e);
        }
    }

    async function loadFolder(path: string) {
        try {
            open[path] = await api.listWorkspace(path);
        } catch (e) {
            notice = String(e);
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
        if (dirty && !confirm("Discard unsaved changes?")) return;
        try {
            text = await api.readWorkspaceFile(path);
            saved = text;
            file = path;
            notice = "";
        } catch (e) {
            notice = String(e);
        }
    }

    async function save() {
        if (!file) return;
        try {
            await api.writeWorkspaceFile(file, text);
            saved = text;
            notice = `Saved ${file}`;
        } catch (e) {
            notice = String(e);
        }
    }

    async function runSearch() {
        if (query.trim().length < 2) return;
        searching = true;
        try {
            hits = await api.searchWorkspace(query.trim());
            notice = hits.length ? "" : "No matches.";
        } catch (e) {
            notice = String(e);
        } finally {
            searching = false;
        }
    }

    /** Asks the assistant about the open file, with the file as context. */
    function ask() {
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
        // Tab indents rather than leaving the editor.
        if (event.key === "Tab" && editor) {
            event.preventDefault();
            const { selectionStart: start, selectionEnd: end } = editor;
            text = `${text.slice(0, start)}  ${text.slice(end)}`;
            queueMicrotask(() => {
                if (editor) editor.selectionStart = editor.selectionEnd = start + 2;
            });
        }
    }

    const lineCount = $derived(text.split("\n").length);
</script>

<div class="code">
    <aside class="tree">
        <div class="tree-head">
            <input
                bind:value={pathDraft}
                placeholder={root ?? "folder path…"}
                onkeydown={(e) => e.key === "Enter" && openFolder()}
            />
            <button class="tiny" onclick={openFolder}>open</button>
        </div>

        {#if root}
            <div class="search">
                <input
                    bind:value={query}
                    disabled={searching}
                    placeholder={searching ? "searching…" : "search in files…"}
                    onkeydown={(e) => e.key === "Enter" && runSearch()}
                />
            </div>

            {#if hits.length}
                <div class="hits">
                    <div class="section">
                        {hits.length} matches
                        <button class="tiny" onclick={() => (hits = [])}>clear</button>
                    </div>
                    {#each hits as hit (hit.path + hit.line)}
                        <button class="hit" onclick={() => openFile(hit.path)}>
                            <span class="hit-path">{hit.path}:{hit.line}</span>
                            <span class="hit-text">{hit.text}</span>
                        </button>
                    {/each}
                </div>
            {:else}
                <div class="entries">
                    {#each open[""] ?? [] as entry (entry.path)}
                        {@render node(entry, 0)}
                    {/each}
                </div>
            {/if}
        {:else}
            <p class="empty">Type a folder path above to start.</p>
        {/if}
    </aside>

    <main class="editor">
        <div class="bar">
            <span class="filename">
                {file ?? "no file open"}{dirty ? " •" : ""}
            </span>
            <div class="bar-actions">
                {#if file}
                    <button class="tiny" onclick={ask}>ask about this</button>
                    <button class="tiny" disabled={!dirty} onclick={save}>save</button>
                {/if}
            </div>
        </div>

        {#if file}
            <div class="pane">
                <!-- A gutter rather than nothing: line numbers are how people talk
             about code, and the assistant quotes them back. -->
                <div class="gutter" aria-hidden="true">
                    {#each Array(lineCount) as _, i (i)}
                        <div>{i + 1}</div>
                    {/each}
                </div>
                <textarea
                    bind:this={editor}
                    bind:value={text}
                    onkeydown={onKeydown}
                    spellcheck="false"
                    wrap="off"
                ></textarea>
            </div>
        {:else}
            <div class="blank">Pick a file from the tree.</div>
        {/if}

        {#if notice}
            <div class="notice">{notice}</div>
        {/if}
    </main>
</div>

{#snippet node(entry: WorkspaceEntry, depth: number)}
    <button
        class="entry"
        class:active={file === entry.path}
        style="padding-left: {8 + depth * 12}px"
        onclick={() => toggle(entry)}
    >
        <span class="icon">
            {entry.isDir ? (expanded.has(entry.path) ? "▾" : "▸") : "·"}
        </span>
        {entry.name}
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

    .tree {
        width: 240px;
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        padding: var(--sp-2);
        border-right: 1px solid var(--line);
        overflow: hidden;
    }

    .tree-head,
    .search {
        display: flex;
        gap: var(--sp-1);
    }

    .tree-head input,
    .search input {
        flex: 1;
        min-width: 0;
        background: var(--surface-sunken);
        border: 1px solid var(--line);
        border-radius: var(--r-md);
        padding: 2px var(--sp-1);
        font-size: var(--text-xs);
        color: var(--text);
    }

    .entries,
    .hits {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }

    .section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--accent);
        padding: var(--sp-1) 0;
    }

    .entry {
        display: flex;
        align-items: center;
        gap: 4px;
        border: none;
        background: none;
        text-align: left;
        font-size: var(--text-xs);
        color: var(--text-muted);
        padding: 2px var(--sp-1);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .entry:hover {
        color: var(--text);
        background: var(--surface-hover);
    }
    .entry.active {
        color: var(--accent-hover);
    }

    .icon {
        width: 10px;
        flex: 0 0 auto;
        color: var(--accent-line);
    }

    .hit {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        border: none;
        background: none;
        text-align: left;
        padding: 3px var(--sp-1);
        overflow: hidden;
    }
    .hit:hover {
        background: var(--surface-hover);
    }

    .hit-path {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--accent);
    }

    .hit-text {
        font-size: 10px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    }

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
        gap: var(--sp-2);
        padding: var(--sp-1) var(--sp-2);
        border-bottom: 1px solid var(--line);
    }

    .filename {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .bar-actions {
        display: flex;
        gap: var(--sp-1);
        flex: 0 0 auto;
    }

    .pane {
        flex: 1;
        display: flex;
        min-height: 0;
        overflow: hidden;
    }

    .gutter {
        flex: 0 0 auto;
        padding: var(--sp-2) var(--sp-1);
        text-align: right;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        line-height: 1.5;
        color: var(--text-faint);
        background: var(--surface-sunken);
        user-select: none;
        overflow: hidden;
    }

    textarea {
        flex: 1;
        min-width: 0;
        border: none;
        outline: none;
        resize: none;
        padding: var(--sp-2);
        background: transparent;
        color: var(--text);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        line-height: 1.5;
        white-space: pre;
        overflow: auto;
    }

    .blank,
    .empty {
        padding: var(--sp-4);
        font-size: var(--text-xs);
        color: var(--text-faint);
    }

    .notice {
        padding: var(--sp-1) var(--sp-2);
        font-size: var(--text-xs);
        color: var(--accent);
        border-top: 1px solid var(--line);
    }

    .tiny {
        font-size: 10px;
        padding: 1px 6px;
    }
</style>

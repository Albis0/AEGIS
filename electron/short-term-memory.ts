/**
 * Faz 50 — Short-term conversation memory (RAM-only, no persistence)
 *
 * Tracks the last N tool executions so AEGIS can resolve references like
 * "bunu kapat", "tekrar yap", "sesi biraz artır", "bir öncekini geri al".
 *
 * Shape kept minimal — only what the LLM needs injected in system prompt.
 */

/** Where a recorded action came from: the LLM tool-loop, or the deterministic reference resolver. */
export type ActionSource = "llm" | "resolver";

export interface ToolMemoryEntry {
    tool: string;
    args: Record<string, unknown>;
    result: string;
    success: boolean;
    ts: number;
    entity: string | null;   // the concrete thing acted on (game, file, app, track, host…)
    source: ActionSource;     // "llm" (model picked it) or "resolver" (deterministic rule)
}

export interface STMContext {
    lastTool: string | null;
    lastArgs: Record<string, unknown>;
    lastResult: string | null;
    lastIntent: string | null;         // human-readable label derived from tool name
    lastSpotifyTrack: string | null;   // spotify:track:xxxx if applicable
    lastSpotifyContext: string | null; // playlist/album URI if applicable
    lastTarget: string | null;         // app name, file path, URL, etc.
    lastEntity: string | null;         // normalized concrete entity of the last action
    recentTools: ToolMemoryEntry[];    // last MAX_ENTRIES entries
}

const MAX_ENTRIES = 20;

let _ctx: STMContext = makeEmpty();

function makeEmpty(): STMContext {
    return {
        lastTool: null,
        lastArgs: {},
        lastResult: null,
        lastIntent: null,
        lastSpotifyTrack: null,
        lastSpotifyContext: null,
        lastTarget: null,
        lastEntity: null,
        recentTools: [],
    };
}

/**
 * Pull the concrete entity acted on (game name, file path, app, track URI, host…)
 * so reference resolution can answer "son oynadığım", "onu kapat", "o dosya".
 */
function extractEntity(tool: string, args: Record<string, unknown>, result: string): string | null {
    const s = (k: string): string | null => (typeof args[k] === "string" ? (args[k] as string) : null);

    if (tool.startsWith("steam_")) return s("game") ?? s("name") ?? null;
    if (tool.startsWith("spotify_")) {
        return s("uri") ?? s("query") ?? s("id") ?? s("context_uri")
            ?? (result.match(/spotify:track:[A-Za-z0-9]+/)?.[0] ?? null);
    }
    if (tool === "read_file" || tool === "write_file" || tool === "delete_file" || tool === "move_file") return s("path");
    if (tool === "fetch_url") return s("url");
    if (tool === "focus_window") return s("title");
    // run_command: pull the launched app, if any
    const cmd = s("command");
    if (cmd) { const m = cmd.match(/Start-Process\s+"?([^"\s]+)"?/i); if (m) return m[1]; }
    return s("app") ?? s("name") ?? null;
}

/**
 * Call after every tool execution to update the short-term context.
 * `source` records whether the LLM or the deterministic resolver chose this action.
 */
export function stmRecord(tool: string, argsJson: string, result: string, success: boolean, source: ActionSource = "llm"): void {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(argsJson); } catch { /* leave empty */ }

    const entity = extractEntity(tool, args, result);
    const entry: ToolMemoryEntry = {tool, args, result: result.slice(0, 300), success, ts: Date.now(), entity, source};

    _ctx.recentTools.push(entry);
    if (_ctx.recentTools.length > MAX_ENTRIES) _ctx.recentTools.shift();

    if (entity) _ctx.lastEntity = entity;

    _ctx.lastTool   = tool;
    _ctx.lastArgs   = args;
    _ctx.lastResult = result.slice(0, 200);
    _ctx.lastIntent = toolToIntent(tool);

    // Extract domain-specific last targets
    if (tool.startsWith("spotify_")) {
        if (args.uri && typeof args.uri === "string")         _ctx.lastSpotifyTrack   = args.uri;
        if (args.context_uri && typeof args.context_uri === "string") _ctx.lastSpotifyContext = args.context_uri;
        // spotify_now_playing result may contain track URI: "spotify:track:..."
        const trackMatch = result.match(/spotify:track:[A-Za-z0-9]+/);
        if (trackMatch) _ctx.lastSpotifyTrack = trackMatch[0];
    }

    // Generic target: app name from run_command / focus_window, file path from read/write, URL from fetch
    if (args.command && typeof args.command === "string") {
        const m = (args.command as string).match(/Start-Process\s+"?([^"\s]+)"?/i);
        if (m) _ctx.lastTarget = m[1];
    }
    if (args.title  && typeof args.title  === "string") _ctx.lastTarget = args.title;
    if (args.path   && typeof args.path   === "string") _ctx.lastTarget = args.path;
    if (args.url    && typeof args.url    === "string") _ctx.lastTarget = args.url;
    if (args.name   && typeof args.name   === "string") _ctx.lastTarget = args.name as string;
    if (args.app    && typeof args.app    === "string") _ctx.lastTarget = args.app as string;
}

/** Reset on new-chat. */
export function stmClear(): void {
    _ctx = makeEmpty();
}

/** Return current snapshot (read-only). */
export function stmGet(): Readonly<STMContext> {
    return _ctx;
}

/**
 * Build a compact injection block for the system prompt.
 * Only included when there are recent entries — keeps prompt clean on first turn.
 */
export function stmBuildPromptBlock(): string {
    if (_ctx.recentTools.length === 0) return "";

    const lines: string[] = ["SON İŞLEMLER (referans çözümleme için):"];

    // Last 5 entries, newest first
    const recent = [..._ctx.recentTools].reverse().slice(0, 5);
    for (const e of recent) {
        const argStr = Object.entries(e.args)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(", ");
        lines.push(`  [${new Date(e.ts).toLocaleTimeString("tr")}] ${e.tool}(${argStr}) → ${e.success ? "OK" : "HATA"}: ${e.result.slice(0, 80)}`);
    }

    if (_ctx.lastSpotifyTrack)   lines.push(`  lastSpotifyTrack: ${_ctx.lastSpotifyTrack}`);
    if (_ctx.lastSpotifyContext) lines.push(`  lastSpotifyContext: ${_ctx.lastSpotifyContext}`);
    if (_ctx.lastTarget)         lines.push(`  lastTarget: ${_ctx.lastTarget}`);
    if (_ctx.lastEntity)         lines.push(`  lastEntity: ${_ctx.lastEntity}`);

    return "\n\n" + lines.join("\n");
}

/** Most recent entry whose tool name starts with the given prefix (e.g. "steam_", "spotify_"). */
export function stmLastByToolPrefix(prefix: string): ToolMemoryEntry | null {
    for (let i = _ctx.recentTools.length - 1; i >= 0; i--) {
        if (_ctx.recentTools[i].tool.startsWith(prefix)) return _ctx.recentTools[i];
    }
    return null;
}

/** Most recent entry matching a predicate. */
export function stmLastWhere(pred: (e: ToolMemoryEntry) => boolean): ToolMemoryEntry | null {
    for (let i = _ctx.recentTools.length - 1; i >= 0; i--) {
        if (pred(_ctx.recentTools[i])) return _ctx.recentTools[i];
    }
    return null;
}

// ---- helpers ----

function toolToIntent(tool: string): string {
    const map: Record<string, string> = {
        spotify_play:    "Spotify çal",
        spotify_pause:   "Spotify durdur",
        spotify_next:    "Spotify sonraki",
        spotify_prev:    "Spotify önceki",
        spotify_volume:  "Spotify ses",
        spotify_search:  "Spotify ara",
        spotify_open:    "Spotify aç",
        run_command:     "komut çalıştır",
        read_file:       "dosya oku",
        write_file:      "dosya yaz",
        focus_window:    "pencere odakla",
        set_volume:      "sistem sesi",
        set_brightness:  "parlaklık",
        steam_launch:    "Steam oyun başlat",
        steam_open:      "Steam aç",
        web_search:      "web ara",
        fetch_url:       "URL getir",
        screenshot:      "ekran görüntüsü",
    };
    return map[tool] ?? tool.replace(/_/g, " ");
}

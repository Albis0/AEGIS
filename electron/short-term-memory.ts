/**
 * Faz 50 — Short-term conversation memory (RAM-only, no persistence)
 *
 * Tracks the last N tool executions so AEGIS can resolve references like
 * "bunu kapat", "tekrar yap", "sesi biraz artır", "bir öncekini geri al".
 *
 * Shape kept minimal — only what the LLM needs injected in system prompt.
 */

export interface ToolMemoryEntry {
    tool: string;
    args: Record<string, unknown>;
    result: string;
    success: boolean;
    ts: number;
}

export interface STMContext {
    lastTool: string | null;
    lastArgs: Record<string, unknown>;
    lastResult: string | null;
    lastIntent: string | null;         // human-readable label derived from tool name
    lastSpotifyTrack: string | null;   // spotify:track:xxxx if applicable
    lastSpotifyContext: string | null; // playlist/album URI if applicable
    lastTarget: string | null;         // app name, file path, URL, etc.
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
        recentTools: [],
    };
}

/** Call after every tool execution to update the short-term context. */
export function stmRecord(tool: string, argsJson: string, result: string, success: boolean): void {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(argsJson); } catch { /* leave empty */ }

    const entry: ToolMemoryEntry = {tool, args, result: result.slice(0, 300), success, ts: Date.now()};

    _ctx.recentTools.push(entry);
    if (_ctx.recentTools.length > MAX_ENTRIES) _ctx.recentTools.shift();

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

    return "\n\n" + lines.join("\n");
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

/**
 * Security (audit A3) — untrusted-content taint boundary.
 *
 * The regex blocklists over run_command are guardrails against model accidents,
 * not against prompt injection: web pages, RSS items, clipboard and arbitrary
 * files flow into the agent context, and hidden instructions in that content can
 * steer the model into destructive tool calls that pass every pattern check
 * (e.g. `powershell -EncodedCommand`). The structural fix is a trust boundary:
 * once a conversation has ingested external content, destructive tools require
 * an explicit user click — regardless of pattern results, stored "always allow"
 * grants, or Full PC Access.
 *
 * Pure module, RAM-only, mirrors short-term-memory's lifecycle: taint clears on
 * new-chat/session reset.
 */

import * as path from "path";
import * as os from "os";

/** Tools whose RESULTS carry third-party content into the model context. */
const TAINT_SOURCES: ReadonlySet<string> = new Set([
    "fetch_url",
    "web_search",
    "rss_fetch",
    "reading_summarize",
    "read_clipboard",
    "clipboard_history",
    "clipboard_search",
]);

/**
 * Tools that escalate to MANDATORY approval while tainted. run_command is here
 * unconditionally (its pattern classification is bypassable); the rest matches
 * permissions.ts ALWAYS_DESTRUCTIVE. Kept as an independent set so a change in
 * one file is caught by the cross-check test rather than silently drifting.
 */
export const TAINT_ESCALATED_TOOLS: ReadonlySet<string> = new Set([
    "run_command",
    "delete_file",
    "move_file",
    "kill_heavy_process",
    "organize_folder",
    "bulk_rename",
    "clear_old_data",
    "format_code",
]);

let _tainted = false;
let _firstSource: string | null = null;

/** Is this path inside AEGIS' own data dir? Reading our own state is trusted. */
function isAegisDataPath(p: string): boolean {
    if (!p) return false;
    let resolved = p;
    if (resolved === "~" || resolved.startsWith("~/") || resolved.startsWith("~\\")) {
        resolved = path.join(os.homedir(), resolved.slice(1));
    }
    if (!path.isAbsolute(resolved)) resolved = path.join(os.homedir(), resolved);
    const aegisDir = path.join(os.homedir(), ".aegis") + path.sep;
    return path.normalize(resolved + path.sep).toLowerCase().startsWith(aegisDir.toLowerCase());
}

/** Call after a tool executes — marks the conversation tainted if the tool ingests external content. */
export function recordTaintFromTool(tool: string, args?: Record<string, unknown>): void {
    if (TAINT_SOURCES.has(tool)) {
        _tainted = true;
        _firstSource ??= tool;
        return;
    }
    // Arbitrary files may carry injected instructions (downloads, shared docs);
    // AEGIS' own data dir is exempt so memory/config reads don't taint.
    if (tool === "read_file" || tool === "chat_with_file") {
        const p = String(args?.path ?? args?.file ?? "");
        if (p && !isAegisDataPath(p)) {
            _tainted = true;
            _firstSource ??= `${tool} (${p.slice(0, 80)})`;
        }
    }
}

export function isTainted(): boolean {
    return _tainted;
}

/** First tool that introduced external content — shown in the approval dialog. */
export function taintSource(): string | null {
    return _firstSource;
}

/** Does this tool require mandatory approval given the current taint state? */
export function taintRequiresApproval(tool: string): boolean {
    return _tainted && TAINT_ESCALATED_TOOLS.has(tool);
}

/** New chat / session reset — external content left the context. */
export function clearTaint(): void {
    _tainted = false;
    _firstSource = null;
}

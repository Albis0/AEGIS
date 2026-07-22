/**
 * Phase 54 — Destructive Action Permission Gate
 *
 * Tools like `run_command` / `delete_file` / `kill_heavy_process` were UNLIMITED
 * until now: the model could cause irreversible damage with a single wrong argument.
 * Trust = stop and ask before an irreversible action. This module assigns each tool
 * a RISK TIER and persists "always allow" decisions in `~/.aegis/permissions.json`.
 *
 * This module is PURE: classification + store. The actual approval dialog lives in
 * main.ts (UI layer). Read-only tools NEVER prompt — only destructive/high-risk ones
 * pass through the gate.
 */

import {writeJsonAtomic} from "./json-store";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export type RiskTier = "safe" | "destructive";

const STORE_PATH = path.join(os.homedir(), ".aegis", "permissions.json");

/**
 * Tools always considered destructive (regardless of arguments). Irreversible actions
 * or ones that affect system/file integrity.
 */
const ALWAYS_DESTRUCTIVE = new Set<string>([
    "delete_file",
    "move_file",
    "kill_heavy_process",
    "organize_folder",   // moves files in bulk
    "bulk_rename",       // bulk renaming
    "clear_old_data",    // deletes data
    "format_code",       // modifies files in place
    "edit_file",         // Faz CC-1 — exact-string edit modifies a file in place
    "gmail_send",        // sends mail as the user — irreversible, outward-facing
    "calendar_delete_event",
]);

/**
 * `run_command` is considered destructive if its argument is dangerous. These patterns
 * are broader than SYSTEM_DESTROY (tools.ts — fully blocked): these are not blocked,
 * they require APPROVAL.
 */
const COMMAND_DESTRUCTIVE_PATTERNS: RegExp[] = [
    /\bRemove-Item\b/i,
    /\brm\s+-[rf]/i,
    /\bdel\s+\/[sf]/i,
    /\brmdir\b/i,
    /\bStop-Process\b/i,
    /\btaskkill\b/i,
    /\bStop-Service\b/i,
    /\bSet-ItemProperty\b.*HK(LM|CU)/i,  // registry write
    /\breg\s+(add|delete)\b/i,
    /\bShutdown\b/i,
    /\bRestart-Computer\b/i,
    /\b(Format|mkfs)\b/i,
    /\bUninstall-/i,
    /\b>\s*[A-Za-z]:\\/,                  // redirect to file (overwrite)
];

/**
 * Returns the risk tier of a tool call. For `run_command` it inspects the argument;
 * for others it checks the fixed list; everything else is "safe" (the gate doesn't ask).
 */
export function classifyRisk(tool: string, args: Record<string, unknown>): RiskTier {
    if (ALWAYS_DESTRUCTIVE.has(tool)) return "destructive";
    // run_command and run_shell (Faz CC-2) both run arbitrary shell — inspect the
    // command. run_shell adds cwd/background/long-timeout, so a background job is
    // treated as destructive regardless of the command (it runs unattended).
    if (tool === "run_command" || tool === "run_shell") {
        const cmd = String(args.command ?? "");
        if (COMMAND_DESTRUCTIVE_PATTERNS.some((p) => p.test(cmd))) return "destructive";
        if (tool === "run_shell" && (args.background === "true" || args.background === true)) return "destructive";
    }
    return "safe";
}

// ── Persistent "always allow" store ──────────────────────────────────────────

interface PermStore {
    /** Tool names marked "always allow". */
    alwaysAllow: string[];
}

let _cache: PermStore | null = null;

function load(): PermStore {
    if (_cache) return _cache;
    try {
        const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
        _cache = {alwaysAllow: Array.isArray(raw.alwaysAllow) ? raw.alwaysAllow : []};
    } catch {
        _cache = {alwaysAllow: []};
    }
    return _cache;
}

function save(s: PermStore): void {
    _cache = s;
    try {
        fs.mkdirSync(path.dirname(STORE_PATH), {recursive: true});
        writeJsonAtomic(STORE_PATH, s);
    } catch (e) {
        console.error("[permissions] could not save:", (e as Error).message);
    }
}

/** Has the user previously said "always allow" for this tool? */
export function isAlwaysAllowed(tool: string): boolean {
    return load().alwaysAllow.includes(tool);
}

/** Mark this tool as permanently allowed (never asked again). */
export function grantAlways(tool: string): void {
    const s = load();
    if (!s.alwaysAllow.includes(tool)) {
        save({alwaysAllow: [...s.alwaysAllow, tool]});
    }
}

/** Revoke the permanent permission. */
export function revokeAlways(tool: string): void {
    const s = load();
    save({alwaysAllow: s.alwaysAllow.filter((t) => t !== tool)});
}

/** For tests: reset the in-memory cache (forces a re-read from disk). */
export function _resetCache(): void { _cache = null; }

/**
 * Gate decision: does this call REQUIRE approval?
 * Destructive + no permanent permission yet → true (UI must ask for approval).
 * Otherwise false.
 */
export function needsApproval(tool: string, args: Record<string, unknown>): boolean {
    if (classifyRisk(tool, args) !== "destructive") return false;
    return !isAlwaysAllowed(tool);
}

/**
 * Phase 52 — Routines (deterministic multi-step action recording)
 *
 * Difference from a macro: a macro records the natural-language command TEXT and sends it
 * back to the LLM via `chat-stream-inject` (slow, fuzzy). A routine instead captures the
 * TOOL CALLS ({tool, args}) and runs them deterministically via `executeTool` directly —
 * without going back to the LLM, just like the reference-resolver. Solid for the "Jarvis feel".
 *
 * Flow:
 *   "Start recording: Game Mode" → startRecording("Game Mode")
 *   (the user gives normal commands; action tools are captured automatically)
 *   "Stop recording"             → stopRecording() → written to routines.json
 *   "Open Game Mode"             → runRoutine's steps run in order via executeTool
 *
 * Recording SCOPE: only STATE-CHANGING action tools (spotify/steam/system/file…).
 * Read-only tools (web_search, screenshot, list_*, *_now_playing …) are not added to a
 * routine — so re-running it stays clean and meaningful.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {reportCorruptedFile} from "./corrupted-file-tracker";

export interface RoutineStep {
    tool: string;
    args: Record<string, unknown>;
}

export interface Routine {
    id: string;
    name: string;
    steps: RoutineStep[];
    createdAt: string;
    updatedAt: string;
}

const ROUTINES_PATH = path.join(os.homedir(), ".aegis", "routines.json");

// ---- persistence ----

function ensureDir(): void {
    fs.mkdirSync(path.dirname(ROUTINES_PATH), {recursive: true});
}

function loadRoutines(): Routine[] {
    let raw: string;
    try {
        raw = fs.readFileSync(ROUTINES_PATH, "utf-8");
    } catch {
        return [];
    }
    try {
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch {
        reportCorruptedFile("routines (routines.json)");
        try { fs.copyFileSync(ROUTINES_PATH, ROUTINES_PATH + ".bak"); } catch { /* best-effort backup */ }
        return [];
    }
}

function saveRoutines(routines: Routine[]): void {
    ensureDir();
    fs.writeFileSync(ROUTINES_PATH, JSON.stringify(routines, null, 2), "utf-8");
}

function makeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function findRoutine(routines: Routine[], idOrName: string): number {
    const q = idOrName.trim().toLowerCase();
    // exact id first, then exact name, then partial name
    let idx = routines.findIndex((r) => r.id === idOrName);
    if (idx !== -1) return idx;
    idx = routines.findIndex((r) => r.name.toLowerCase() === q);
    if (idx !== -1) return idx;
    return routines.findIndex((r) => r.name.toLowerCase().includes(q));
}

// ---- which tools are worth recording ----

/**
 * Read-only / side-effect-free tools — NOT recorded into a routine.
 * So that re-running a routine doesn't repeat unnecessary searches/screenshots.
 */
const READONLY_PREFIXES = ["list_", "get_"];
const READONLY_TOOLS = new Set<string>([
    "web_search", "fetch_url", "screenshot", "analyze_screen", "screen_size",
    "spotify_now_playing", "spotify_get_queue", "spotify_recently_played",
    "spotify_me", "spotify_search", "steam_list", "steam_game_running",
    "read_file", "read_clipboard", "system_report", "get_weather",
    "search_knowledge", "content_search", "file_search", "app_search",
    "list_windows", "git_status", "git_log", "git_diff",
    // routine/macro/agent meta-tools must never go inside a routine
    "start_macro", "stop_macro", "run_macro", "list_macros", "delete_macro",
    "agent_run", "computer_use",
]);

/** Is this tool a state-changing action? (worth recording) */
export function isRecordableTool(tool: string): boolean {
    if (tool.startsWith("routine_")) return false;
    if (READONLY_TOOLS.has(tool)) return false;
    if (tool.endsWith("_list") || tool.endsWith("_now_playing")) return false;
    for (const p of READONLY_PREFIXES) if (tool.startsWith(p)) return false;
    return true;
}

// ---- recording state (RAM) ----

let recording: {name: string; steps: RoutineStep[]} | null = null;

export function isRecording(): boolean {
    return recording !== null;
}

export function recordingName(): string | null {
    return recording?.name ?? null;
}

export function startRecording(name: string): string {
    const clean = name.trim() || "Unnamed Routine";
    if (recording) {
        return `The routine "${recording.name}" is already being recorded (${recording.steps.length} steps). Say "stop recording" first.`;
    }
    recording = {name: clean, steps: []};
    return `🔴 Recording of routine "${clean}" started. Now give the actions you want me to do as commands; say "stop recording" when done.`;
}

/**
 * Called from the runAgent tool loop after each successful action tool.
 * Silently ignored if recording is not active or the tool isn't worth recording.
 */
export function captureStep(tool: string, args: Record<string, unknown>): void {
    if (!recording) return;
    if (!isRecordableTool(tool)) return;
    recording.steps.push({tool, args});
}

export function stopRecording(): string {
    if (!recording) return "No active routine recording.";
    const {name, steps} = recording;
    recording = null;

    if (steps.length === 0) {
        return `No action was recorded for the routine "${name}". Routine was not created.`;
    }

    const routines = loadRoutines();
    const now = new Date().toISOString();
    const existing = findRoutine(routines, name);
    if (existing !== -1 && routines[existing].name.toLowerCase() === name.toLowerCase()) {
        routines[existing] = {...routines[existing], steps, updatedAt: now};
        saveRoutines(routines);
        return `✅ Routine "${name}" updated (${steps.length} steps).`;
    }
    routines.push({id: makeId(), name, steps, createdAt: now, updatedAt: now});
    saveRoutines(routines);
    return `✅ Routine "${name}" saved (${steps.length} steps). You can repeat it by saying "open/run ${name}".`;
}

/** Cancel recording without saving. */
export function cancelRecording(): string {
    if (!recording) return "No active routine recording.";
    const name = recording.name;
    recording = null;
    return `Recording of routine "${name}" cancelled (not saved).`;
}

// ---- CRUD ----

export function listRoutines(): string {
    const routines = loadRoutines();
    if (routines.length === 0) return "No saved routines. You can create one with 'start recording: <name>'.";
    return routines
        .map((r) => `• ${r.name} (${r.steps.length} steps, ID: ${r.id})`)
        .join("\n");
}

export function deleteRoutine(idOrName: string): string {
    const routines = loadRoutines();
    const idx = findRoutine(routines, idOrName);
    if (idx === -1) return `No routine found named "${idOrName}".`;
    const removed = routines.splice(idx, 1)[0];
    saveRoutines(routines);
    return `🗑️ Routine "${removed.name}" deleted.`;
}

export function renameRoutine(idOrName: string, newName: string): string {
    const clean = newName.trim();
    if (!clean) return "The new name cannot be empty.";
    const routines = loadRoutines();
    const idx = findRoutine(routines, idOrName);
    if (idx === -1) return `No routine found named "${idOrName}".`;
    const old = routines[idx].name;
    routines[idx].name = clean;
    routines[idx].updatedAt = new Date().toISOString();
    saveRoutines(routines);
    return `✏️ Renamed "${old}" → "${clean}".`;
}

/** Remove a step (1-based index). */
export function deleteRoutineStep(idOrName: string, stepNumber: number): string {
    const routines = loadRoutines();
    const idx = findRoutine(routines, idOrName);
    if (idx === -1) return `No routine found named "${idOrName}".`;
    const r = routines[idx];
    if (stepNumber < 1 || stepNumber > r.steps.length) {
        return `Invalid step number ${stepNumber}. The routine "${r.name}" has ${r.steps.length} steps.`;
    }
    const removed = r.steps.splice(stepNumber - 1, 1)[0];
    r.updatedAt = new Date().toISOString();
    saveRoutines(routines);
    return `Step ${stepNumber} (${removed.tool}) removed from routine "${r.name}". Remaining: ${r.steps.length} steps.`;
}

/** Show a routine's steps in readable form (before editing). */
export function showRoutine(idOrName: string): string {
    const routines = loadRoutines();
    const idx = findRoutine(routines, idOrName);
    if (idx === -1) return `No routine found named "${idOrName}".`;
    const r = routines[idx];
    if (r.steps.length === 0) return `Routine "${r.name}" is empty.`;
    const lines = r.steps.map((s, i) => {
        const argStr = Object.entries(s.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
        return `  ${i + 1}. ${s.tool}(${argStr})`;
    });
    return `Routine "${r.name}" (${r.steps.length} steps):\n${lines.join("\n")}`;
}

/** Return the steps for execution (null = not found). */
export function getRoutine(idOrName: string): Routine | null {
    const routines = loadRoutines();
    const idx = findRoutine(routines, idOrName);
    return idx === -1 ? null : routines[idx];
}

// ---- test helper ----

/** For test isolation: reset the file and recording state. */
export function _resetForTest(): void {
    recording = null;
    try { fs.rmSync(ROUTINES_PATH, {force: true}); } catch { /* none */ }
}

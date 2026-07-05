// AEGIS — error report system (IdeasByAuthor: rapor sistemi)
//
// Two producers, one Supabase table (error_reports, insert-only under RLS):
//   - the user, via the bug-report form in Settings → About
//   - AEGIS itself, auto-reporting unhandled main-process errors
//
// Reports need a signed-in Supabase session (RLS requires auth.uid()).
// When offline or signed out, reports land in a local queue
// (~/.aegis/report-queue.json) and are flushed on the next submit/startup.
//
// AI auto-reports are deduplicated (same error reported once per day) and
// capped per day so a crash loop can't flood the table.

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import {getAuthClient, getSession} from "./auth";
import {writeJsonAtomic} from "./json-store";

const AEGIS_DIR = path.join(os.homedir(), ".aegis");
const QUEUE_PATH = path.join(AEGIS_DIR, "report-queue.json");
const AI_STATE_PATH = path.join(AEGIS_DIR, "report-ai-state.json");

export const REPORT_QUEUE_MAX = 50;
export const AI_REPORT_DAILY_CAP = 5;

export interface ErrorReportInput {
    source: "user" | "ai";
    title: string;
    description?: string;
    context?: Record<string, unknown>;
    /** Optional screenshot as a data URL (jpeg/png). Stored in context.screenshot. */
    screenshot?: string;
}

// A screenshot bigger than this won't fit comfortably in a DB row — drop it
// rather than fail the whole report. ~1.1MB base64 ≈ 800KB JPEG.
export const SCREENSHOT_MAX_CHARS = 1_100_000;

export interface ErrorReportResult {
    ok: boolean;
    queued: boolean;
    error?: string;
}

interface QueuedReport extends ErrorReportInput {
    createdAt: string;
}

let _appVersion = "";
export function setReportAppVersion(v: string): void {
    _appVersion = v;
}

// Injectable for tests — the default hits Supabase for real.
type InsertFn = (row: Record<string, unknown>) => Promise<{error: {message: string} | null}>;
let _insert: InsertFn = async (row) => {
    const {error} = await getAuthClient().from("error_reports").insert(row);
    return {error: error ? {message: error.message} : null};
};
let _getUserId: () => Promise<string | null> = async () => {
    const session = await getSession();
    return session?.user?.id ?? null;
};
export function _setReportDepsForTests(deps: {insert?: InsertFn; getUserId?: () => Promise<string | null>}): void {
    if (deps.insert) _insert = deps.insert;
    if (deps.getUserId) _getUserId = deps.getUserId;
}

function readJson<T>(p: string, fallback: T): T {
    try {
        return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
    } catch {
        return fallback;
    }
}

function readQueue(): QueuedReport[] {
    const q = readJson<QueuedReport[]>(QUEUE_PATH, []);
    return Array.isArray(q) ? q : [];
}

function enqueue(report: QueuedReport): void {
    const q = readQueue();
    q.push(report);
    // Oldest reports drop first — a persistent failure shouldn't grow the file forever.
    writeJsonAtomic(QUEUE_PATH, q.slice(-REPORT_QUEUE_MAX));
}

function clampTitle(t: string): string {
    const clean = t.trim().slice(0, 200);
    return clean || "(untitled report)";
}

function validScreenshot(s: string | undefined): string | null {
    if (!s || !s.startsWith("data:image/") || s.length > SCREENSHOT_MAX_CHARS) return null;
    return s;
}

async function insertReport(userId: string, r: ErrorReportInput): Promise<{ok: boolean; error?: string}> {
    const shot = validScreenshot(r.screenshot);
    const {error} = await _insert({
        user_id: userId,
        source: r.source,
        title: clampTitle(r.title),
        description: (r.description ?? "").slice(0, 4000),
        context: {...(r.context ?? {}), ...(shot ? {screenshot: shot} : {})},
        app_version: _appVersion,
    });
    return error ? {ok: false, error: error.message} : {ok: true};
}

/**
 * Submit a report. Signed out / network down → queued locally, resent later.
 * Never throws: reporting a bug must not itself become a bug.
 */
export async function submitReport(input: ErrorReportInput): Promise<ErrorReportResult> {
    try {
        const userId = await _getUserId();
        if (!userId) {
            enqueue({...input, createdAt: new Date().toISOString()});
            return {ok: false, queued: true, error: "not signed in"};
        }
        // Piggyback: whenever a live submit works, drain anything queued too.
        const res = await insertReport(userId, input);
        if (!res.ok) {
            enqueue({...input, createdAt: new Date().toISOString()});
            return {ok: false, queued: true, error: res.error};
        }
        await flushReportQueue();
        return {ok: true, queued: false};
    } catch (e) {
        try {
            enqueue({...input, createdAt: new Date().toISOString()});
        } catch { /* disk full etc. — give up silently */ }
        return {ok: false, queued: true, error: (e as Error).message ?? String(e)};
    }
}

/** Try to send everything in the local queue. Stops at the first failure. */
export async function flushReportQueue(): Promise<number> {
    const q = readQueue();
    if (q.length === 0) return 0;
    const userId = await _getUserId();
    if (!userId) return 0;
    let sent = 0;
    for (const r of q) {
        // Original timestamp travels in context so the report isn't misdated.
        const res = await insertReport(userId, {
            ...r,
            context: {...(r.context ?? {}), queuedAt: r.createdAt},
        });
        if (!res.ok) break;
        sent++;
    }
    if (sent > 0) writeJsonAtomic(QUEUE_PATH, q.slice(sent));
    return sent;
}

export function pendingReportCount(): number {
    return readQueue().length;
}

// ── AI auto-reports ──────────────────────────────────────────────────────────

interface AiReportState {
    day: string;
    count: number;
    hashes: string[];
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function readAiState(): AiReportState {
    const s = readJson<AiReportState>(AI_STATE_PATH, {day: today(), count: 0, hashes: []});
    if (s.day !== today()) return {day: today(), count: 0, hashes: []};
    return {day: s.day, count: s.count ?? 0, hashes: Array.isArray(s.hashes) ? s.hashes : []};
}

/**
 * AEGIS reports its own error. Fire-and-forget from crash handlers — dedupes
 * identical errors within the day and stops after AI_REPORT_DAILY_CAP so a
 * crash loop can't flood Supabase (or the local queue).
 * Returns true if the report was accepted (sent or queued), false if skipped.
 */
export async function reportAiError(title: string, detail: string, context?: Record<string, unknown>): Promise<boolean> {
    try {
        const state = readAiState();
        const hash = crypto.createHash("sha256").update(`${title}\n${detail.slice(0, 500)}`).digest("hex").slice(0, 16);
        if (state.hashes.includes(hash) || state.count >= AI_REPORT_DAILY_CAP) return false;
        state.hashes.push(hash);
        state.count++;
        writeJsonAtomic(AI_STATE_PATH, state);
        await submitReport({
            source: "ai",
            title,
            description: detail.slice(0, 4000),
            context: {...(context ?? {}), platform: process.platform},
        });
        return true;
    } catch {
        return false;
    }
}

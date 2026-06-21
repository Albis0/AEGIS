/**
 * Phase 53 — Loop Guard & Action Budget
 *
 * The 8-step limit in `runAgent` does NOT solve degenerate loops, it just cuts them off late:
 * a model calling the same tool over and over burns tokens/money + creates the feeling that
 * "AEGIS is stuck". This module detects and stops degenerate tool-call patterns EARLY.
 *
 * Three detected patterns:
 *   1. Same (tool, args) call repeated N times              → MAX_IDENTICAL
 *   2. A-B-A-B ping-pong (oscillation between two tools)    → PING_PONG_REPEATS
 *   3. Excessive calls of a polling (status-querying) tool  → POLL_BUDGET
 *
 * Pure data + pure functions — NOT dependent on Electron, the filesystem, or the network.
 * Each `runAgent` loop opens its own `LoopGuard` instance (parallel-request isolation).
 */

/** The verdict for a tool call: run it, or why it was blocked. */
export interface GuardVerdict {
    ok: boolean;
    /** If blocked, a short reason to show the user/model. */
    reason?: string;
    /** Which pattern triggered (for telemetry / tests). */
    pattern?: "identical" | "ping_pong" | "poll_budget";
}

/** Blocked when the same (tool,args) call is seen this many times (the 3rd call is blocked). */
export const MAX_IDENTICAL = 3;
/** An A-B-A-B pattern is searched within the last this-many calls. */
export const PING_PONG_WINDOW = 4;
/** Ping-pong: blocked once the A↔B oscillation completes this many full cycles. */
export const PING_PONG_REPEATS = 2;
/** Loose budget for polling tools (status queries are normally called a lot). */
export const POLL_BUDGET = 6;

/**
 * Polling / read-only status tools — repeated calls in the loop are NORMAL
 * (e.g. download progress, telemetry). identical/ping-pong are not applied to these;
 * only the looser POLL_BUDGET applies. Name-fragment match (substring).
 */
const POLL_TOOL_HINTS = [
    "status", "durum", "get_", "list_", "telemetry", "telemetri",
    "check", "watch", "progress", "ilerleme", "read_", "fetch_url",
    "ping", "system_report", "usage",
];

function isPollTool(tool: string): boolean {
    const t = tool.toLowerCase();
    return POLL_TOOL_HINTS.some((h) => t.includes(h));
}

/**
 * Converts the args object into a deterministic signature (key order shouldn't matter).
 * Invalid/unparsable args are used as a raw string — still yielding a stable hash.
 */
function hashCall(tool: string, args: unknown): string {
    let argPart: string;
    try {
        if (args && typeof args === "object") {
            const sorted = Object.keys(args as Record<string, unknown>)
                .sort()
                .reduce<Record<string, unknown>>((acc, k) => {
                    acc[k] = (args as Record<string, unknown>)[k];
                    return acc;
                }, {});
            argPart = JSON.stringify(sorted);
        } else {
            argPart = String(args ?? "");
        }
    } catch {
        argPart = String(args ?? "");
    }
    return `${tool}::${argPart}`;
}

export class LoopGuard {
    /** Call signature → how many times it was seen. */
    private counts = new Map<string, number>();
    /** Time-ordered history of tool names only (for ping-pong detection). */
    private toolSeq: string[] = [];
    /** Polling tool name → budget counter. */
    private pollCounts = new Map<string, number>();

    /**
     * Call this BEFORE a tool call is EXECUTED. If it's allowed to run, it updates
     * the counters and returns `{ok:true}`; if a degenerate pattern is detected it
     * returns `{ok:false, reason}` and the call should be skipped.
     */
    check(tool: string, args: unknown): GuardVerdict {
        // ── Polling tools: loose budget only ─────────────────────────────────
        if (isPollTool(tool)) {
            const n = (this.pollCounts.get(tool) ?? 0) + 1;
            this.pollCounts.set(tool, n);
            this.toolSeq.push(tool);
            if (n > POLL_BUDGET) {
                return {
                    ok: false,
                    pattern: "poll_budget",
                    reason: `The "${tool}" status query repeated ${POLL_BUDGET} times; the result doesn't seem to change. Stopping the loop.`,
                };
            }
            return {ok: true};
        }

        // ── Same (tool,args) repetition ──────────────────────────────────────
        const sig = hashCall(tool, args);
        const seen = (this.counts.get(sig) ?? 0) + 1;
        this.counts.set(sig, seen);
        this.toolSeq.push(tool);

        if (seen >= MAX_IDENTICAL) {
            return {
                ok: false,
                pattern: "identical",
                reason: `I'm attempting the same action ("${tool}") with the same arguments for the ${seen}th time — the result won't change. I've stopped the loop.`,
            };
        }

        // ── A-B-A-B ping-pong ────────────────────────────────────────────────
        if (this.detectPingPong()) {
            return {
                ok: false,
                pattern: "ping_pong",
                reason: `I'm going back and forth between two actions ("${this.toolSeq[this.toolSeq.length - 2]}" ↔ "${tool}"). This is a loop; I've stopped.`,
            };
        }

        return {ok: true};
    }

    /**
     * Is there an A-B-A-B pattern (at least PING_PONG_REPEATS full cycles) in the
     * last PING_PONG_WINDOW calls? Only a fully alternating oscillation of two distinct tools counts.
     */
    private detectPingPong(): boolean {
        const seq = this.toolSeq;
        const need = PING_PONG_WINDOW;
        if (seq.length < need) return false;
        const tail = seq.slice(-need);
        const a = tail[0];
        const b = tail[1];
        if (a === b) return false; // not an oscillation, just same-tool repetition (covered by identical)
        for (let i = 0; i < need; i++) {
            const expected = i % 2 === 0 ? a : b;
            if (tail[i] !== expected) return false;
        }
        return true;
    }

    /** Test/telemetry: how many times a signature has been called so far. */
    countOf(tool: string, args: unknown): number {
        return this.counts.get(hashCall(tool, args)) ?? 0;
    }
}

/**
 * Phase 59 — Self-Healing: Recurring Error Recognition
 *
 * The loop-guard (Phase 53) cuts off repeating the SAME call; but if a tool keeps
 * returning the SAME error even with DIFFERENT arguments (e.g. every spotify_* call
 * fails with "Premium required"), that is blind repetition — the root cause is the
 * same. This module recognizes the (tool-family, error-class) pattern in STM history
 * and proposes a CLEAR diagnosis + strategy.
 *
 * Pure function — takes STM entries, returns a diagnosis (Electron/IO independent).
 * Shares the error class with classifyError (Phase 56).
 *
 * Inspired by the OpenJarvis `agents/errors.py` classify_error taxonomy; trace-mining
 * NOT adopted.
 */

import {classifyError, type ErrorKind} from "./goal-executor";

export interface HealEntry {
    tool: string;
    success: boolean;
    result: string;
}

export interface Diagnosis {
    /** Was a recurring error pattern found? */
    detected: boolean;
    /** How many times it repeated. */
    count: number;
    /** The error class of the pattern. */
    kind: ErrorKind | null;
    /** Tool family (prefix, e.g. "spotify") — to catch same-domain repetition. */
    family: string | null;
    /** Clear diagnosis + strategy to present to the model/user (empty = none). */
    advice: string;
}

const NONE: Diagnosis = {detected: false, count: 0, kind: null, family: null, advice: ""};

/** Extract the tool family: the part before the first "_" ("spotify_play" → "spotify"). */
function familyOf(tool: string): string {
    const i = tool.indexOf("_");
    return i > 0 ? tool.slice(0, i) : tool;
}

/** A domain-specific, actionable diagnosis sentence for the same error class. */
function adviceFor(family: string, kind: ErrorKind, count: number): string {
    const base = `I got the same kind of error (${kind}) ${count} times with "${family}" — instead of blind repetition, the situation has changed.`;
    const hint: Partial<Record<ErrorKind, string>> = {
        permission: `This is a permission/access problem (e.g. ${family === "spotify" ? "Spotify Premium / re-authorization" : "missing key/permission"}). Retrying won't fix it; tell the user what access is needed.`,
        not_found: `The target can't be found. Don't retry with the same name/path; verify the name, try an alternative source, or ask the user to clarify.`,
        transient: `A temporary problem persists (network/service). It could be retried later; for now stop and suggest the user check the connection/service status.`,
        invalid_args: `The argument format keeps being rejected. Review the schema/format; try a different parameter combination.`,
        fatal: `An unrecoverable error continues. Stop the task and report the clear diagnosis to the user.`,
        blocked: `The action is repeatedly blocked (permission/loop). Change the approach or ask for user approval.`,
    };
    return `${base} ${hint[kind] ?? "Change the approach or consult the user."}`;
}

/**
 * Search the STM history for a recurring error pattern. Catches the case where the
 * same tool FAMILY fails with the same error CLASS `threshold` (default 3) or more
 * times. Looks backwards from the most recent errors; returns the first matching pattern.
 */
export function diagnose(recent: HealEntry[], threshold = 3): Diagnosis {
    // (family + kind) → counter
    const counts = new Map<string, {family: string; kind: ErrorKind; n: number}>();
    for (const e of recent) {
        if (e.success) continue;
        const v = classifyError(e.result);
        if (!v.isError) continue;
        const family = familyOf(e.tool);
        const key = `${family}::${v.kind}`;
        const cur = counts.get(key) ?? {family, kind: v.kind, n: 0};
        cur.n++;
        counts.set(key, cur);
    }
    let worst: {family: string; kind: ErrorKind; n: number} | null = null;
    for (const v of counts.values()) {
        if (v.n >= threshold && (!worst || v.n > worst.n)) worst = v;
    }
    if (!worst) return NONE;
    return {
        detected: true,
        count: worst.n,
        kind: worst.kind,
        family: worst.family,
        advice: adviceFor(worst.family, worst.kind, worst.n),
    };
}

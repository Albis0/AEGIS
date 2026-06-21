/**
 * Phase 56 — Goal Executor: Plan → Step → Verify → Recover
 *
 * Until now `agent_run` was "try 8 steps, then give up": no plan, no intermediate
 * verification, no recovery when stuck. This module provides the VERIFICATION and
 * RECOVERY core of multi-step task execution (pure functions — Electron/IO-independent):
 *
 *   1. classifyError  — assigns a tool result to an error TAXONOMY (strategy change
 *                       instead of blind retry: retry / fix args / give up)
 *   2. verifyStep     — tells whether a step's result is "progress" or "stuck"
 *   3. buildPlanPrompt— turns a goal into a plan-based agent prompt (step + verification)
 *
 * Distilled from OpenJarvis `agents/executor.py` error taxonomy (classify_error/retry/
 * escalate/fatal). The meta-planner was NOT adopted.
 */

/** The error class of a tool result. */
export type ErrorKind =
    | "ok"          // success — the result is not an error
    | "transient"   // transient (network/timeout/busy) → RETRY makes sense
    | "permission"  // auth/permission denial → retry is pointless; ask the user
    | "not_found"   // target missing (file/device/game) → CHANGE the argument/target
    | "invalid_args"// argument/schema error → FIX the argument, don't repeat the same
    | "blocked"     // loop-guard / permission gate / disabled → accept the state, stop
    | "fatal";      // unrecoverable → end the task, give a clear diagnosis

export interface ErrorVerdict {
    kind: ErrorKind;
    /** Is this result an error? (kind !== "ok") */
    isError: boolean;
    /** Does retrying the same call make sense? */
    retriable: boolean;
    /** A short guidance string for the model/user. */
    advice: string;
}

// Patterns searched in the result text (executeTool/tool results are a mix of Turkish + English).
const PATTERNS: {kind: ErrorKind; re: RegExp; retriable: boolean; advice: string}[] = [
    {kind: "blocked", re: /^ENGELLENDI|loop koruması|döngü koruması|kullanıcı onayı reddedildi|devre dışı/i,
        retriable: false, advice: "Action blocked (loop/permission/disabled). Don't retry; explain the situation to the user."},
    {kind: "permission", re: /\b(401|403|unauthorized|forbidden|yetki|izin yok|permission denied|access denied|premium gerek)/i,
        retriable: false, advice: "Auth/permission issue. Don't retry; ask the user for the required access/key."},
    {kind: "not_found", re: /\b(404|not found|bulunamadı|yok\b|mevcut değil|no such|tanımlı değil|geçersiz oyun|cihaz yok)/i,
        retriable: false, advice: "Target not found. Don't repeat with the same argument; fix the name/path/target or try an alternative."},
    {kind: "invalid_args", re: /\b(geçersiz|invalid|bad request|400|422|eksik (parametre|argüman)|yanlış format|parse)/i,
        retriable: false, advice: "Argument/schema error. Don't send the same arguments; fix them and retry."},
    {kind: "transient", re: /\b(zaman aşımı|timeout|econn|etimedout|503|502|429|rate limit|geçici|temporarily|meşgul|busy|try again)/i,
        retriable: true, advice: "Transient error. Waiting briefly and trying ONE more time makes sense."},
    {kind: "fatal", re: /^HATA|^Araç hatası|çalışırken hata|crash|fatal|exception/i,
        retriable: false, advice: "Unrecoverable error. Stop the task and provide a clear diagnosis."},
];

/**
 * Assigns a tool result to the error taxonomy. If the result is successful, kind="ok".
 * Match order matters (most specific to loosest): blocked > permission > not_found
 * > invalid_args > transient > fatal.
 */
export function classifyError(result: string): ErrorVerdict {
    const text = String(result ?? "");
    for (const p of PATTERNS) {
        if (p.re.test(text)) {
            return {kind: p.kind, isError: true, retriable: p.retriable, advice: p.advice};
        }
    }
    return {kind: "ok", isError: false, retriable: false, advice: ""};
}

/**
 * Step verification: did a step's result move the task forward, or did it get stuck?
 * "progress" → continue; "stuck" → change strategy (per advice); "fail" → stop.
 */
export interface StepVerdict {
    status: "progress" | "retry" | "stuck" | "fail";
    advice: string;
}

export function verifyStep(result: string): StepVerdict {
    const v = classifyError(result);
    if (!v.isError) return {status: "progress", advice: ""};
    if (v.retriable) return {status: "retry", advice: v.advice};
    if (v.kind === "fatal" || v.kind === "blocked") return {status: "fail", advice: v.advice};
    return {status: "stuck", advice: v.advice};
}

/**
 * Turns a goal into a plan-based agent prompt. Difference from plain "do it step by step":
 * a short plan is requested BEFORE, verification AFTER each step, and an alternative when
 * stuck (Phase 53 loop-guard + Phase 54 permission gate are already active in the loop).
 */
export function buildPlanPrompt(goal: string, maxSteps: number): string {
    return [
        `[AGENT MODE — PLAN, ACT, VERIFY · max ${maxSteps} steps]`,
        `Goal: ${goal}`,
        ``,
        `How you work:`,
        `1) First break the goal into 2-5 concrete steps and briefly write the plan.`,
        `2) Do each step with the appropriate tool. After a step, CHECK the result:`,
        `   - If successful, move to the next step.`,
        `   - If the target was not found (no file/device/game), don't retry the SAME argument; fix the name/path or try an alternative.`,
        `   - If it's an auth/permission error, don't retry; tell the user what is required.`,
        `   - If it's a transient error (timeout/busy), retry at most ONE more time.`,
        `3) If you get stuck on a step and can't progress, STOP; summarize what you did, where you got stuck, and your suggestion. Don't retry forever.`,
        `4) When done, give a short closing summary (what was done / what couldn't be done).`,
    ].join("\n");
}

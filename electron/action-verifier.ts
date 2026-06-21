/**
 * Phase 60 — Computer Use Verification Loop
 *
 * Phase 47 computer-use is BLIND coordinate clicking: it clicks and doesn't see the
 * result. If the target has shifted (window moved, layout changed) it silently clicks
 * the wrong place. This module provides the pure core of the "click → VERIFY whether the
 * screen changed → if not, notice it" loop: it compares two screenshots and tells whether
 * the action had ANY EFFECT.
 *
 * Pure functions (Electron/IO independent). The real screenshot comes from a main.ts
 * callback; here there's only hash + comparison + decision logic → testable.
 *
 * Inspired by the spirit of OpenJarvis `tools/browser_axtree.py` (semantic instead of
 * coordinate); a full UIAutomation element-tree is left optional/for later (NICE-TO-HAVE).
 */

/**
 * Produces a lightweight, deterministic signature from a base64 image. Not cryptographic —
 * the goal is to cheaply measure "are two frames the same / how different are they". It
 * splits the image into a fixed number of chunks and takes each chunk's character-sum →
 * a chunk-signature array. This catches partial change (a single region) too, and is more
 * informative than a whole-frame hash.
 */
export function frameSignature(base64: string, buckets = 16): number[] {
    const sig = new Array(buckets).fill(0);
    if (!base64) return sig;
    const len = base64.length;
    const span = Math.max(1, Math.floor(len / buckets));
    for (let i = 0; i < len; i++) {
        const b = Math.min(buckets - 1, Math.floor(i / span));
        // cheap, order-sensitive mix
        sig[b] = (sig[b] * 31 + base64.charCodeAt(i)) >>> 0;
    }
    return sig;
}

/**
 * Normalized difference between two signatures [0..1]. 0 = same, 1 = all chunks differ.
 * (Based on the chunk-equality ratio — noise-resistant, suitable for thresholding.)
 */
export function signatureDiff(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    if (n === 0) return 0;
    let diff = 0;
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) diff++;
    return diff / n;
}

export interface VerifyResult {
    /** Did the action make a visible change on screen? */
    changed: boolean;
    /** Normalized difference amount [0..1]. */
    diff: number;
    /** Short report to present to the model/user. */
    note: string;
}

/**
 * Compares the before/after frames of an action and reports the effect. Difference below
 * `threshold` = "didn't change" (the click probably missed its target). When `changed=false`
 * the caller can retry or stop and ask.
 */
export function verifyChange(beforeB64: string, afterB64: string, threshold = 1 / 16): VerifyResult {
    // If the screenshot couldn't be taken (empty), verification isn't possible → instead of
    // "unknown", a safe assumption: don't treat it as changed, but add a clear note.
    if (!beforeB64 || !afterB64) {
        return {changed: false, diff: 0, note: "Verification not possible (could not capture a screenshot)."};
    }
    const diff = signatureDiff(frameSignature(beforeB64), frameSignature(afterB64));
    const changed = diff >= threshold;
    const note = changed
        ? `The screen changed after the action (${Math.round(diff * 100)}% difference) — the action took effect.`
        : `The screen barely changed after the action (${Math.round(diff * 100)}% difference) — the click may have missed its target; verify the coordinates or try again.`;
    return {changed, diff, note};
}

/**
 * Helper that coordinates a verified-action flow. `snapshot` is a callback returning the
 * real screenshot (base64); `doAction` is the callback executing the action.
 * Order: take-frame → action → take-frame → compare. Returns the action result + verification note.
 */
export async function actWithVerification(
    snapshot: () => Promise<string>,
    doAction: () => Promise<string>,
    threshold = 1 / 16,
): Promise<{actionResult: string; verify: VerifyResult}> {
    const before = await snapshot().catch(() => "");
    const actionResult = await doAction();
    const after = await snapshot().catch(() => "");
    const verify = verifyChange(before, after, threshold);
    return {actionResult, verify};
}

import {describe, it, expect} from "vitest";
import {frameSignature, signatureDiff, verifyChange, actWithVerification} from "../../electron/action-verifier";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 60 — Computer Use verification loop. A blind coordinate click that
// misses its target silently clicks the wrong place. This module compares the
// before/after frame to tell whether the action "took effect". A wrong
// threshold either misses the miss or mistakes noise for change; we lock it.
// ─────────────────────────────────────────────────────────────────────────────

describe("frameSignature & signatureDiff", () => {
    it("identical image → diff 0", () => {
        const img = "AAAABBBBCCCCDDDDEEEEFFFF".repeat(20);
        expect(signatureDiff(frameSignature(img), frameSignature(img))).toBe(0);
    });

    it("completely different image → high diff", () => {
        const a = "A".repeat(400);
        const b = "Z".repeat(400);
        expect(signatureDiff(frameSignature(a), frameSignature(b))).toBeGreaterThan(0.5);
    });

    it("partial change → partial diff (not all sections)", () => {
        const a = "A".repeat(400);
        const b = "A".repeat(380) + "Z".repeat(20); // only the last region changed
        const d = signatureDiff(frameSignature(a), frameSignature(b));
        expect(d).toBeGreaterThan(0);
        expect(d).toBeLessThan(0.5);
    });

    it("empty image produces a signature without crashing", () => {
        expect(frameSignature("")).toHaveLength(16);
    });
});

describe("verifyChange", () => {
    it("screen changed → changed:true", () => {
        const before = "X".repeat(400);
        const after = "Y".repeat(400);
        const r = verifyChange(before, after);
        expect(r.changed).toBe(true);
        expect(r.note).toMatch(/took effect|changed/);
    });

    it("screen unchanged → changed:false + miss warning", () => {
        const same = "ABCD".repeat(100);
        const r = verifyChange(same, same);
        expect(r.changed).toBe(false);
        expect(r.note).toMatch(/missed|try again|verify/i);
    });

    it("screenshot unavailable (empty) → safe report", () => {
        const r = verifyChange("", "abc");
        expect(r.changed).toBe(false);
        expect(r.note).toMatch(/not possible/);
    });
});

describe("actWithVerification — flow", () => {
    it("snapshot → action → snapshot → compare runs in order", async () => {
        const frames = ["AAAA".repeat(100), "ZZZZ".repeat(100)]; // before, after
        let i = 0;
        const snapshot = async () => frames[Math.min(i++, frames.length - 1)];
        const doAction = async () => "clicked";
        const {actionResult, verify} = await actWithVerification(snapshot, doAction);
        expect(actionResult).toBe("clicked");
        expect(verify.changed).toBe(true);
    });

    it("reports a miss if the action didn't change the screen", async () => {
        const frame = "SAME".repeat(100);
        const {verify} = await actWithVerification(async () => frame, async () => "clicked");
        expect(verify.changed).toBe(false);
    });

    it("doesn't crash if snapshot throws (empty frame → verification not possible)", async () => {
        const snapshot = async () => { throw new Error("no screen"); };
        const {actionResult, verify} = await actWithVerification(snapshot, async () => "ok");
        expect(actionResult).toBe("ok");
        expect(verify.note).toMatch(/not possible/);
    });
});

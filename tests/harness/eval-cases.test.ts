import {describe, it, expect} from "vitest";
import {EVAL_CASES} from "./eval-cases.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 55 — Integrity of the eval case set. The actual scoring happens in
// tests/harness/tool-selection-eval.mjs (against dist-electron, npm run
// test:eval). Here we lock down the HEALTH of the case set: sufficient count,
// valid fields, uniqueness.
// (A broken case silently weakens the eval -> a regression goes unnoticed.)
// ─────────────────────────────────────────────────────────────────────────────

describe("eval case set integrity", () => {
    it("ROADMAP criterion: >=40 labeled scenarios", () => {
        expect(EVAL_CASES.length).toBeGreaterThanOrEqual(40);
    });

    it("every case carries a valid kind", () => {
        for (const c of EVAL_CASES) {
            expect(["offer", "resolver", "negative"]).toContain(c.kind);
        }
    });

    it("offer/resolver cases carry an expect tool; negative is null", () => {
        for (const c of EVAL_CASES) {
            if (c.kind === "negative") expect(c.expect).toBeNull();
            else expect(typeof c.expect).toBe("string");
        }
    });

    it("resolver cases carry a seed (to prime the STM)", () => {
        for (const c of EVAL_CASES.filter((x) => x.kind === "resolver")) {
            expect(Array.isArray(c.seed)).toBe(true);
            expect(c.seed.length).toBeGreaterThan(0);
        }
    });

    it("user messages are unique (duplicate cases don't inflate the score)", () => {
        const users = EVAL_CASES.map((c) => c.user);
        expect(new Set(users).size).toBe(users.length);
    });

    it("ROADMAP criterion: resolver scenarios are included", () => {
        expect(EVAL_CASES.some((c) => c.kind === "resolver")).toBe(true);
    });

    it("negative (pure chat) cases are included — catches false-positive tool selection", () => {
        expect(EVAL_CASES.some((c) => c.kind === "negative")).toBe(true);
    });
});

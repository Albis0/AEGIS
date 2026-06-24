import {describe, it, expect, beforeEach} from "vitest";
import {
    LoopGuard, MAX_IDENTICAL, POLL_BUDGET,
} from "../../electron/loop-guard";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 53 — Loop Guard. A degenerate tool-call loop = burning tokens/money and a
// "stuck" feeling. This module must catch three patterns early: identical-call
// repetition, A-B-A-B ping-pong, and polling exhaustion. We're locking down the
// behavior; any drift of the loose/strict thresholds in the wrong direction is
// caught by these tests.
// ─────────────────────────────────────────────────────────────────────────────

let g: LoopGuard;
beforeEach(() => { g = new LoopGuard(); });

describe("identical (tool,args) repetition", () => {
    it(`is blocked on the ${MAX_IDENTICAL}th call, earlier ones pass`, () => {
        const args = {file: "a.txt"};
        expect(g.check("delete_file", args).ok).toBe(true);  // 1
        expect(g.check("delete_file", args).ok).toBe(true);  // 2
        const v = g.check("delete_file", args);              // 3 → blocked
        expect(v.ok).toBe(false);
        expect(v.pattern).toBe("identical");
        expect(v.reason).toMatch(/delete_file/);
    });

    it("same tool with different args is not blocked (each is a separate signature)", () => {
        expect(g.check("write_file", {path: "a"}).ok).toBe(true);
        expect(g.check("write_file", {path: "b"}).ok).toBe(true);
        expect(g.check("write_file", {path: "c"}).ok).toBe(true);
    });

    it("args key order does not change the signature", () => {
        g.check("run_command", {a: 1, b: 2});
        g.check("run_command", {b: 2, a: 1});
        // Both calls should count as the same signature → count 2
        expect(g.countOf("run_command", {a: 1, b: 2})).toBe(2);
    });

    it("unparseable raw args still produce a stable hash", () => {
        g.check("x", "ham-string");
        g.check("x", "ham-string");
        const v = g.check("x", "ham-string");
        expect(v.ok).toBe(false);
    });
});

describe("A-B-A-B ping-pong", () => {
    it("the oscillation is caught on the 2nd round", () => {
        // different args so identical isn't triggered; the pattern is matched on tool NAME
        expect(g.check("open_app", {n: 1}).ok).toBe(true);   // A
        expect(g.check("close_app", {n: 1}).ok).toBe(true);  // B
        expect(g.check("open_app", {n: 2}).ok).toBe(true);   // A
        const v = g.check("close_app", {n: 2});              // B → A-B-A-B
        expect(v.ok).toBe(false);
        expect(v.pattern).toBe("ping_pong");
    });

    it("is not counted as ping-pong when a third tool occurs in between", () => {
        g.check("open_app", {n: 1});
        g.check("close_app", {n: 1});
        g.check("set_volume", {v: 1});
        g.check("open_app", {n: 2});
        const v = g.check("close_app", {n: 2});
        expect(v.ok).toBe(true);
    });
});

describe("polling budget", () => {
    it("a status tool does not get stuck on identical, runs with a looser budget", () => {
        // a tool name containing 'status' is counted as poll → passes even beyond MAX_IDENTICAL (3)
        for (let i = 0; i < POLL_BUDGET; i++) {
            expect(g.check("download_status", {id: "x"}).ok).toBe(true);
        }
    });

    it(`is blocked once the poll budget (${POLL_BUDGET}) is exceeded`, () => {
        for (let i = 0; i < POLL_BUDGET; i++) g.check("get_telemetry", {});
        const v = g.check("get_telemetry", {});
        expect(v.ok).toBe(false);
        expect(v.pattern).toBe("poll_budget");
    });

    it("list_/get_/check/durum/ilerleme names are counted as poll", () => {
        for (const name of ["list_files", "get_status", "check_health", "durum_sorgu", "indirme_ilerleme"]) {
            const gg = new LoopGuard();
            // repeated enough times (4) to exceed the identical threshold → should pass since it's poll
            for (let i = 0; i < MAX_IDENTICAL + 1; i++) {
                expect(gg.check(name, {}).ok, name).toBe(true);
            }
        }
    });
});

describe("isolation", () => {
    it("separate LoopGuard instances do not share counters", () => {
        const a = new LoopGuard();
        const b = new LoopGuard();
        a.check("t", {}); a.check("t", {});
        expect(a.countOf("t", {})).toBe(2);
        expect(b.countOf("t", {})).toBe(0);
    });
});

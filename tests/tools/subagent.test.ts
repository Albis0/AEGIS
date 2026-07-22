import {describe, it, expect, afterEach, vi} from "vitest";
import {executeToolText, _setSubAgentDepth, _setSpawnSubAgentCallback} from "../../electron/tools";

// ─────────────────────────────────────────────────────────────────────────────
// Faz CC-6 — spawn_subagent. The load-bearing safety is the recursion guard: a
// subagent must not spawn another subagent (depth 1), or a runaway chain could
// fan out unbounded. We also verify the result is returned to the caller, the
// depth is incremented DURING the call (so a nested spawn would be refused) and
// restored afterward, and empty/unregistered inputs fail cleanly.
// ─────────────────────────────────────────────────────────────────────────────

afterEach(() => {
    _setSubAgentDepth(0);
    _setSpawnSubAgentCallback(null);
});

describe("spawn_subagent", () => {
    it("returns the subagent's result", async () => {
        _setSpawnSubAgentCallback(async (task) => `handled: ${task}`);
        const out = await executeToolText("spawn_subagent", JSON.stringify({task: "summarize file A"}));
        expect(out).toContain("handled: summarize file A");
    });

    it("passes the task through to the runner", async () => {
        const spy = vi.fn(async () => "ok");
        _setSpawnSubAgentCallback(spy);
        await executeToolText("spawn_subagent", JSON.stringify({task: "do X"}));
        expect(spy).toHaveBeenCalledWith("do X");
    });

    it("refuses a nested spawn (depth guard)", async () => {
        _setSubAgentDepth(1); // simulate already running inside a subagent
        _setSpawnSubAgentCallback(async () => "should not run");
        const out = await executeToolText("spawn_subagent", JSON.stringify({task: "nested"}));
        expect(out).toMatch(/cannot spawn another subagent/i);
    });

    it("increments depth during the call and restores it after", async () => {
        let depthSeen = -1;
        _setSpawnSubAgentCallback(async () => {
            // While the runner is executing, a re-entrant spawn must be refused.
            depthSeen = 1;
            const nested = await executeToolText("spawn_subagent", JSON.stringify({task: "inner"}));
            return `inner-result: ${nested}`;
        });
        const out = await executeToolText("spawn_subagent", JSON.stringify({task: "outer"}));
        expect(depthSeen).toBe(1);
        expect(out).toMatch(/cannot spawn another subagent/i); // the inner spawn was refused
        // After the whole thing, depth is back to 0 → a fresh spawn works again.
        _setSpawnSubAgentCallback(async () => "fresh");
        const again = await executeToolText("spawn_subagent", JSON.stringify({task: "after"}));
        expect(again).toContain("fresh");
    });

    it("errors on an empty task", async () => {
        _setSpawnSubAgentCallback(async () => "x");
        const out = await executeToolText("spawn_subagent", JSON.stringify({task: "   "}));
        expect(out).toMatch(/ERROR/);
    });

    it("errors when no runner is registered", async () => {
        _setSpawnSubAgentCallback(null);
        const out = await executeToolText("spawn_subagent", JSON.stringify({task: "hello"}));
        expect(out).toMatch(/not registered/i);
    });
});

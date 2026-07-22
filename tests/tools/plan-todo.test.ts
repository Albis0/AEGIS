import {describe, it, expect} from "vitest";
import {executeToolText} from "../../electron/tools";

// ─────────────────────────────────────────────────────────────────────────────
// Faz CC-3 — plan_todo (live plan / TodoWrite parity). The executor normalizes
// the model's steps (drops empty text, coerces unknown statuses to pending,
// clamps to 20) and returns a checkbox summary. The renderer callback is unset
// in tests — we assert the normalization + summary, which is the load-bearing part.
// ─────────────────────────────────────────────────────────────────────────────

describe("plan_todo", () => {
    it("renders a checkbox summary with a done count", async () => {
        const out = await executeToolText("plan_todo", JSON.stringify({
            steps: [
                {text: "Install deps", status: "done"},
                {text: "Run tests", status: "in_progress"},
                {text: "Commit", status: "pending"},
            ],
        }));
        expect(out).toMatch(/1\/3 done/);
        expect(out).toContain("[x] Install deps");
        expect(out).toContain("[~] Run tests");
        expect(out).toContain("[ ] Commit");
    });

    it("coerces an unknown status to pending", async () => {
        const out = await executeToolText("plan_todo", JSON.stringify({
            steps: [{text: "Weird", status: "banana"}],
        }));
        expect(out).toContain("[ ] Weird");
    });

    it("drops steps with empty text", async () => {
        const out = await executeToolText("plan_todo", JSON.stringify({
            steps: [{text: "", status: "pending"}, {text: "Real", status: "pending"}],
        }));
        expect(out).toContain("Real");
        expect(out).toMatch(/0\/1 done/); // only the non-empty step survived
    });

    it("errors when there are no usable steps", async () => {
        const out = await executeToolText("plan_todo", JSON.stringify({steps: []}));
        expect(out).toMatch(/ERROR/);
    });

    it("clamps to 20 steps", async () => {
        const steps = Array.from({length: 30}, (_, i) => ({text: `step ${i}`, status: "pending"}));
        const out = await executeToolText("plan_todo", JSON.stringify({steps}));
        expect(out).toMatch(/\/20 done/);
    });
});

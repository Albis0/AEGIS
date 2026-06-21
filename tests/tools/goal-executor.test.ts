import {describe, it, expect} from "vitest";
import {classifyError, verifyStep, buildPlanPrompt} from "../../electron/goal-executor";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 56 — Goal Executor. "Change strategy instead of blind retry" for multi-step
// tasks: a tool result is assigned to an error taxonomy, and a verification step
// decides progress/stuck/stop. Misclassification = either infinite retry or giving
// up too early; we lock this down.
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyError taxonomy", () => {
    it("success result → ok (not an error)", () => {
        const v = classifyError("Spotify opened and started playing.");
        expect(v.kind).toBe("ok");
        expect(v.isError).toBe(false);
    });

    it("blocked action → blocked (don't retry)", () => {
        for (const r of [
            "BLOCKED (loop guard): repeated identical action",
            "BLOCKED (user denied approval): delete_file",
            "ENGELLENDI (döngü koruması): aynı işlem tekrarı",
            "ENGELLENDI (kullanıcı onayı reddedildi): delete_file",
        ]) {
            const v = classifyError(r);
            expect(v.kind).toBe("blocked");
            expect(v.retriable).toBe(false);
        }
    });

    it("auth/permission → permission (retrying is pointless)", () => {
        for (const r of ["401 Unauthorized", "403 Forbidden", "Spotify Premium required", "izin yok"]) {
            const v = classifyError(r);
            expect(v.kind).toBe("permission");
            expect(v.retriable).toBe(false);
        }
    });

    it("target missing → not_found (change the argument)", () => {
        for (const r of ["File not found", "404 Not Found", "Unknown tool: x", "invalid game name"]) {
            const v = classifyError(r);
            expect(v.kind).toBe("not_found");
            expect(v.retriable).toBe(false);
        }
    });

    it("transient error → transient (try once more)", () => {
        for (const r of ["timed out", "ETIMEDOUT", "503 Service Unavailable", "429 rate limit", "server busy"]) {
            const v = classifyError(r);
            expect(v.kind).toBe("transient");
            expect(v.retriable).toBe(true);
        }
    });

    it("argument error → invalid_args (fix it, don't repeat as-is)", () => {
        const v = classifyError("Tool arguments have an invalid format");
        expect(v.kind).toBe("invalid_args");
        expect(v.retriable).toBe(false);
    });

    it("unrecoverable → fatal", () => {
        const v = classifyError("ERROR: an unexpected exception occurred");
        expect(v.kind).toBe("fatal");
        expect(v.retriable).toBe(false);
    });

    it("blocked takes priority over permission (match order)", () => {
        // text containing both BLOCKED and a permission keyword → blocked must win
        expect(classifyError("BLOCKED: izin yok").kind).toBe("blocked");
    });
});

describe("verifyStep decisions", () => {
    it("success → progress", () => {
        expect(verifyStep("action complete").status).toBe("progress");
    });
    it("transient error → retry", () => {
        expect(verifyStep("timed out").status).toBe("retry");
    });
    it("target missing → stuck (change strategy)", () => {
        expect(verifyStep("file not found").status).toBe("stuck");
    });
    it("fatal/blocked → fail (stop)", () => {
        expect(verifyStep("ERROR: crashed").status).toBe("fail");
        expect(verifyStep("BLOCKED (loop guard): x").status).toBe("fail");
    });
});

describe("buildPlanPrompt", () => {
    it("includes the goal and step limit + carries the plan/verify directive", () => {
        const p = buildPlanPrompt("clean up the desktop", 6);
        expect(p).toContain("clean up the desktop");
        expect(p).toContain("max 6 steps");
        expect(p).toMatch(/break the goal|concrete steps/);
        expect(p).toMatch(/CHECK|verify|STOP/i);
    });
});

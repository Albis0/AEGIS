import {describe, it, expect, beforeEach, afterEach, vi} from "vitest";
import {runShell, _internals} from "../electron/shell-runner";

// ─────────────────────────────────────────────────────────────────────────────
// Faz CC-2 — general-purpose shell runner. The load-bearing correctness here is
// (1) stripping ELECTRON_RUN_AS_NODE from the child env (a leaked value silently
// breaks any spawned Electron), (2) clamping the timeout to the 10-min cap, and
// (3) clipping output to 30k. We also run a real echo to confirm end-to-end.
// ─────────────────────────────────────────────────────────────────────────────

describe("childEnv — Electron mode strip", () => {
    const saved = process.env.ELECTRON_RUN_AS_NODE;
    beforeEach(() => { process.env.ELECTRON_RUN_AS_NODE = "1"; });
    afterEach(() => {
        if (saved === undefined) delete process.env.ELECTRON_RUN_AS_NODE;
        else process.env.ELECTRON_RUN_AS_NODE = saved;
    });

    it("removes ELECTRON_RUN_AS_NODE from the child env", () => {
        const env = _internals.childEnv();
        expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined();
    });

    it("still inherits other vars", () => {
        process.env.__AEGIS_TEST_MARKER = "keep-me";
        const env = _internals.childEnv();
        expect(env.__AEGIS_TEST_MARKER).toBe("keep-me");
        delete process.env.__AEGIS_TEST_MARKER;
    });
});

describe("clampTimeout", () => {
    it("defaults when invalid", () => {
        expect(_internals.clampTimeout(undefined)).toBe(_internals.DEFAULT_TIMEOUT_MS);
        expect(_internals.clampTimeout(0)).toBe(_internals.DEFAULT_TIMEOUT_MS);
        expect(_internals.clampTimeout(-5)).toBe(_internals.DEFAULT_TIMEOUT_MS);
        expect(_internals.clampTimeout("abc")).toBe(_internals.DEFAULT_TIMEOUT_MS);
    });

    it("converts seconds to ms", () => {
        expect(_internals.clampTimeout(30)).toBe(30_000);
    });

    it("caps at the 10-minute max", () => {
        expect(_internals.clampTimeout(9999)).toBe(_internals.MAX_TIMEOUT_MS);
    });
});

describe("clip", () => {
    it("truncates over the cap", () => {
        const long = "x".repeat(_internals.MAX_OUTPUT_CHARS + 100);
        const out = _internals.clip(long);
        expect(out.length).toBeLessThan(long.length);
        expect(out).toMatch(/truncated/);
    });

    it("leaves short output alone", () => {
        expect(_internals.clip("hello")).toBe("hello");
    });
});

describe("runShell — end to end", () => {
    it("rejects an empty command", async () => {
        expect(await runShell("")).toMatch(/ERROR/);
    });

    it("runs a command and captures stdout", async () => {
        // Portable across PowerShell and /bin/sh.
        const out = await runShell("echo aegis-shell-ok");
        expect(out).toContain("aegis-shell-ok");
    }, 20_000);

    it("background mode returns immediately and notifies on completion", async () => {
        const onDone = vi.fn();
        const out = await runShell("echo bg-done", {background: true, onBackgroundDone: onDone});
        expect(out).toMatch(/background/i);
        // Give the detached child a moment to exit and fire the callback.
        await new Promise((r) => setTimeout(r, 1500));
        expect(onDone).toHaveBeenCalled();
    }, 20_000);
});

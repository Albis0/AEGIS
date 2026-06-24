import {describe, it, expect} from "vitest";
import {diagnose, type HealEntry} from "../../electron/self-healing";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 59 — Self-Healing. The loop-guard blocks the same CALL; this module
// recognizes that the same tool FAMILY keeps producing the SAME error (same root
// cause) even with different arguments, and gives a clear diagnosis. A wrong
// threshold means either noise or missed detection; we're locking it down.
// ─────────────────────────────────────────────────────────────────────────────

function fail(tool: string, result: string): HealEntry { return {tool, success: false, result}; }
function ok(tool: string): HealEntry { return {tool, success: true, result: "tamam"}; }

describe("diagnose — repeating error pattern", () => {
    it("same domain 3x same error class → diagnosis", () => {
        const recent = [
            fail("spotify_play", "Spotify Premium gerekiyor"),
            fail("spotify_next", "401 Unauthorized"),
            fail("spotify_volume", "Premium gerek"),
        ];
        const d = diagnose(recent);
        expect(d.detected).toBe(true);
        expect(d.family).toBe("spotify");
        expect(d.kind).toBe("permission");
        expect(d.count).toBe(3);
        expect(d.advice).toMatch(/yetki|erişim|Premium/i);
    });

    it("below threshold (2 errors) → no diagnosis", () => {
        const recent = [
            fail("spotify_play", "401 Unauthorized"),
            fail("spotify_next", "Premium gerek"),
        ];
        expect(diagnose(recent).detected).toBe(false);
    });

    it("different error classes → not counted as a pattern (counted separately per class)", () => {
        const recent = [
            fail("spotify_play", "401 Unauthorized"),       // permission
            fail("spotify_next", "bulunamadı"),             // not_found
            fail("spotify_volume", "zaman aşımı"),          // transient
        ];
        expect(diagnose(recent).detected).toBe(false);     // each class occurs once
    });

    it("successful calls don't pollute the pattern", () => {
        const recent = [
            fail("git_status", "geçersiz argüman"),
            ok("git_log"),
            fail("git_diff", "geçersiz format"),
            ok("git_commit"),
            fail("git_branch", "geçersiz parametre"),
        ];
        const d = diagnose(recent);
        expect(d.detected).toBe(true);
        expect(d.family).toBe("git");
        expect(d.kind).toBe("invalid_args");
    });

    it("different domains don't affect each other", () => {
        const recent = [
            fail("spotify_play", "401"),
            fail("steam_launch", "bulunamadı"),
            fail("spotify_next", "izin yok"),
        ];
        expect(diagnose(recent).detected).toBe(false); // each domain < threshold
    });

    it("lowering the threshold catches it earlier (parametric)", () => {
        const recent = [fail("ssh_run", "zaman aşımı"), fail("ssh_add_host", "timeout")];
        expect(diagnose(recent, 2).detected).toBe(true);
        expect(diagnose(recent, 3).detected).toBe(false);
    });

    it("empty/error-free history → no diagnosis", () => {
        expect(diagnose([]).detected).toBe(false);
        expect(diagnose([ok("x"), ok("y")]).detected).toBe(false);
    });

    it("a single tool (no underscore) is its own family", () => {
        const recent = [fail("screenshot", "zaman aşımı"), fail("screenshot", "timeout"), fail("screenshot", "meşgul")];
        const d = diagnose(recent);
        expect(d.detected).toBe(true);
        expect(d.family).toBe("screenshot");
    });
});

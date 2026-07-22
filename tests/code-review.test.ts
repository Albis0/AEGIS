import {describe, it, expect} from "vitest";
import {buildReviewPrompt, parseFindings, formatFindings} from "../electron/code-review";

// ─────────────────────────────────────────────────────────────────────────────
// Faz CC-7 — code review. The load-bearing logic is parsing the model's reply
// into structured findings (pipe-delimited), tolerating list markers and a
// NO_FINDINGS sentinel, coercing severity, and sorting most-severe first. The
// git diff + model call are provided by the caller and not exercised here.
// ─────────────────────────────────────────────────────────────────────────────

describe("buildReviewPrompt", () => {
    it("includes the diff and the output format", () => {
        const p = buildReviewPrompt("diff --git a/x b/x");
        expect(p).toContain("diff --git a/x b/x");
        expect(p).toMatch(/SEVERITY \| file/);
        expect(p).toContain("NO_FINDINGS");
    });
});

describe("parseFindings", () => {
    it("parses pipe-delimited findings and sorts by severity", () => {
        const reply = [
            "low | src/a.ts | 12 | minor: could cache this",
            "high | src/b.ts | 40 | null deref when list is empty",
            "medium | src/c.ts | 3 | missing await",
        ].join("\n");
        const f = parseFindings(reply);
        expect(f).toHaveLength(3);
        expect(f[0].severity).toBe("high"); // sorted most-severe first
        expect(f[0].file).toBe("src/b.ts");
        expect(f[0].line).toBe(40);
    });

    it("returns [] for NO_FINDINGS", () => {
        expect(parseFindings("NO_FINDINGS")).toEqual([]);
        expect(parseFindings("  NO_FINDINGS  ")).toEqual([]);
    });

    it("tolerates list markers and coerces line 0 to null", () => {
        const f = parseFindings("- high | app.ts | 0 | broad problem, no specific line");
        expect(f).toHaveLength(1);
        expect(f[0].line).toBeNull();
        expect(f[0].severity).toBe("high");
    });

    it("coerces unknown severity to medium", () => {
        const f = parseFindings("weird | a.ts | 1 | something");
        expect(f[0].severity).toBe("medium");
    });

    it("skips lines without enough fields", () => {
        const f = parseFindings("this is just prose\nhigh | a.ts | 5 | real one");
        expect(f).toHaveLength(1);
        expect(f[0].file).toBe("a.ts");
    });

    it("preserves a summary that itself contains a pipe", () => {
        const f = parseFindings("high | a.ts | 5 | use A | B pattern here");
        expect(f[0].summary).toBe("use A | B pattern here");
    });
});

describe("formatFindings", () => {
    it("summarizes counts and lists findings", () => {
        const out = formatFindings([
            {file: "b.ts", line: 40, severity: "high", summary: "null deref"},
            {file: "c.ts", line: null, severity: "low", summary: "nit"},
        ]);
        expect(out).toMatch(/2 finding/);
        expect(out).toMatch(/1 high/);
        expect(out).toContain("[HIGH] b.ts:40 — null deref");
        expect(out).toContain("[LOW] c.ts — nit");
    });

    it("reports a clean result", () => {
        expect(formatFindings([])).toMatch(/No issues/);
    });
});

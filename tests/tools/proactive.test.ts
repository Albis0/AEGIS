import {describe, it, expect} from "vitest";
import {detectPatterns, buildProactiveSuggestion, type UsageRecord} from "../../electron/proactive";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 61 — Proactive pattern learning (opt-in). Proactivity backfires
// without a trust foundation → default OFF, thresholds prevent spam. A pattern
// must span many DAYS + many REPEATS to count as a "real habit"; we lock that in.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;
const base = Date.parse("2026-06-01T09:00:00");

/** Generates tool usage on N separate days, at the given hour. */
function across(tool: string, hour: number, days: number): UsageRecord[] {
    return Array.from({length: days}, (_, i) => ({tool, hour, ts: base + i * DAY}));
}

describe("detectPatterns — real habit", () => {
    it("usage repeated across many days → pattern", () => {
        const recs = across("spotify_play", 9, 4); // 4 separate days, 9am
        const p = detectPatterns(recs);
        expect(p.length).toBe(1);
        expect(p[0].tool).toBe("spotify_play");
        expect(p[0].days).toBe(4);
        expect(p[0].suggestion).toMatch(/morning/);
    });

    it("many repeats in a single day → NOT a pattern (coincidence filtered out)", () => {
        const recs = Array.from({length: 8}, () => ({tool: "x", hour: 9, ts: base}));
        expect(detectPatterns(recs)).toHaveLength(0); // days=1 < minDays
    });

    it("too few repeats (below threshold) → not a pattern", () => {
        const recs = [
            {tool: "y", hour: 9, ts: base},
            {tool: "y", hour: 9, ts: base + DAY},
        ];
        expect(detectPatterns(recs)).toHaveLength(0); // count=2 < minOccurrences=3
    });

    it("different hour band → separate pattern", () => {
        const recs = [...across("a", 9, 3), ...across("a", 2, 3)];
        const p = detectPatterns(recs);
        expect(p.length).toBe(2);
        const labels = p.map((x) => x.suggestion);
        expect(labels.some((l) => /morning/.test(l))).toBe(true);
        expect(labels.some((l) => /night/.test(l))).toBe(true);
    });

    it("strongest pattern (most days) comes first", () => {
        const recs = [...across("weak", 9, 2), ...across("strong", 14, 5)];
        const p = detectPatterns(recs);
        expect(p[0].tool).toBe("strong");
    });

    it("returns as many suggestions as the limit", () => {
        const recs = [
            ...across("a", 9, 3), ...across("b", 12, 3),
            ...across("c", 15, 3), ...across("d", 18, 3),
        ];
        expect(detectPatterns(recs, {limit: 2})).toHaveLength(2);
    });
});

describe("buildProactiveSuggestion — opt-in", () => {
    const recs = across("spotify_play", 9, 4);

    it("returns null when OFF (default behavior — no spam)", () => {
        expect(buildProactiveSuggestion(recs, false)).toBeNull();
    });

    it("returns a pattern summary when ON", () => {
        const out = buildProactiveSuggestion(recs, true);
        expect(out).toBeTruthy();
        expect(out).toMatch(/spotify_play/);
    });

    it("returns null when ON but no pattern exists", () => {
        expect(buildProactiveSuggestion([], true)).toBeNull();
    });
});

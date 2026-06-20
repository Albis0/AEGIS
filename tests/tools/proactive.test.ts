import {describe, it, expect} from "vitest";
import {detectPatterns, buildProactiveSuggestion, type UsageRecord} from "../../electron/proactive";

// ─────────────────────────────────────────────────────────────────────────────
// Faz 61 — Proaktif örüntü öğrenme (opt-in). Proaktiflik güven tabanı kurulmadan
// ters teper → varsayılan KAPALI, spam'i eşikler önler. Bir örüntü "gerçek
// alışkanlık" sayılması için çok GÜN + çok TEKRAR gerekir; bunu kilitliyoruz.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;
const base = Date.parse("2026-06-01T09:00:00");

/** N ayrı günde, verilen saatte tool kullanımı üretir. */
function across(tool: string, hour: number, days: number): UsageRecord[] {
    return Array.from({length: days}, (_, i) => ({tool, hour, ts: base + i * DAY}));
}

describe("detectPatterns — gerçek alışkanlık", () => {
    it("çok günde tekrarlanan kullanım → örüntü", () => {
        const recs = across("spotify_play", 9, 4); // 4 ayrı gün, sabah 9
        const p = detectPatterns(recs);
        expect(p.length).toBe(1);
        expect(p[0].tool).toBe("spotify_play");
        expect(p[0].days).toBe(4);
        expect(p[0].suggestion).toMatch(/sabah/);
    });

    it("tek günde çok tekrar → örüntü DEĞİL (tesadüf elenir)", () => {
        const recs = Array.from({length: 8}, () => ({tool: "x", hour: 9, ts: base}));
        expect(detectPatterns(recs)).toHaveLength(0); // days=1 < minDays
    });

    it("az tekrar (eşik altı) → örüntü değil", () => {
        const recs = [
            {tool: "y", hour: 9, ts: base},
            {tool: "y", hour: 9, ts: base + DAY},
        ];
        expect(detectPatterns(recs)).toHaveLength(0); // count=2 < minOccurrences=3
    });

    it("farklı saat bandı → ayrı örüntü", () => {
        const recs = [...across("a", 9, 3), ...across("a", 2, 3)];
        const p = detectPatterns(recs);
        expect(p.length).toBe(2);
        const labels = p.map((x) => x.suggestion);
        expect(labels.some((l) => /sabah/.test(l))).toBe(true);
        expect(labels.some((l) => /gece/.test(l))).toBe(true);
    });

    it("en güçlü örüntü (en çok gün) önce gelir", () => {
        const recs = [...across("weak", 9, 2), ...across("strong", 14, 5)];
        const p = detectPatterns(recs);
        expect(p[0].tool).toBe("strong");
    });

    it("limit kadar öneri döner", () => {
        const recs = [
            ...across("a", 9, 3), ...across("b", 12, 3),
            ...across("c", 15, 3), ...across("d", 18, 3),
        ];
        expect(detectPatterns(recs, {limit: 2})).toHaveLength(2);
    });
});

describe("buildProactiveSuggestion — opt-in", () => {
    const recs = across("spotify_play", 9, 4);

    it("KAPALI iken null döner (varsayılan davranış — spam yok)", () => {
        expect(buildProactiveSuggestion(recs, false)).toBeNull();
    });

    it("AÇIK iken örüntü özeti döner", () => {
        const out = buildProactiveSuggestion(recs, true);
        expect(out).toBeTruthy();
        expect(out).toMatch(/spotify_play/);
    });

    it("AÇIK ama örüntü yoksa null", () => {
        expect(buildProactiveSuggestion([], true)).toBeNull();
    });
});

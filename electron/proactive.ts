/**
 * Phase 61 — Proactive Pattern Learning (opt-in)
 *
 * The crown of a "second self" is proactivity — but it backfires without a trust
 * foundation. So it comes LAST and is OPT-IN: disabled by default, suggestions only
 * appear if the user turns it on.
 *
 * This module extracts a "when + which tool" pattern from timestamped tool usage
 * records: e.g. "every day around ~09:00 you use spotify_play — shall I automate it?".
 * Pure function (Electron/IO independent) — takes records, returns a suggestion.
 * Persistence + the opt-in flag live on the memory-plus/settings side.
 *
 * Inspired by OpenJarvis `agents/proactive_agent.py` (cron + tiered suggestions);
 * digest_collect / connector network NOT adopted. Compatible with the Phase 54
 * permission gate (suggestion ≠ automatic action).
 */

export interface UsageRecord {
    tool: string;
    /** Hour 0-23 in local time zone. */
    hour: number;
    /** Epoch ms — used to check for enough history and to distinguish "days". */
    ts: number;
}

export interface Pattern {
    tool: string;
    /** The hour the pattern is centered on (0-23). */
    hour: number;
    /** How many times this (tool, hour-band) was seen. */
    occurrences: number;
    /** On how many distinct days it was seen (a real habit = many days). */
    days: number;
    /** Opt-in suggestion text (English). */
    suggestion: string;
}

/** Rounds the hour to a 3-hour band (morning/noon… tolerance). */
function band(hour: number): number {
    return Math.floor(hour / 3) * 3;
}

function bandLabel(b: number): string {
    if (b >= 5 && b < 12) return "in the morning";
    if (b >= 12 && b < 17) return "in the afternoon";
    if (b >= 17 && b < 22) return "in the evening";
    return "at night";
}

/**
 * Extracts temporal patterns from usage records. For a pattern to count as a
 * "real habit":
 *   - it must be seen on at least `minDays` DISTINCT days (one-off coincidences are filtered out)
 *   - at least `minOccurrences` total repetitions
 * Strongest patterns first; returns at most `limit` suggestions. These thresholds
 * prevent spam.
 */
export function detectPatterns(
    records: UsageRecord[],
    {minDays = 2, minOccurrences = 3, limit = 3}: {minDays?: number; minOccurrences?: number; limit?: number} = {},
): Pattern[] {
    // (tool, hour-band) → {count, day-set}
    const groups = new Map<string, {tool: string; band: number; count: number; days: Set<string>}>();
    for (const r of records) {
        const b = band(r.hour);
        const key = `${r.tool}::${b}`;
        const g = groups.get(key) ?? {tool: r.tool, band: b, count: 0, days: new Set<string>()};
        g.count++;
        g.days.add(new Date(r.ts).toDateString());
        groups.set(key, g);
    }
    const patterns: Pattern[] = [];
    for (const g of groups.values()) {
        if (g.days.size >= minDays && g.count >= minOccurrences) {
            patterns.push({
                tool: g.tool,
                hour: g.band,
                occurrences: g.count,
                days: g.days.size,
                suggestion: `You often use "${g.tool}" ${bandLabel(g.band)} (${g.days.size} distinct days). If you'd like, I can automatically remind you or run it at that time — want to enable it?`,
            });
        }
    }
    patterns.sort((a, b) => (b.days - a.days) || (b.occurrences - a.occurrences));
    return patterns.slice(0, limit);
}

/**
 * Produces an opt-in proactive suggestion. If `enabled` is false (the default) it
 * returns NOTHING — so it doesn't backfire before a trust foundation is built. If
 * enabled, it summarizes the strongest patterns.
 */
export function buildProactiveSuggestion(records: UsageRecord[], enabled: boolean): string | null {
    if (!enabled) return null;
    const patterns = detectPatterns(records);
    if (patterns.length === 0) return null;
    return patterns.map((p) => `• ${p.suggestion}`).join("\n");
}

// AEGIS — hybrid tool routing.
// =============================================================================
// The old routing was pure keyword-root matching (startsWith over hand-kept root
// lists per language). It missed phrasings whose words don't start with a listed
// root → the tool was silently not offered (the "flaky tool selection" bug).
//
// Hybrid strategy:
//   1. BM25 over each group's document (roots + tool names + descriptions) gives
//      a ranked list of relevant groups — catches matches roots miss, weighs rare
//      distinctive terms (e.g. "brightness") over common ones (e.g. "set").
//   2. When BM25 is ambiguous (nothing scores clearly, or the top two are too
//      close to call), an OPTIONAL cheap LLM router picks the group(s).
//
// This module is intentionally free of any tools.ts import (tools.ts builds the
// index and calls in) so there's no import cycle.

import {Bm25, type Bm25Doc} from "./bm25";

export interface RankOptions {
    /** A group must beat this absolute BM25 score to be considered relevant. */
    minScore?: number;
    /** Keep groups scoring at least this fraction of the top score. */
    keepRatio?: number;
    /** Never return more than this many candidate groups. */
    maxGroups?: number;
    /** If the 2nd score is within this fraction of the top, the result is "ambiguous". */
    closeRatio?: number;
}

export interface RankResult {
    /** Candidate group ids, best first. */
    ids: string[];
    /** True when BM25 couldn't decide confidently → a caller may fall back to the LLM router. */
    ambiguous: boolean;
    /** Top raw score (0 when nothing matched). */
    topScore: number;
}

export function buildGroupIndex(docs: Bm25Doc[]): Bm25 {
    return new Bm25(docs);
}

/** Rank groups for a query; flag low-confidence results as ambiguous. */
export function rankGroups(index: Bm25, queryTokens: string[], opts: RankOptions = {}): RankResult {
    const minScore = opts.minScore ?? 0.8;
    const keepRatio = opts.keepRatio ?? 0.55;
    const maxGroups = opts.maxGroups ?? 3;
    const closeRatio = opts.closeRatio ?? 0.85;

    const ranked = index.search(queryTokens, maxGroups + 2);
    if (ranked.length === 0) return {ids: [], ambiguous: true, topScore: 0};

    const top = ranked[0].score;
    const kept = ranked.filter((r) => r.score >= Math.max(minScore, top * keepRatio)).slice(0, maxGroups);

    // Ambiguous when nothing cleared the bar, or the runner-up is nearly tied with
    // the leader across (likely) different domains — a case worth an LLM opinion.
    const belowBar = top < minScore;
    const tooClose = ranked.length > 1 && ranked[1].score >= top * closeRatio;
    return {ids: kept.map((r) => r.id), ambiguous: belowBar || tooClose, topScore: top};
}

// ── Optional LLM router (ambiguity fallback) ────────────────────────────────

/** Structural callModel type — avoids importing ai-client (no import cycle). */
export type RouterCallModel = (
    messages: {role: string; content: string}[],
    onDelta: ((t: string) => void) | undefined,
    tools: unknown[],
) => Promise<{choices: [{message: {content: string | null}}]}>;

export interface GroupSummary {
    id: string;
    /** A short human-readable label for the group (e.g. "spotify: music playback"). */
    summary: string;
}

/**
 * Ask a model which group(s) are relevant to the message. Returns the chosen ids
 * (subset of the given group ids). Best-effort: on any error or unparsable reply
 * it returns [] so the caller keeps its BM25 result.
 */
export async function llmRouteGroups(
    context: string,
    groups: GroupSummary[],
    callModel: RouterCallModel,
): Promise<string[]> {
    if (groups.length === 0) return [];
    const list = groups.map((g) => `${g.id}: ${g.summary}`).join("\n");
    const prompt =
        `You are a tool-group router. Given a user message, list the ids of the tool ` +
        `groups that could help handle it. Reply with ONLY a comma-separated list of ids ` +
        `from the set below, or the word NONE.\n\nGROUPS:\n${list}\n\nMESSAGE: ${context}\n\nIDS:`;
    try {
        const res = await callModel([{role: "user", content: prompt}], undefined, []);
        const reply = res.choices[0]?.message?.content ?? "";
        if (/\bnone\b/i.test(reply)) return [];
        const valid = new Set(groups.map((g) => g.id));
        return reply
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter((s) => valid.has(s));
    } catch {
        return [];
    }
}

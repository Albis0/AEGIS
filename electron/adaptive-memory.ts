/**
 * Phase 57 — Adaptive Memory: semantic search + auto-inference + conflict resolution
 *
 * `facts.json` was flat-JSON + keyword: AEGIS SAVED the user but didn't LEARN.
 * This module adds three pure capabilities (Electron/IO-independent — takes `Fact[]`, returns `Fact[]`):
 *
 *   1. searchFacts   — finds the most semantically relevant facts via a token-overlap score
 *                      ("what did I say about X last month?"). NO embeddings — local,
 *                      zero-dependency keyword score (in the spirit of knowledge.ts BM25-lite).
 *                      If embeddings are added they plug in here; without them, graceful keyword fallback.
 *   2. inferFacts    — automatically extracts a fact from a user message
 *                      ("my name is X", "I use Python", "I like coffee").
 *   3. reconcileFact — if a new fact CONFLICTS with an old one (same subject/predicate, different
 *                      value) it updates the old one; otherwise it adds it.
 *
 * No new providers (ROADMAP rule). Pure functions; persistence lives in memory-plus.ts.
 */

export interface FactLike {
    id: string;
    content: string;
    addedAt: string;
    source: "manual" | "auto";
    tags: string[];
}

// ── 1. Semantic (token-overlap) search ───────────────────────────────────────

const STOP = new Set([
    "ve", "ile", "bir", "bu", "şu", "o", "da", "de", "ki", "mi", "ne", "için",
    "the", "a", "an", "is", "to", "of", "in", "on", "and", "or", "my", "i",
    "benim", "ben", "sen", "senin", "var", "yok", "çok", "en",
]);

function toTokens(s: string): string[] {
    return s.toLowerCase()
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
        .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 1 && !STOP.has(w));
}

/**
 * Returns the facts most semantically relevant to the query, with scores. Score = shared token count /
 * query token count (Jaccard-like). Zero-score entries are dropped; the top `limit` are returned.
 */
export function searchFacts(facts: FactLike[], query: string, limit = 5): {fact: FactLike; score: number}[] {
    const q = toTokens(query);
    if (q.length === 0) return [];
    const qSet = new Set(q);
    const scored = facts.map((f) => {
        const ft = new Set(toTokens(f.content + " " + f.tags.join(" ")));
        let overlap = 0;
        for (const t of qSet) if (ft.has(t)) overlap++;
        return {fact: f, score: overlap / qSet.size};
    });
    return scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

// ── 2. Automatic inference from conversation ─────────────────────────────────

/**
 * Extracts facts worth persisting from a user message. Only CLEAR, personal and
 * lasting statements (name, technology used, preference) — transient/command
 * sentences ("open the file") are not extracted. Each fact returns with a `subject`
 * (used in conflict resolution).
 */
export interface InferredFact {
    content: string;
    subject: string;   // conflict-resolution key: "name", "lang:python", "preference:coffee"
    tags: string[];
}

const PATTERNS: {re: RegExp; build: (m: RegExpMatchArray) => InferredFact}[] = [
    // Name
    {re: /\b(?:benim )?ad[ıi]m\s+([a-zçğıöşü]+)/i,
     build: (m) => ({content: `The user's name is ${cap(m[1])}.`, subject: "name", tags: ["profile", "name"]})},
    {re: /\bbana\s+([a-zçğıöşü]+)\s+de(?:nir|yebilirsin|rler)?\b/i,
     build: (m) => ({content: `The user's name is ${cap(m[1])}.`, subject: "name", tags: ["profile", "name"]})},
    {re: /\bmy name is\s+([a-z]+)/i,
     build: (m) => ({content: `The user's name is ${cap(m[1])}.`, subject: "name", tags: ["profile", "name"]})},
    // Technology/language used
    {re: /\b([a-zçğıöşü0-9+#.]+)\s+(?:kullan[ıi]yorum|ile çalış[ıi]yorum|yaz[ıi]yorum)\b/i,
     build: (m) => ({content: `The user uses ${m[1]}.`, subject: `lang:${norm(m[1])}`, tags: ["technology"]})},
    {re: /\bi (?:use|code in|work with)\s+([a-z0-9+#.]+)/i,
     build: (m) => ({content: `The user uses ${m[1]}.`, subject: `lang:${norm(m[1])}`, tags: ["technology"]})},
    // Preference (likes)
    {re: /\b([a-zçğıöşü ]+?)['ıiyu]?\s*(?:severim|seviyorum|bay[ıi]l[ıi]r[ıi]m)\b/i,
     build: (m) => ({content: `The user likes ${m[1].trim()}.`, subject: `preference:${norm(m[1])}`, tags: ["preference"]})},
    // Preference (dislikes)
    {re: /\b([a-zçğıöşü ]+?)['ıiyu]?\s*(?:sevmem|sevmiyorum|nefret ederim)\b/i,
     build: (m) => ({content: `The user dislikes ${m[1].trim()}.`, subject: `preference:${norm(m[1])}`, tags: ["preference"]})},
];

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function norm(s: string): string {
    return s.toLowerCase().trim()
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
        .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");
}

export function inferFacts(message: string): InferredFact[] {
    const out: InferredFact[] = [];
    const seen = new Set<string>();
    for (const p of PATTERNS) {
        const m = message.match(p.re);
        if (m) {
            const f = p.build(m);
            if (!seen.has(f.subject)) { seen.add(f.subject); out.push(f); }
        }
    }
    return out;
}

// ── 3. Conflict resolution ───────────────────────────────────────────────────

// Patterns recognizing the subject of stored fact sentences ("The user's name is X.",
// "The user uses Y.", "The user likes/dislikes Z.") — to find the existing fact's
// subject during conflict resolution (input patterns are in inferFacts; these are OUTPUT patterns).
const STORED_SUBJECT: {re: RegExp; subject: (m: RegExpMatchArray) => string}[] = [
    {re: /the user's name is\s+/i, subject: () => "name"},
    {re: /the user uses\s+(.+?)\.?$/i, subject: (m) => `lang:${norm(m[1])}`},
    {re: /the user (?:likes|dislikes)\s+(.+?)\.?$/i, subject: (m) => `preference:${norm(m[1])}`},
];

/**
 * Extracts a fact's "subject" (conflict key). Recognizes both input patterns
 * (inferFacts: "my name is X") and stored output patterns ("The user's name is X.") —
 * so reconcileFact can find the existing fact's subject.
 */
export function subjectOf(content: string): string | null {
    for (const s of STORED_SUBJECT) {
        const m = content.match(s.re);
        if (m) return s.subject(m);
    }
    const inferred = inferFacts(content);
    return inferred.length ? inferred[0].subject : null;
}

export interface ReconcileResult {
    facts: FactLike[];
    action: "added" | "updated" | "duplicate";
    message: string;
}

/**
 * If the new content conflicts with existing facts (same subject, different content) it
 * UPDATES the old one; if identical, duplicate; if no conflict, adds it. Subject is only
 * computed for auto-inferable types (name/lang/preference); if not inferable, plain add.
 */
export function reconcileFact(
    facts: FactLike[],
    newContent: string,
    subject: string | null,
    now: () => string = () => new Date().toISOString(),
): ReconcileResult {
    const trimmed = newContent.trim();
    // Exactly identical content → duplicate
    if (facts.some((f) => f.content.toLowerCase() === trimmed.toLowerCase())) {
        return {facts, action: "duplicate", message: "This fact is already saved."};
    }
    if (subject) {
        const idx = facts.findIndex((f) => (subjectOf(f.content) === subject));
        if (idx !== -1) {
            const old = facts[idx].content;
            const updated = [...facts];
            updated[idx] = {...updated[idx], content: trimmed, addedAt: now(), source: "auto"};
            return {facts: updated, action: "updated",
                message: `Updated: "${old}" → "${trimmed}"`};
        }
    }
    const fact: FactLike = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        content: trimmed, addedAt: now(), source: "auto", tags: [],
    };
    return {facts: [...facts, fact], action: "added", message: `Fact saved: "${trimmed}"`};
}

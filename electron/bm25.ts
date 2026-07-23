// AEGIS — shared BM25 ranking + tokenizer.
// =============================================================================
// Extracted so both the knowledge base (RAG chunk search) and the tool router
// share ONE ranking implementation instead of ad-hoc term-overlap counting.
// BM25 adds IDF (rare/distinctive terms weigh more) + length normalization,
// which ranks far better than the old "count matching words" score.
//
// No external dependencies.

/** Lowercase word tokens, Turkish-aware, drops 1-2 char noise. */
export function tokenize(text: string): string[] {
    return text.toLowerCase()
        .replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2);
}

export interface Bm25Doc {
    id: string;
    tokens: string[];
}

/** Compact BM25 over a fixed set of documents. */
export class Bm25 {
    private readonly df = new Map<string, number>();
    private readonly avgdl: number;
    private readonly N: number;

    constructor(private readonly docs: Bm25Doc[], private readonly k1 = 1.5, private readonly b = 0.75) {
        this.N = docs.length;
        let total = 0;
        for (const d of docs) {
            total += d.tokens.length;
            const seen = new Set<string>();
            for (const t of d.tokens) {
                if (seen.has(t)) continue;
                seen.add(t);
                this.df.set(t, (this.df.get(t) ?? 0) + 1);
            }
        }
        this.avgdl = this.N > 0 ? total / this.N : 0;
    }

    private idf(term: string): number {
        const n = this.df.get(term) ?? 0;
        // +1 inside the log keeps the idf non-negative for terms in most docs.
        return Math.log(1 + (this.N - n + 0.5) / (n + 0.5));
    }

    score(queryTokens: string[], doc: Bm25Doc): number {
        const tf = new Map<string, number>();
        for (const t of doc.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
        const dl = doc.tokens.length || 1;
        let s = 0;
        for (const term of new Set(queryTokens)) {
            const f = tf.get(term) ?? 0;
            if (f === 0) continue;
            s += this.idf(term) * (f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * (dl / (this.avgdl || 1))));
        }
        return s;
    }

    /** Score every doc against the query, return the positive-scoring ones, best first. */
    search(query: string | string[], topK = 5): {id: string; score: number}[] {
        const qt = Array.isArray(query) ? query : tokenize(query);
        const scored = this.docs
            .map((d) => ({id: d.id, score: this.score(qt, d)}))
            .filter((r) => r.score > 0);
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK);
    }
}

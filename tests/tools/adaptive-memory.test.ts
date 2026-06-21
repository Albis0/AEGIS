import {describe, it, expect} from "vitest";
import {searchFacts, inferFacts, reconcileFact, subjectOf} from "../../electron/adaptive-memory";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 57 — Adaptive memory pure core. AEGIS used to save the user but didn't
// learn. These three capabilities are the foundation of the "second self":
// semantic search, auto-inference, conflict resolution. Wrong behavior = either
// it learns the wrong thing or misses the conflict.
// ─────────────────────────────────────────────────────────────────────────────

function mk(content: string, id = Math.random().toString(36).slice(2)): {
    id: string; content: string; addedAt: string; source: "manual" | "auto"; tags: string[];
} {
    return {id, content, addedAt: "2026-01-01", source: "manual", tags: []};
}

describe("searchFacts — token-overlap (no embeddings)", () => {
    const facts = [
        mk("The user uses Python."),
        mk("The user's name is Ahmet."),
        mk("Project deadline is July 15."),
        mk("The user likes coffee."),
    ];

    it("finds the most relevant fact", () => {
        const hits = searchFacts(facts, "which language do I use python");
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].fact.content).toContain("Python");
    });

    it("returns empty for an irrelevant query", () => {
        expect(searchFacts(facts, "giraffe airplane butterfly")).toHaveLength(0);
    });

    it("returns results in descending score order", () => {
        const hits = searchFacts(facts, "the user likes coffee");
        for (let i = 1; i < hits.length; i++) expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
    });

    it("empty query → empty result", () => {
        expect(searchFacts(facts, "")).toHaveLength(0);
    });
});

describe("inferFacts — automatic inference", () => {
    it("infers name (TR + EN)", () => {
        expect(inferFacts("benim adım Mehmet")[0]).toMatchObject({subject: "name"});
        expect(inferFacts("my name is John")[0].content).toContain("John");
    });

    it("infers the technology used", () => {
        const f = inferFacts("ben TypeScript kullanıyorum");
        expect(f[0].subject).toBe("lang:typescript");
        expect(f[0].content).toContain("TypeScript");
    });

    it("infers preference (likes/dislikes)", () => {
        expect(inferFacts("kahveyi severim")[0].content).toMatch(/likes/);
        expect(inferFacts("brokoli sevmem")[0].content).toMatch(/dislikes/);
    });

    it("does not infer a fact from command/transient sentences", () => {
        expect(inferFacts("dosyayı aç ve sil")).toHaveLength(0);
        expect(inferFacts("spotify çal")).toHaveLength(0);
    });

    it("does not return the same subject twice", () => {
        const f = inferFacts("benim adım Ali, adım Ali");
        expect(f.filter((x) => x.subject === "name")).toHaveLength(1);
    });
});

describe("reconcileFact — conflict resolution", () => {
    it("a new fact with the same subject UPDATES the old one", () => {
        const facts = [mk("The user's name is Ahmet.")];
        const res = reconcileFact(facts, "The user's name is Mehmet.", "name");
        expect(res.action).toBe("updated");
        expect(res.facts).toHaveLength(1);               // not added, updated
        expect(res.facts[0].content).toContain("Mehmet");
    });

    it("exactly identical content → duplicate (no change)", () => {
        const facts = [mk("The user uses Python.")];
        const res = reconcileFact(facts, "the user uses python.", "lang:python");
        expect(res.action).toBe("duplicate");
        expect(res.facts).toHaveLength(1);
    });

    it("a conflict-free new fact is added", () => {
        const facts = [mk("The user's name is Ahmet.")];
        const res = reconcileFact(facts, "Project deadline is July 15.", null);
        expect(res.action).toBe("added");
        expect(res.facts).toHaveLength(2);
    });

    it("subject null + different content → added (no conflict lookup)", () => {
        const facts = [mk("A.")];
        const res = reconcileFact(facts, "B.", null);
        expect(res.action).toBe("added");
    });
});

describe("subjectOf", () => {
    it("finds the subject of name/lang/preference facts", () => {
        expect(subjectOf("benim adım Ali")).toBe("name");
        expect(subjectOf("Python kullanıyorum")).toBe("lang:python");
    });
    it("null for content with no subject", () => {
        expect(subjectOf("hava bugün güzel")).toBeNull();
    });
});

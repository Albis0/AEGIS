import {describe, it, expect} from "vitest";
import {searchFacts, inferFacts, reconcileFact, subjectOf} from "../../electron/adaptive-memory";

// ─────────────────────────────────────────────────────────────────────────────
// Faz 57 — Adaptif hafıza saf çekirdeği. AEGIS kullanıcıyı kaydediyordu ama
// öğrenmiyordu. Bu üç yetenek "ikinci ben"in temelidir: anlamca arama, otomatik
// çıkarım, çelişki çözme. Yanlış davranış = ya yanlış öğrenir ya çelişkiyi kaçırır.
// ─────────────────────────────────────────────────────────────────────────────

function mk(content: string, id = Math.random().toString(36).slice(2)): {
    id: string; content: string; addedAt: string; source: "manual" | "auto"; tags: string[];
} {
    return {id, content, addedAt: "2026-01-01", source: "manual", tags: []};
}

describe("searchFacts — token-overlap (embedding'siz)", () => {
    const facts = [
        mk("Kullanıcı Python kullanıyor."),
        mk("Kullanıcının adı Ahmet."),
        mk("Proje teslim tarihi 15 Temmuz."),
        mk("Kullanıcı kahveyi sever."),
    ];

    it("anlamca en yakın gerçeği bulur", () => {
        const hits = searchFacts(facts, "hangi dili kullanıyorum python");
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].fact.content).toContain("Python");
    });

    it("alakasız sorguda boş döner", () => {
        expect(searchFacts(facts, "zürafa uçak kelebek")).toHaveLength(0);
    });

    it("skor azalan sırada döner", () => {
        const hits = searchFacts(facts, "kullanıcı kahve sever");
        for (let i = 1; i < hits.length; i++) expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
    });

    it("boş sorgu → boş sonuç", () => {
        expect(searchFacts(facts, "")).toHaveLength(0);
    });
});

describe("inferFacts — otomatik çıkarım", () => {
    it("isim çıkarır (TR + EN)", () => {
        expect(inferFacts("benim adım Mehmet")[0]).toMatchObject({subject: "isim"});
        expect(inferFacts("my name is John")[0].content).toContain("John");
    });

    it("kullanılan teknolojiyi çıkarır", () => {
        const f = inferFacts("ben TypeScript kullanıyorum");
        expect(f[0].subject).toBe("dil:typescript");
        expect(f[0].content).toContain("TypeScript");
    });

    it("tercih (sevme/sevmeme) çıkarır", () => {
        expect(inferFacts("kahveyi severim")[0].content).toMatch(/sever/);
        expect(inferFacts("brokoli sevmem")[0].content).toMatch(/sevmez/);
    });

    it("komut/geçici cümleden gerçek çıkarmaz", () => {
        expect(inferFacts("dosyayı aç ve sil")).toHaveLength(0);
        expect(inferFacts("spotify çal")).toHaveLength(0);
    });

    it("aynı özneyi iki kez döndürmez", () => {
        const f = inferFacts("benim adım Ali, adım Ali");
        expect(f.filter((x) => x.subject === "isim")).toHaveLength(1);
    });
});

describe("reconcileFact — çelişki çözme", () => {
    it("aynı özneli yeni gerçek ESKİYİ günceller", () => {
        const facts = [mk("Kullanıcının adı Ahmet.")];
        const res = reconcileFact(facts, "Kullanıcının adı Mehmet.", "isim");
        expect(res.action).toBe("updated");
        expect(res.facts).toHaveLength(1);               // eklenmedi, güncellendi
        expect(res.facts[0].content).toContain("Mehmet");
    });

    it("birebir aynı içerik → duplicate (değişiklik yok)", () => {
        const facts = [mk("Kullanıcı Python kullanıyor.")];
        const res = reconcileFact(facts, "kullanıcı python kullanıyor.", "dil:python");
        expect(res.action).toBe("duplicate");
        expect(res.facts).toHaveLength(1);
    });

    it("çelişkisiz yeni gerçek eklenir", () => {
        const facts = [mk("Kullanıcının adı Ahmet.")];
        const res = reconcileFact(facts, "Proje teslim tarihi 15 Temmuz.", null);
        expect(res.action).toBe("added");
        expect(res.facts).toHaveLength(2);
    });

    it("subject null + farklı içerik → eklenir (çelişki aranmaz)", () => {
        const facts = [mk("A.")];
        const res = reconcileFact(facts, "B.", null);
        expect(res.action).toBe("added");
    });
});

describe("subjectOf", () => {
    it("isim/dil/tercih gerçeklerinin öznesini bulur", () => {
        expect(subjectOf("benim adım Ali")).toBe("isim");
        expect(subjectOf("Python kullanıyorum")).toBe("dil:python");
    });
    it("öznesiz içerikte null", () => {
        expect(subjectOf("hava bugün güzel")).toBeNull();
    });
});

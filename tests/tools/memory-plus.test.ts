import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BASE = path.join(os.homedir(), ".aegis");
const FACTS_PATH = path.join(BASE, "facts.json");
const HABITS_PATH = path.join(BASE, "habits.json");
const MORNING_PATH = path.join(BASE, "morning-check.json");

import {
    addFact, listFacts, removeFact, getFactsForContext,
    recordToolUsage, getTopTools, listHabits,
    shouldShowMorningSummary, markMorningSummaryShown, buildMorningSummaryPrompt,
} from "../../electron/memory-plus";

function clearFiles(): void {
    for (const p of [FACTS_PATH, HABITS_PATH, MORNING_PATH]) {
        try { fs.unlinkSync(p); } catch { /* yok */ }
    }
}

beforeEach(() => {
    fs.mkdirSync(BASE, {recursive: true});
    clearFiles();
});
afterEach(clearFiles);

// ─── Facts ─────────────────────────────────────────────────────────────────
describe("addFact", () => {
    it("yeni gerçek kaydeder", () => {
        const msg = addFact("Kullanıcı sabah erken kalkar");
        expect(msg).toContain("Gerçek kaydedildi");
        const list = listFacts();
        expect(list).toContain("Kullanıcı sabah erken kalkar");
    });

    it("boş içerik eklenmez", () => {
        const msg = addFact("   ");
        expect(msg).toContain("HATA");
    });

    it("aynı gerçek tekrar eklenmez (case insensitive)", () => {
        addFact("kullanıcı gamer");
        const msg = addFact("Kullanıcı gamer");
        expect(msg).toContain("zaten kayıtlı");
        const facts = JSON.parse(fs.readFileSync(FACTS_PATH, "utf-8"));
        expect(facts.length).toBe(1);
    });

    it("tag'lerle kaydedilir", () => {
        addFact("Türkçe konuşuluyor", "manual", ["dil", "tercih"]);
        const list = listFacts();
        expect(list).toContain("dil");
    });
});

describe("removeFact", () => {
    it("ID ile siler", () => {
        addFact("Silinecek gerçek");
        const facts = JSON.parse(fs.readFileSync(FACTS_PATH, "utf-8"));
        const id = facts[0].id;
        const msg = removeFact(id);
        expect(msg).toContain("silindi");
        expect(listFacts()).not.toContain("Silinecek gerçek");
    });

    it("içerik substring ile siler", () => {
        addFact("Ankara'da yaşıyor");
        const msg = removeFact("Ankara");
        expect(msg).toContain("silindi");
    });

    it("olmayan gerçek için hata döner", () => {
        const msg = removeFact("olmayan-id-xyz");
        expect(msg).toContain("bulunamadı");
    });
});

describe("listFacts", () => {
    it("hiç gerçek yokken mesaj döner", () => {
        expect(listFacts()).toContain("Kayıtlı gerçek yok");
    });

    it("filtre çalışır", () => {
        addFact("Python biliyor");
        addFact("JavaScript biliyor");
        const result = listFacts("Python");
        expect(result).toContain("Python");
        expect(result).not.toContain("JavaScript");
    });

    it("filtre eşleşmeyince mesaj döner", () => {
        addFact("Python biliyor");
        expect(listFacts("Ruby")).toContain("eşleşen gerçek bulunamadı");
    });
});

describe("getFactsForContext", () => {
    it("gerçek yoksa boş string", () => {
        expect(getFactsForContext()).toBe("");
    });

    it("gerçek varsa KAYITLı GERÇEKLER başlığı ile döner", () => {
        addFact("Gece çalışır");
        const ctx = getFactsForContext();
        expect(ctx).toContain("KAYITLI GERÇEKLER");
        expect(ctx).toContain("Gece çalışır");
    });
});

// ─── Habits ────────────────────────────────────────────────────────────────
describe("recordToolUsage", () => {
    it("ilk kayıt count=1 ile oluşur", () => {
        recordToolUsage("spotify_play");
        const top = getTopTools(1);
        expect(top[0].tool).toBe("spotify_play");
        expect(top[0].count).toBe(1);
    });

    it("aynı tool tekrar kaydedilince count artar", () => {
        recordToolUsage("web_search");
        recordToolUsage("web_search");
        recordToolUsage("web_search");
        const top = getTopTools(5);
        const entry = top.find((t) => t.tool === "web_search");
        expect(entry?.count).toBe(3);
    });

    it("sıralama count'a göre azalan", () => {
        recordToolUsage("rare_tool");
        recordToolUsage("popular_tool");
        recordToolUsage("popular_tool");
        recordToolUsage("popular_tool");
        const top = getTopTools(2);
        expect(top[0].tool).toBe("popular_tool");
    });
});

describe("listHabits", () => {
    it("alışkanlık yokken mesaj döner", () => {
        expect(listHabits()).toContain("alışkanlık verisi yok");
    });

    it("kullanım sayısını listeler", () => {
        recordToolUsage("screenshot");
        recordToolUsage("screenshot");
        const result = listHabits();
        expect(result).toContain("screenshot");
        expect(result).toContain("2");
    });
});

// ─── Morning Summary ───────────────────────────────────────────────────────
describe("shouldShowMorningSummary", () => {
    it("dosya yoksa true döner", () => {
        expect(shouldShowMorningSummary()).toBe(true);
    });

    it("bugün gösterilmişse false döner", () => {
        markMorningSummaryShown();
        expect(shouldShowMorningSummary()).toBe(false);
    });

    it("dün gösterilmişse true döner", () => {
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        fs.mkdirSync(BASE, {recursive: true});
        fs.writeFileSync(MORNING_PATH, JSON.stringify({date: yesterday}), "utf-8");
        expect(shouldShowMorningSummary()).toBe(true);
    });
});

describe("buildMorningSummaryPrompt", () => {
    it("selamlama içerir", () => {
        const p = buildMorningSummaryPrompt();
        expect(p).toMatch(/Günaydın|İyi günler|İyi akşamlar/);
    });

    it("hava + notlar + görevler talep eder", () => {
        const p = buildMorningSummaryPrompt();
        expect(p).toContain("Hava durumu");
        expect(p).toContain("notlar");
        expect(p).toContain("görevler");
    });
});

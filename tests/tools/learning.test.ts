import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BASE = path.join(os.homedir(), ".aegis");
const FLASHCARDS = path.join(BASE, "flashcards.json");
const READING = path.join(BASE, "reading-list.json");
const GOALS = path.join(BASE, "goals.json");

import {
    addFlashcard, reviewFlashcard,
    addReadingItem, getReadingList,
    setGoal, checkInGoal, listGoals,
} from "../../electron/learning";

function clearFiles(): void {
    for (const p of [FLASHCARDS, READING, GOALS]) {
        try { fs.unlinkSync(p); } catch { /* yok */ }
    }
}

beforeEach(() => {
    fs.mkdirSync(BASE, {recursive: true});
    clearFiles();
});
afterEach(clearFiles);

// ─── Flashcards ──────────────────────────────────────────────────────────────
describe("addFlashcard", () => {
    it("kart ekler", () => {
        const msg = addFlashcard("Başkent neresi?", "Ankara", ["coğrafya"]);
        expect(msg).toContain("Flashcard eklendi");
        const cards = JSON.parse(fs.readFileSync(FLASHCARDS, "utf-8"));
        expect(cards.length).toBe(1);
        expect(cards[0].interval).toBe(1);
        expect(cards[0].easeFactor).toBe(2.5);
    });

    it("boş ön/arka yüz reddedilir", () => {
        expect(addFlashcard("", "cevap", [])).toContain("HATA");
        expect(addFlashcard("soru", "  ", [])).toContain("HATA");
    });
});

describe("reviewFlashcard", () => {
    it("kart yokken anlamlı mesaj", () => {
        expect(reviewFlashcard("", 5)).toContain("Hiç flashcard eklenmemiş");
    });

    it("vadesi gelen kart gösterilir + interval büyür (SM-2)", () => {
        addFlashcard("S1", "C1", ["test"]);
        const out = reviewFlashcard("test", 5);
        expect(out).toContain("S1");
        expect(out).toContain("C1");
        // İlk tekrardan sonra interval 1 * 2.5 = 3 (yuvarlanmış), nextReview ileriye atılır
        const cards = JSON.parse(fs.readFileSync(FLASHCARDS, "utf-8"));
        expect(cards[0].reviewCount).toBe(1);
        expect(cards[0].interval).toBe(3); // round(1 * 2.5)
        expect(cards[0].nextReview).toBeGreaterThan(Date.now());
    });

    it("tekrar gözden geçirilince vadesi geçmemiş kart 'sonraki' bilgisi döner", () => {
        addFlashcard("S1", "C1", ["test"]);
        reviewFlashcard("test", 5); // nextReview'ı ileri atar
        const out = reviewFlashcard("test", 5);
        expect(out).toContain("Tekrar edilecek kart yok");
        expect(out).toMatch(/dakika|saat/);
    });

    it("etiket filtresi çalışır", () => {
        addFlashcard("Mat", "1", ["matematik"]);
        addFlashcard("Tar", "2", ["tarih"]);
        const out = reviewFlashcard("matematik", 5);
        expect(out).toContain("Mat");
        expect(out).not.toContain("Tar");
    });
});

// ─── Reading List ────────────────────────────────────────────────────────────
describe("addReadingItem & getReadingList", () => {
    it("URL öğesi ekler ve url alanı dolar", () => {
        addReadingItem("https://example.com", "okunacak", 4);
        const items = JSON.parse(fs.readFileSync(READING, "utf-8"));
        expect(items[0].url).toBe("https://example.com");
        expect(items[0].status).toBe("pending");
    });

    it("URL olmayan başlıkta url undefined", () => {
        addReadingItem("Sapiens kitabı", "", 2);
        const items = JSON.parse(fs.readFileSync(READING, "utf-8"));
        expect(items[0].url).toBeUndefined();
    });

    it("boş liste mesajı", () => {
        expect(getReadingList("all")).toContain("Okuma listesi boş");
    });

    it("önceliğe göre azalan sıralanır", () => {
        addReadingItem("Düşük", "", 1);
        addReadingItem("Yüksek", "", 5);
        const out = getReadingList("pending");
        expect(out.indexOf("Yüksek")).toBeLessThan(out.indexOf("Düşük"));
    });

    it("status filtresi pending/done ayırır", () => {
        addReadingItem("Bekleyen", "", 3);
        const out = getReadingList("done");
        expect(out).toContain("boş");
    });
});

// ─── Goals ───────────────────────────────────────────────────────────────────
describe("setGoal", () => {
    it("hedef oluşturur progress=0", () => {
        const msg = setGoal("Kitap bitir", "2026-12-31", ["1. bölüm", "2. bölüm"]);
        expect(msg).toContain("Hedef oluşturuldu");
        const goals = JSON.parse(fs.readFileSync(GOALS, "utf-8"));
        expect(goals[0].progress).toBe(0);
        expect(goals[0].status).toBe("active");
    });

    it("boş başlık reddedilir", () => {
        expect(setGoal("  ", "", [])).toContain("HATA");
    });
});

describe("checkInGoal", () => {
    it("ilerleme günceller + ASCII bar", () => {
        setGoal("Spor", "", []);
        const msg = checkInGoal("Spor", 50, "yarısı bitti");
        expect(msg).toContain("%50");
        expect(msg).toContain("█");
        expect(msg).toContain("yarısı bitti");
    });

    it("progress 0-100 arası clamp'lenir", () => {
        setGoal("Test", "", []);
        checkInGoal("Test", 150, "");
        const goals = JSON.parse(fs.readFileSync(GOALS, "utf-8"));
        expect(goals[0].progress).toBe(100);
    });

    it("negatif progress 0'a clamp'lenir", () => {
        setGoal("Test", "", []);
        checkInGoal("Test", -20, "");
        const goals = JSON.parse(fs.readFileSync(GOALS, "utf-8"));
        expect(goals[0].progress).toBe(0);
    });

    it("%100'de otomatik tamamlandı", () => {
        setGoal("Bitir", "", []);
        const msg = checkInGoal("Bitir", 100, "");
        expect(msg).toContain("TAMAMLANDI");
        const goals = JSON.parse(fs.readFileSync(GOALS, "utf-8"));
        expect(goals[0].status).toBe("done");
    });

    it("olmayan hedef bulunamadı", () => {
        expect(checkInGoal("yok-xyz", 50, "")).toContain("bulunamadı");
    });

    it("başlık substring (case-insensitive) ile bulur", () => {
        setGoal("Python Öğren", "", []);
        expect(checkInGoal("python", 30, "")).toContain("%30");
    });
});

describe("listGoals", () => {
    it("hedef yokken mesaj", () => {
        expect(listGoals("active")).toContain("Hedef yok");
    });

    it("aktif hedefleri listeler, tamamlananı filtreler", () => {
        setGoal("Aktif İş", "", []);
        setGoal("Biten İş", "", []);
        checkInGoal("Biten İş", 100, "");
        const out = listGoals("active");
        expect(out).toContain("Aktif İş");
        expect(out).not.toContain("Biten İş");
    });

    it("all hepsini gösterir", () => {
        setGoal("A", "", []);
        setGoal("B", "", []);
        checkInGoal("B", 100, "");
        const out = listGoals("all");
        expect(out).toContain("A");
        expect(out).toContain("B");
    });
});

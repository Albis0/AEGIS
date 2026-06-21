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
        try { fs.unlinkSync(p); } catch { /* none */ }
    }
}

beforeEach(() => {
    fs.mkdirSync(BASE, {recursive: true});
    clearFiles();
});
afterEach(clearFiles);

// ─── Flashcards ──────────────────────────────────────────────────────────────
describe("addFlashcard", () => {
    it("adds a card", () => {
        const msg = addFlashcard("Başkent neresi?", "Ankara", ["coğrafya"]);
        expect(msg).toContain("Flashcard added");
        const cards = JSON.parse(fs.readFileSync(FLASHCARDS, "utf-8"));
        expect(cards.length).toBe(1);
        expect(cards[0].interval).toBe(1);
        expect(cards[0].easeFactor).toBe(2.5);
    });

    it("rejects an empty front/back", () => {
        expect(addFlashcard("", "cevap", [])).toContain("ERROR");
        expect(addFlashcard("soru", "  ", [])).toContain("ERROR");
    });
});

describe("reviewFlashcard", () => {
    it("meaningful message when there are no cards", () => {
        expect(reviewFlashcard("", 5)).toContain("No flashcards have been added");
    });

    it("shows a due card + interval grows (SM-2)", () => {
        addFlashcard("S1", "C1", ["test"]);
        const out = reviewFlashcard("test", 5);
        expect(out).toContain("S1");
        expect(out).toContain("C1");
        // After the first review interval is 1 * 2.5 = 3 (rounded), nextReview is pushed forward
        const cards = JSON.parse(fs.readFileSync(FLASHCARDS, "utf-8"));
        expect(cards[0].reviewCount).toBe(1);
        expect(cards[0].interval).toBe(3); // round(1 * 2.5)
        expect(cards[0].nextReview).toBeGreaterThan(Date.now());
    });

    it("when reviewed again, a not-yet-due card returns 'next' info", () => {
        addFlashcard("S1", "C1", ["test"]);
        reviewFlashcard("test", 5); // pushes nextReview forward
        const out = reviewFlashcard("test", 5);
        expect(out).toContain("No cards due for review");
        expect(out).toMatch(/minute|hour/);
    });

    it("tag filter works", () => {
        addFlashcard("Mat", "1", ["matematik"]);
        addFlashcard("Tar", "2", ["tarih"]);
        const out = reviewFlashcard("matematik", 5);
        expect(out).toContain("Mat");
        expect(out).not.toContain("Tar");
    });
});

// ─── Reading List ────────────────────────────────────────────────────────────
describe("addReadingItem & getReadingList", () => {
    it("adds a URL item and fills in the url field", () => {
        addReadingItem("https://example.com", "okunacak", 4);
        const items = JSON.parse(fs.readFileSync(READING, "utf-8"));
        expect(items[0].url).toBe("https://example.com");
        expect(items[0].status).toBe("pending");
    });

    it("url is undefined for a title without a URL", () => {
        addReadingItem("Sapiens kitabı", "", 2);
        const items = JSON.parse(fs.readFileSync(READING, "utf-8"));
        expect(items[0].url).toBeUndefined();
    });

    it("empty list message", () => {
        expect(getReadingList("all")).toContain("Reading list is empty");
    });

    it("sorts descending by priority", () => {
        addReadingItem("Düşük", "", 1);
        addReadingItem("Yüksek", "", 5);
        const out = getReadingList("pending");
        expect(out.indexOf("Yüksek")).toBeLessThan(out.indexOf("Düşük"));
    });

    it("status filter separates pending/done", () => {
        addReadingItem("Bekleyen", "", 3);
        const out = getReadingList("done");
        expect(out).toContain("empty");
    });
});

// ─── Goals ───────────────────────────────────────────────────────────────────
describe("setGoal", () => {
    it("creates a goal with progress=0", () => {
        const msg = setGoal("Kitap bitir", "2026-12-31", ["1. bölüm", "2. bölüm"]);
        expect(msg).toContain("Goal created");
        const goals = JSON.parse(fs.readFileSync(GOALS, "utf-8"));
        expect(goals[0].progress).toBe(0);
        expect(goals[0].status).toBe("active");
    });

    it("rejects an empty title", () => {
        expect(setGoal("  ", "", [])).toContain("ERROR");
    });
});

describe("checkInGoal", () => {
    it("updates progress + ASCII bar", () => {
        setGoal("Spor", "", []);
        const msg = checkInGoal("Spor", 50, "yarısı bitti");
        expect(msg).toContain("50%");
        expect(msg).toContain("█");
        expect(msg).toContain("yarısı bitti");
    });

    it("progress is clamped to 0-100", () => {
        setGoal("Test", "", []);
        checkInGoal("Test", 150, "");
        const goals = JSON.parse(fs.readFileSync(GOALS, "utf-8"));
        expect(goals[0].progress).toBe(100);
    });

    it("negative progress is clamped to 0", () => {
        setGoal("Test", "", []);
        checkInGoal("Test", -20, "");
        const goals = JSON.parse(fs.readFileSync(GOALS, "utf-8"));
        expect(goals[0].progress).toBe(0);
    });

    it("automatically completes at 100%", () => {
        setGoal("Bitir", "", []);
        const msg = checkInGoal("Bitir", 100, "");
        expect(msg).toContain("COMPLETED");
        const goals = JSON.parse(fs.readFileSync(GOALS, "utf-8"));
        expect(goals[0].status).toBe("done");
    });

    it("returns not-found for a nonexistent goal", () => {
        expect(checkInGoal("yok-xyz", 50, "")).toContain("not found");
    });

    it("finds by title substring (case-insensitive)", () => {
        setGoal("Python Öğren", "", []);
        expect(checkInGoal("python", 30, "")).toContain("30%");
    });
});

describe("listGoals", () => {
    it("message when there are no goals", () => {
        expect(listGoals("active")).toContain("No goals");
    });

    it("lists active goals, filters out completed ones", () => {
        setGoal("Aktif İş", "", []);
        setGoal("Biten İş", "", []);
        checkInGoal("Biten İş", 100, "");
        const out = listGoals("active");
        expect(out).toContain("Aktif İş");
        expect(out).not.toContain("Biten İş");
    });

    it("'all' shows everything", () => {
        setGoal("A", "", []);
        setGoal("B", "", []);
        checkInGoal("B", 100, "");
        const out = listGoals("all");
        expect(out).toContain("A");
        expect(out).toContain("B");
    });
});

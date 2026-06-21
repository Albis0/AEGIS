import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BASE = path.join(os.homedir(), ".aegis");
const FACTS_PATH = path.join(BASE, "facts.json");
const HABITS_PATH = path.join(BASE, "habits.json");
const MORNING_PATH = path.join(BASE, "morning-check.json");
const USAGE_LOG_PATH = path.join(BASE, "usage-log.json");

import {
    addFact, listFacts, removeFact, getFactsForContext,
    recordToolUsage, getTopTools, listHabits,
    shouldShowMorningSummary, markMorningSummaryShown, buildMorningSummaryPrompt,
    addFactReconciled, searchMemory, autoLearnFromMessage,
    getProactivePatterns, getProactiveSuggestion,
} from "../../electron/memory-plus";

function clearFiles(): void {
    for (const p of [FACTS_PATH, HABITS_PATH, MORNING_PATH, USAGE_LOG_PATH]) {
        try { fs.unlinkSync(p); } catch { /* none */ }
    }
}

beforeEach(() => {
    fs.mkdirSync(BASE, {recursive: true});
    clearFiles();
});
afterEach(clearFiles);

// ─── Facts ─────────────────────────────────────────────────────────────────
describe("addFact", () => {
    it("saves a new fact", () => {
        const msg = addFact("The user wakes up early in the morning");
        expect(msg).toContain("Fact saved");
        const list = listFacts();
        expect(list).toContain("The user wakes up early in the morning");
    });

    it("does not add empty content", () => {
        const msg = addFact("   ");
        expect(msg).toContain("ERROR");
    });

    it("does not add the same fact twice (case insensitive)", () => {
        addFact("the user is a gamer");
        const msg = addFact("The user is a gamer");
        expect(msg).toContain("already saved");
        const facts = JSON.parse(fs.readFileSync(FACTS_PATH, "utf-8"));
        expect(facts.length).toBe(1);
    });

    it("saves with tags", () => {
        addFact("Speaks Turkish", "manual", ["language", "preference"]);
        const list = listFacts();
        expect(list).toContain("language");
    });
});

describe("removeFact", () => {
    it("deletes by ID", () => {
        addFact("Fact to be deleted");
        const facts = JSON.parse(fs.readFileSync(FACTS_PATH, "utf-8"));
        const id = facts[0].id;
        const msg = removeFact(id);
        expect(msg).toContain("deleted");
        expect(listFacts()).not.toContain("Fact to be deleted");
    });

    it("deletes by content substring", () => {
        addFact("Lives in Ankara");
        const msg = removeFact("Ankara");
        expect(msg).toContain("deleted");
    });

    it("returns an error for a nonexistent fact", () => {
        const msg = removeFact("nonexistent-id-xyz");
        expect(msg).toContain("No fact found");
    });
});

describe("listFacts", () => {
    it("returns a message when there are no facts", () => {
        expect(listFacts()).toContain("No saved facts");
    });

    it("filter works", () => {
        addFact("Knows Python");
        addFact("Knows JavaScript");
        const result = listFacts("Python");
        expect(result).toContain("Python");
        expect(result).not.toContain("JavaScript");
    });

    it("returns a message when the filter matches nothing", () => {
        addFact("Knows Python");
        expect(listFacts("Ruby")).toContain("No facts matching");
    });
});

describe("getFactsForContext", () => {
    it("empty string when there are no facts", () => {
        expect(getFactsForContext()).toBe("");
    });

    it("returns with a SAVED FACTS header when there are facts", () => {
        addFact("Works at night");
        const ctx = getFactsForContext();
        expect(ctx).toContain("SAVED FACTS");
        expect(ctx).toContain("Works at night");
    });
});

// ─── Habits ────────────────────────────────────────────────────────────────
describe("recordToolUsage", () => {
    it("first record is created with count=1", () => {
        recordToolUsage("spotify_play");
        const top = getTopTools(1);
        expect(top[0].tool).toBe("spotify_play");
        expect(top[0].count).toBe(1);
    });

    it("count increases when the same tool is recorded again", () => {
        recordToolUsage("web_search");
        recordToolUsage("web_search");
        recordToolUsage("web_search");
        const top = getTopTools(5);
        const entry = top.find((t) => t.tool === "web_search");
        expect(entry?.count).toBe(3);
    });

    it("ordered by count, descending", () => {
        recordToolUsage("rare_tool");
        recordToolUsage("popular_tool");
        recordToolUsage("popular_tool");
        recordToolUsage("popular_tool");
        const top = getTopTools(2);
        expect(top[0].tool).toBe("popular_tool");
    });
});

describe("listHabits", () => {
    it("returns a message when there is no habit data", () => {
        expect(listHabits()).toContain("No habit data");
    });

    it("lists the usage count", () => {
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
    it("includes a greeting", () => {
        const p = buildMorningSummaryPrompt();
        expect(p).toMatch(/Good morning|Good afternoon|Good evening/);
    });

    it("requests weather + notes + tasks", () => {
        const p = buildMorningSummaryPrompt();
        expect(p).toContain("weather");
        expect(p).toContain("notes");
        expect(p).toContain("tasks");
    });
});

// ── Phase 57 — adaptive memory end-to-end (real facts.json) ──────────────────
describe("Phase 57 — adaptive memory (I/O)", () => {
    it("searchMemory finds the most relevant fact", () => {
        addFact("The user uses Python.");
        addFact("Project deadline is July 15.");
        const out = searchMemory("which programming language do I use python");
        expect(out).toContain("Python");
    });

    it("addFactReconciled updates a fact with the same subject (not two records)", () => {
        addFactReconciled("The user's name is Ahmet.");
        const out = addFactReconciled("The user's name is Mehmet.");
        expect(out).toMatch(/Updated/);
        const list = listFacts();
        expect(list).toContain("Mehmet");
        expect(list).not.toContain("Ahmet");
    });

    it("autoLearnFromMessage extracts and saves facts from conversation", () => {
        const learned = autoLearnFromMessage("benim adım Zeynep ve TypeScript kullanıyorum");
        expect(learned.length).toBeGreaterThanOrEqual(2);
        const ctx = getFactsForContext();
        expect(ctx).toContain("Zeynep");
        expect(ctx).toContain("TypeScript");
    });

    it("autoLearn updates the old fact on conflict (learning, not duplicating)", () => {
        autoLearnFromMessage("benim adım Ali");
        autoLearnFromMessage("aslında adım Veli");
        const list = listFacts();
        expect(list).toContain("Veli");
        expect(list).not.toContain("Ali.");   // the old "Ali." content should be gone
    });

    it("autoLearn does not extract a fact from a command sentence", () => {
        const learned = autoLearnFromMessage("spotify aç ve müzik çal");
        expect(learned).toHaveLength(0);
    });
});

// ── Phase 61 — Proactive pattern learning (real usage-log.json) ──────────────
describe("Phase 61 — proactive learning (I/O)", () => {
    it("recordToolUsage also keeps a timestamped log", () => {
        recordToolUsage("spotify_play");
        recordToolUsage("spotify_play");
        const raw = JSON.parse(fs.readFileSync(USAGE_LOG_PATH, "utf-8"));
        expect(raw.length).toBe(2);
        expect(raw[0]).toHaveProperty("hour");
        expect(raw[0]).toHaveProperty("ts");
    });

    it("opt-in KAPALI iken öneri null (varsayılan — spam yok)", () => {
        for (let i = 0; i < 5; i++) recordToolUsage("spotify_play");
        expect(getProactiveSuggestion(false)).toBeNull();
    });

    it("getProactivePatterns ham veriyi döndürür (opt-in'den bağımsız)", () => {
        // tek oturum → days=1, örüntü oluşmaz; ama API çökmeden dönmeli
        recordToolUsage("git_status");
        expect(Array.isArray(getProactivePatterns())).toBe(true);
    });
});

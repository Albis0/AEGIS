import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const DATA_DIR = path.join(os.homedir(), ".aegis");
const FLASHCARDS_FILE = path.join(DATA_DIR, "flashcards.json");
const READING_FILE = path.join(DATA_DIR, "reading-list.json");
const GOALS_FILE = path.join(DATA_DIR, "goals.json");

interface Flashcard {
    id: string;
    front: string;
    back: string;
    tags: string[];
    createdAt: number;
    nextReview: number;
    interval: number;
    easeFactor: number;
    reviewCount: number;
}

interface ReadingItem {
    id: string;
    title: string;
    url?: string;
    notes: string;
    priority: number;
    status: "pending" | "done";
    addedAt: number;
    summary?: string;
}

interface Goal {
    id: string;
    title: string;
    deadline: string;
    steps: string[];
    progress: number;
    notes: string[];
    status: "active" | "done";
    createdAt: number;
    updatedAt: number;
}

function uid(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Flashcards ────────────────────────────────────────────────────────────────

function loadCards(): Flashcard[] {
    try { return JSON.parse(fs.readFileSync(FLASHCARDS_FILE, "utf-8")); } catch { return []; }
}

function saveCards(cards: Flashcard[]): void {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    fs.writeFileSync(FLASHCARDS_FILE, JSON.stringify(cards, null, 2));
}

export function addFlashcard(front: string, back: string, tags: string[]): string {
    if (!front.trim() || !back.trim()) return "ERROR: Front and back are required.";
    const cards = loadCards();
    const card: Flashcard = {
        id: uid(), front, back, tags,
        createdAt: Date.now(), nextReview: Date.now(),
        interval: 1, easeFactor: 2.5, reviewCount: 0,
    };
    cards.push(card);
    saveCards(cards);
    return `Flashcard added: "${front.slice(0, 40)}${front.length > 40 ? "..." : ""}" → "${back.slice(0, 40)}${back.length > 40 ? "..." : ""}"${tags.length ? " [" + tags.join(", ") + "]" : ""}`;
}

export function reviewFlashcard(tag: string, count: number): string {
    const cards = loadCards();
    const now = Date.now();
    let due = cards.filter((c) => c.nextReview <= now);
    if (tag) due = due.filter((c) => c.tags.includes(tag));
    due = due.slice(0, count);

    if (due.length === 0) {
        const next = cards.filter((c) => !tag || c.tags.includes(tag))
            .sort((a, b) => a.nextReview - b.nextReview)[0];
        if (!next) return tag ? `No cards tagged "${tag}".` : "No flashcards have been added.";
        const mins = Math.round((next.nextReview - now) / 60000);
        return `No cards due for review${tag ? ` (${tag})` : ""}. Next one: in ${mins < 60 ? mins + " minutes" : Math.round(mins / 60) + " hours"}.`;
    }

    const result = due.map((c, i) => `[${i + 1}/${due.length}] QUESTION: ${c.front}\nANSWER: ${c.back}\nShow this card again in ${Math.round(c.interval)} days.`);

    // Auto-update intervals (SM-2 lite: assume medium difficulty)
    for (const card of due) {
        card.reviewCount++;
        card.interval = Math.round(card.interval * card.easeFactor);
        card.nextReview = now + card.interval * 24 * 3600 * 1000;
    }
    saveCards(cards);

    return result.join("\n\n─────────────────────\n\n");
}

// ── Reading List ──────────────────────────────────────────────────────────────

function loadReading(): ReadingItem[] {
    try { return JSON.parse(fs.readFileSync(READING_FILE, "utf-8")); } catch { return []; }
}

function saveReading(items: ReadingItem[]): void {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    fs.writeFileSync(READING_FILE, JSON.stringify(items, null, 2));
}

export function addReadingItem(urlOrTitle: string, notes: string, priority: number): string {
    const items = loadReading();
    const isUrl = urlOrTitle.startsWith("http");
    const item: ReadingItem = {
        id: uid(),
        title: isUrl ? urlOrTitle : urlOrTitle,
        url: isUrl ? urlOrTitle : undefined,
        notes,
        priority,
        status: "pending",
        addedAt: Date.now(),
    };
    items.push(item);
    saveReading(items);
    return `Added to reading list (priority ${priority}/5): "${urlOrTitle.slice(0, 60)}"`;
}

export function getReadingList(status: string): string {
    const items = loadReading();
    const filtered = status === "all" ? items : items.filter((i) => i.status === (status === "done" ? "done" : "pending"));
    if (filtered.length === 0) return `Reading list is empty (${status}).`;
    const sorted = filtered.sort((a, b) => b.priority - a.priority);
    const lines = sorted.map((i) => {
        const p = "★".repeat(i.priority) + "☆".repeat(5 - i.priority);
        const done = i.status === "done" ? "[✓] " : "";
        return `${done}${p} ${i.title.slice(0, 60)}${i.url ? "\n  " + i.url : ""}${i.notes ? "\n  Note: " + i.notes : ""}`;
    });
    return `Reading List (${filtered.length} items):\n\n${lines.join("\n\n")}`;
}

export async function summarizeUrl(url: string, addToList: boolean): Promise<string> {
    if (!url.startsWith("http")) return "ERROR: Enter a valid URL.";
    try {
        const ac = new AbortController();
        const tid = setTimeout(() => ac.abort(), 10000);
        const resp = await fetch(url, {
            signal: ac.signal,
            headers: {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AEGIS/1.0"},
        });
        clearTimeout(tid);
        if (!resp.ok) return `ERROR: Could not fetch URL (${resp.status}): ${url}`;
        const html = await resp.text();
        // Extract text from HTML
        const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim()
            .slice(0, 4000);

        if (addToList) {
            addReadingItem(url, "URL summarized", 3);
        }
        return `URL content (${url.slice(0, 60)}):\n\n${text}\n\n[As the LLM: summarize the text above and extract the main points.]`;
    } catch (e) {
        return `ERROR: ${(e as Error).message}`;
    }
}

// ── Goals ─────────────────────────────────────────────────────────────────────

function loadGoals(): Goal[] {
    try { return JSON.parse(fs.readFileSync(GOALS_FILE, "utf-8")); } catch { return []; }
}

function saveGoals(goals: Goal[]): void {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    fs.writeFileSync(GOALS_FILE, JSON.stringify(goals, null, 2));
}

export function setGoal(title: string, deadline: string, steps: string[]): string {
    if (!title.trim()) return "ERROR: Goal title is required.";
    const goals = loadGoals();
    const goal: Goal = {
        id: uid(), title, deadline, steps, progress: 0,
        notes: [], status: "active",
        createdAt: Date.now(), updatedAt: Date.now(),
    };
    goals.push(goal);
    saveGoals(goals);
    return `Goal created: "${title}"${deadline ? " (deadline: " + deadline + ")" : ""}${steps.length ? "\nSteps: " + steps.map((s, i) => `${i + 1}. ${s}`).join(", ") : ""}`;
}

export function checkInGoal(idOrTitle: string, progress: number, note: string): string {
    const goals = loadGoals();
    const idx = goals.findIndex((g) => g.id === idOrTitle || g.title.toLowerCase().includes(idOrTitle.toLowerCase()));
    if (idx === -1) return `Goal not found: "${idOrTitle}"`;
    const goal = goals[idx];
    goal.progress = Math.min(100, Math.max(0, progress));
    goal.updatedAt = Date.now();
    if (note) goal.notes.push(`${new Date().toLocaleDateString("tr-TR")}: ${note}`);
    if (goal.progress === 100) goal.status = "done";
    saveGoals(goals);
    const bar = "█".repeat(Math.round(goal.progress / 10)) + "░".repeat(10 - Math.round(goal.progress / 10));
    return `Goal updated: "${goal.title}"\n[${bar}] ${goal.progress}%${note ? "\nNote: " + note : ""}${goal.status === "done" ? "\n🎯 COMPLETED!" : ""}`;
}

export function listGoals(status: string): string {
    const goals = loadGoals();
    const filtered = status === "all" ? goals : goals.filter((g) => g.status === (status === "done" ? "done" : "active"));
    if (filtered.length === 0) return `No goals (${status}).`;
    const lines = filtered.map((g) => {
        const bar = "█".repeat(Math.round(g.progress / 10)) + "░".repeat(10 - Math.round(g.progress / 10));
        const dl = g.deadline ? ` (deadline: ${g.deadline})` : "";
        const steps = g.steps.length ? `\n  Steps: ${g.steps.join(" → ")}` : "";
        return `• ${g.title}${dl}\n  [${bar}] ${g.progress}%${steps}`;
    });
    return `Goals (${filtered.length}):\n\n${lines.join("\n\n")}`;
}

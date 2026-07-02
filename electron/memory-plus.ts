/**
 * Phase 16 — Advanced Memory
 *
 * 16.1 Persistent Facts: added manually via "remember this", or auto-extracted from conversation.
 * 16.2 Habit Tracking: counts which tools are used → most-used ones are listed first.
 * 16.3 Morning Summary: a daily summary is prepared on first launch (weather, notes, tasks).
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {searchFacts, inferFacts, reconcileFact, subjectOf} from "./adaptive-memory";
import {detectPatterns, buildProactiveSuggestion, type UsageRecord} from "./proactive";
import {reportCorruptedFile} from "./corrupted-file-tracker";
import {writeJsonAtomic} from "./json-store";

const BASE = path.join(os.homedir(), ".aegis");
const FACTS_PATH  = path.join(BASE, "facts.json");
const HABITS_PATH = path.join(BASE, "habits.json");
const USAGE_LOG_PATH = path.join(BASE, "usage-log.json");   // Phase 61 — timestamped usage

function ensureDir(): void { fs.mkdirSync(BASE, {recursive: true}); }

// ---- 16.1 Facts ----

export interface Fact {
    id: string;
    content: string;
    addedAt: string;
    source: "manual" | "auto";
    tags: string[];
}

function loadFacts(): Fact[] {
    let raw: string;
    try { raw = fs.readFileSync(FACTS_PATH, "utf-8"); } catch { return []; }
    try { return JSON.parse(raw); } catch {
        reportCorruptedFile("saved facts (facts.json)");
        try { fs.copyFileSync(FACTS_PATH, FACTS_PATH + ".bak"); } catch { /* best-effort backup */ }
        return [];
    }
}

function saveFacts(facts: Fact[]): void {
    ensureDir();
    writeJsonAtomic(FACTS_PATH, facts);
}

export function addFact(content: string, source: "manual" | "auto" = "manual", tags: string[] = []): string {
    if (!content.trim()) return "ERROR: Cannot add an empty fact.";
    const facts = loadFacts();
    if (facts.some((f) => f.content.toLowerCase() === content.toLowerCase())) {
        return `This fact is already saved.`;
    }
    const fact: Fact = {
        id: Date.now().toString(36),
        content: content.trim(),
        addedAt: new Date().toISOString(),
        source,
        tags,
    };
    facts.push(fact);
    saveFacts(facts);
    return `Fact saved: "${content}"`;
}

export function listFacts(filter = ""): string {
    const facts = loadFacts();
    if (facts.length === 0) return "No saved facts. You can add one with 'remember this: …'.";
    const filtered = filter
        ? facts.filter((f) => f.content.toLowerCase().includes(filter.toLowerCase()) || f.tags.some((t) => t.toLowerCase().includes(filter.toLowerCase())))
        : facts;
    if (filtered.length === 0) return `No facts matching "${filter}".`;
    return filtered.map((f) => `• [${f.id}] ${f.content}${f.tags.length ? " (" + f.tags.join(", ") + ")" : ""}`).join("\n");
}

export function removeFact(idOrContent: string): string {
    const facts = loadFacts();
    const idx = facts.findIndex((f) => f.id === idOrContent || f.content.toLowerCase().includes(idOrContent.toLowerCase()));
    if (idx === -1) return `No fact found with the name/ID "${idOrContent}".`;
    const removed = facts.splice(idx, 1)[0];
    saveFacts(facts);
    return `Fact deleted: "${removed.content}"`;
}

export function getFactsForContext(): string {
    const facts = loadFacts();
    if (facts.length === 0) return "";
    return `\n\nSAVED FACTS:\n${facts.map((f) => `- ${f.content}`).join("\n")}`;
}

// ---- Phase 57 — Adaptive Memory (semantic search + auto-inference + conflict resolution) ----

/**
 * "What did I say about X last month?" — finds the most semantically relevant saved
 * facts (local token-overlap; no embeddings needed). Tool: search_memory.
 */
export function searchMemory(query: string, limit = 5): string {
    const facts = loadFacts();
    if (facts.length === 0) return "No saved facts.";
    const hits = searchFacts(facts, query, limit);
    if (hits.length === 0) return `No facts semantically matching "${query}".`;
    return `Most relevant facts for "${query}":\n` +
        hits.map((h) => `• ${h.fact.content}  (${Math.round(h.score * 100)}% match)`).join("\n");
}

/**
 * Conflict-resolving add: if the new fact shares a subject with an existing one
 * (e.g. "my name …" again) it UPDATES the old one instead of adding a new one. Manual
 * `remember_fact` and auto-inference both use this.
 */
export function addFactReconciled(content: string, source: "manual" | "auto" = "manual"): string {
    if (!content.trim()) return "ERROR: Cannot add an empty fact.";
    const facts = loadFacts();
    const subject = subjectOf(content);
    const res = reconcileFact(facts, content, subject);
    if (res.action !== "duplicate") {
        const out = res.facts as Fact[];
        if (source === "manual") {
            const target = out.find((f) => f.content.trim() === content.trim());
            if (target) target.source = "manual"; // reconcile marks it auto; preserve manual
        }
        saveFacts(out);
    }
    return res.message;
}

/**
 * Auto-extracts facts from a user message and saves them with conflict resolution.
 * runAgent calls this (silently) on every user turn → AEGIS learns while talking.
 * The returned list summarizes genuinely new/updated facts (may be empty).
 */
export function autoLearnFromMessage(message: string): string[] {
    const inferred = inferFacts(message);
    if (inferred.length === 0) return [];
    const learned: string[] = [];
    for (const inf of inferred) {
        const facts = loadFacts();
        const res = reconcileFact(facts, inf.content, inf.subject);
        if (res.action !== "duplicate") {
            // apply the inferred tags
            const updated = res.facts as Fact[];
            const target = updated.find((f) => f.content.trim() === inf.content.trim());
            if (target && inf.tags.length) target.tags = inf.tags;
            saveFacts(updated);
            learned.push(res.action === "updated" ? `↻ ${inf.content}` : inf.content);
        }
    }
    return learned;
}

// ---- 16.2 Habit Tracking ----

interface HabitEntry {
    tool: string;
    count: number;
    lastUsed: string;
}

function loadHabits(): HabitEntry[] {
    try { return JSON.parse(fs.readFileSync(HABITS_PATH, "utf-8")); } catch { return []; }
}

function saveHabits(habits: HabitEntry[]): void {
    ensureDir();
    writeJsonAtomic(HABITS_PATH, habits);
}

export function recordToolUsage(toolName: string): void {
    const habits = loadHabits();
    const entry = habits.find((h) => h.tool === toolName);
    if (entry) {
        entry.count++;
        entry.lastUsed = new Date().toISOString();
    } else {
        habits.push({tool: toolName, count: 1, lastUsed: new Date().toISOString()});
    }
    saveHabits(habits);
    recordUsageTimestamped(toolName);   // Phase 61 — for temporal patterns
}

// ---- Phase 61 — Proactive pattern learning (opt-in) ----

const MAX_USAGE_LOG = 500;   // last N uses; enough for habit inference, keeps the file from bloating

function loadUsageLog(): UsageRecord[] {
    try { return JSON.parse(fs.readFileSync(USAGE_LOG_PATH, "utf-8")); } catch { return []; }
}

function recordUsageTimestamped(tool: string): void {
    const log = loadUsageLog();
    const now = new Date();
    log.push({tool, hour: now.getHours(), ts: now.getTime()});
    if (log.length > MAX_USAGE_LOG) log.splice(0, log.length - MAX_USAGE_LOG);
    try { writeJsonAtomic(USAGE_LOG_PATH, log, false); }
    catch (e) { console.error("[usage-log]", (e as Error).message); }
}

/** Returns the detected temporal habit patterns (raw data, independent of opt-in). */
export function getProactivePatterns(): ReturnType<typeof detectPatterns> {
    return detectPatterns(loadUsageLog());
}

/**
 * Opt-in proactive suggestion. Returns null when `enabled` is false (the default) — so it
 * doesn't backfire before a trust baseline is established. When enabled, it summarizes the
 * strongest temporal patterns.
 */
export function getProactiveSuggestion(enabled: boolean): string | null {
    return buildProactiveSuggestion(loadUsageLog(), enabled);
}

export function getTopTools(n = 5): {tool: string; count: number}[] {
    return loadHabits().sort((a, b) => b.count - a.count).slice(0, n);
}

export function listHabits(): string {
    const habits = getTopTools(10);
    if (habits.length === 0) return "No habit data yet.";
    return `Most frequently used tools:\n${habits.map((h, i) => `${i + 1}. ${h.tool} — ${h.count} uses`).join("\n")}`;
}

// ---- 16.3 Morning Summary ----

const MORNING_CHECK_PATH = path.join(BASE, "morning-check.json");

interface MorningCheck {
    date: string; // YYYY-MM-DD
}

export function shouldShowMorningSummary(): boolean {
    try {
        const data = JSON.parse(fs.readFileSync(MORNING_CHECK_PATH, "utf-8")) as MorningCheck;
        const today = new Date().toISOString().slice(0, 10);
        return data.date !== today;
    } catch { return true; }
}

export function markMorningSummaryShown(): void {
    ensureDir();
    const today = new Date().toISOString().slice(0, 10);
    writeJsonAtomic(MORNING_CHECK_PATH, {date: today});
}

export function buildMorningSummaryPrompt(): string {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    return `${greeting}! Prepare a daily summary: 1) Get the weather. 2) Check pending notes. 3) List scheduled tasks. Keep it short and simple.`;
}

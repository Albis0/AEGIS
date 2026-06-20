/**
 * Faz 16 — Gelişmiş Hafıza
 *
 * 16.1 Kalıcı Gerçekler (Facts): "Bunu bil" ile manuel, ya da konuşmadan otomatik çıkarılır.
 * 16.2 Alışkanlık Takibi: hangi tool'ların kullanıldığı sayılır → sık kullanılanlar önce listelenir.
 * 16.3 Sabah Özeti: ilk açılışta gün özeti hazırlanır (hava, notlar, görevler).
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {searchFacts, inferFacts, reconcileFact, subjectOf} from "./adaptive-memory";
import {detectPatterns, buildProactiveSuggestion, type UsageRecord} from "./proactive";

const BASE = path.join(os.homedir(), ".aegis");
const FACTS_PATH  = path.join(BASE, "facts.json");
const HABITS_PATH = path.join(BASE, "habits.json");
const USAGE_LOG_PATH = path.join(BASE, "usage-log.json");   // Faz 61 — zaman-damgalı kullanım

function ensureDir(): void { fs.mkdirSync(BASE, {recursive: true}); }

// ---- 16.1 Gerçekler (Facts) ----

export interface Fact {
    id: string;
    content: string;
    addedAt: string;
    source: "manual" | "auto";
    tags: string[];
}

function loadFacts(): Fact[] {
    try { return JSON.parse(fs.readFileSync(FACTS_PATH, "utf-8")); } catch { return []; }
}

function saveFacts(facts: Fact[]): void {
    ensureDir();
    fs.writeFileSync(FACTS_PATH, JSON.stringify(facts, null, 2), "utf-8");
}

export function addFact(content: string, source: "manual" | "auto" = "manual", tags: string[] = []): string {
    if (!content.trim()) return "HATA: Boş gerçek eklenemez.";
    const facts = loadFacts();
    if (facts.some((f) => f.content.toLowerCase() === content.toLowerCase())) {
        return `Bu gerçek zaten kayıtlı.`;
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
    return `Gerçek kaydedildi: "${content}"`;
}

export function listFacts(filter = ""): string {
    const facts = loadFacts();
    if (facts.length === 0) return "Kayıtlı gerçek yok. 'Bunu bil: …' ile ekleyebilirsin.";
    const filtered = filter
        ? facts.filter((f) => f.content.toLowerCase().includes(filter.toLowerCase()) || f.tags.some((t) => t.toLowerCase().includes(filter.toLowerCase())))
        : facts;
    if (filtered.length === 0) return `"${filter}" ile eşleşen gerçek bulunamadı.`;
    return filtered.map((f) => `• [${f.id}] ${f.content}${f.tags.length ? " (" + f.tags.join(", ") + ")" : ""}`).join("\n");
}

export function removeFact(idOrContent: string): string {
    const facts = loadFacts();
    const idx = facts.findIndex((f) => f.id === idOrContent || f.content.toLowerCase().includes(idOrContent.toLowerCase()));
    if (idx === -1) return `"${idOrContent}" adında/ID'sinde gerçek bulunamadı.`;
    const removed = facts.splice(idx, 1)[0];
    saveFacts(facts);
    return `Gerçek silindi: "${removed.content}"`;
}

export function getFactsForContext(): string {
    const facts = loadFacts();
    if (facts.length === 0) return "";
    return `\n\nKAYITLI GERÇEKLER:\n${facts.map((f) => `- ${f.content}`).join("\n")}`;
}

// ---- Faz 57 — Adaptif Hafıza (semantik arama + otomatik çıkarım + çelişki çözme) ----

/**
 * "Geçen ay X hakkında ne demiştim?" — kayıtlı gerçekler içinde anlamca en yakın
 * olanları bulur (yerel token-overlap; embedding gerekmez). Tool: search_memory.
 */
export function searchMemory(query: string, limit = 5): string {
    const facts = loadFacts();
    if (facts.length === 0) return "Kayıtlı gerçek yok.";
    const hits = searchFacts(facts, query, limit);
    if (hits.length === 0) return `"${query}" ile anlamca eşleşen gerçek bulunamadı.`;
    return `"${query}" için en alakalı gerçekler:\n` +
        hits.map((h) => `• ${h.fact.content}  (%${Math.round(h.score * 100)} uyum)`).join("\n");
}

/**
 * Çelişki-çözen ekleme: yeni gerçek mevcut bir gerçekle aynı özneye sahipse
 * (ör. tekrar "adım …") eskiyi GÜNCELLER, yenisini eklemek yerine. Manuel
 * `remember_fact` ve otomatik çıkarım bunu kullanır.
 */
export function addFactReconciled(content: string, source: "manual" | "auto" = "manual"): string {
    if (!content.trim()) return "HATA: Boş gerçek eklenemez.";
    const facts = loadFacts();
    const subject = subjectOf(content);
    const res = reconcileFact(facts, content, subject);
    if (res.action !== "duplicate") {
        const out = res.facts as Fact[];
        if (source === "manual") {
            const target = out.find((f) => f.content.trim() === content.trim());
            if (target) target.source = "manual"; // reconcile auto işaretler; manuel'i koru
        }
        saveFacts(out);
    }
    return res.message;
}

/**
 * Bir kullanıcı mesajından otomatik gerçek çıkarır ve çelişki-çözerek kaydeder.
 * runAgent her kullanıcı turunda (sessizce) çağırır → AEGIS konuşurken öğrenir.
 * Döndürülen liste, gerçekten yeni/güncellenen gerçeklerin özetidir (boş olabilir).
 */
export function autoLearnFromMessage(message: string): string[] {
    const inferred = inferFacts(message);
    if (inferred.length === 0) return [];
    const learned: string[] = [];
    for (const inf of inferred) {
        const facts = loadFacts();
        const res = reconcileFact(facts, inf.content, inf.subject);
        if (res.action !== "duplicate") {
            // çıkarılan tag'leri uygula
            const updated = res.facts as Fact[];
            const target = updated.find((f) => f.content.trim() === inf.content.trim());
            if (target && inf.tags.length) target.tags = inf.tags;
            saveFacts(updated);
            learned.push(res.action === "updated" ? `↻ ${inf.content}` : inf.content);
        }
    }
    return learned;
}

// ---- 16.2 Alışkanlık Takibi ----

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
    fs.writeFileSync(HABITS_PATH, JSON.stringify(habits, null, 2), "utf-8");
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
    recordUsageTimestamped(toolName);   // Faz 61 — zamansal örüntü için
}

// ---- Faz 61 — Proaktif örüntü öğrenme (opt-in) ----

const MAX_USAGE_LOG = 500;   // son N kullanım; alışkanlık çıkarımına yeter, dosya şişmez

function loadUsageLog(): UsageRecord[] {
    try { return JSON.parse(fs.readFileSync(USAGE_LOG_PATH, "utf-8")); } catch { return []; }
}

function recordUsageTimestamped(tool: string): void {
    const log = loadUsageLog();
    const now = new Date();
    log.push({tool, hour: now.getHours(), ts: now.getTime()});
    if (log.length > MAX_USAGE_LOG) log.splice(0, log.length - MAX_USAGE_LOG);
    try { ensureDir(); fs.writeFileSync(USAGE_LOG_PATH, JSON.stringify(log), "utf-8"); }
    catch (e) { console.error("[usage-log]", (e as Error).message); }
}

/** Tespit edilen zamansal alışkanlık örüntülerini döndürür (opt-in'den bağımsız ham veri). */
export function getProactivePatterns(): ReturnType<typeof detectPatterns> {
    return detectPatterns(loadUsageLog());
}

/**
 * Opt-in proaktif öneri. `enabled` false (varsayılan) ise null döner — güven tabanı
 * kurulmadan ters tepmesin. Açıksa en güçlü zamansal örüntüleri özetler.
 */
export function getProactiveSuggestion(enabled: boolean): string | null {
    return buildProactiveSuggestion(loadUsageLog(), enabled);
}

export function getTopTools(n = 5): {tool: string; count: number}[] {
    return loadHabits().sort((a, b) => b.count - a.count).slice(0, n);
}

export function listHabits(): string {
    const habits = getTopTools(10);
    if (habits.length === 0) return "Henüz alışkanlık verisi yok.";
    return `En sık kullanılan araçlar:\n${habits.map((h, i) => `${i + 1}. ${h.tool} — ${h.count} kullanım`).join("\n")}`;
}

// ---- 16.3 Sabah Özeti ----

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
    fs.writeFileSync(MORNING_CHECK_PATH, JSON.stringify({date: today}), "utf-8");
}

export function buildMorningSummaryPrompt(): string {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
    return `${greeting}! Günlük özet hazırla: 1) Hava durumunu al. 2) Bekleyen notları kontrol et. 3) Zamanlanmış görevleri listele. Kısa ve sade tut.`;
}

/**
 * Faz 52 — Routines (deterministik çok-adımlı aksiyon kaydı)
 *
 * Macro'dan farkı: macro doğal-dil komut METNİ kaydeder ve `chat-stream-inject`
 * ile LLM'e geri yollar (yavaş, belirsiz). Routine ise TOOL ÇAĞRILARINI
 * ({tool, args}) yakalar ve doğrudan `executeTool` ile deterministik çalıştırır —
 * LLM'e geri dönmeden, tıpkı reference-resolver gibi. "Jarvis hissi" için sağlam.
 *
 * Akış:
 *   "Kayıt başlat: Oyun Modu" → startRecording("Oyun Modu")
 *   (kullanıcı normal komutlar verir; eylem tool'ları otomatik yakalanır)
 *   "Kayıt bitir"             → stopRecording() → routines.json'a yazılır
 *   "Oyun Modunu aç"          → runRoutine'in adımları sırayla executeTool ile çalışır
 *
 * Kayıt KAPSAMI: yalnızca DURUM DEĞİŞTİREN eylem tool'ları (spotify/steam/sistem/
 * dosya…). Salt-okuma tool'ları (web_search, screenshot, list_*, *_now_playing …)
 * routine'e eklenmez — tekrar çalıştırınca temiz ve anlamlı olsun.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface RoutineStep {
    tool: string;
    args: Record<string, unknown>;
}

export interface Routine {
    id: string;
    name: string;
    steps: RoutineStep[];
    createdAt: string;
    updatedAt: string;
}

const ROUTINES_PATH = path.join(os.homedir(), ".aegis", "routines.json");

// ---- persistence ----

function ensureDir(): void {
    fs.mkdirSync(path.dirname(ROUTINES_PATH), {recursive: true});
}

function loadRoutines(): Routine[] {
    try {
        const data = JSON.parse(fs.readFileSync(ROUTINES_PATH, "utf-8"));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveRoutines(routines: Routine[]): void {
    ensureDir();
    fs.writeFileSync(ROUTINES_PATH, JSON.stringify(routines, null, 2), "utf-8");
}

function makeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function findRoutine(routines: Routine[], idOrName: string): number {
    const q = idOrName.trim().toLowerCase();
    // exact id first, then exact name, then partial name
    let idx = routines.findIndex((r) => r.id === idOrName);
    if (idx !== -1) return idx;
    idx = routines.findIndex((r) => r.name.toLowerCase() === q);
    if (idx !== -1) return idx;
    return routines.findIndex((r) => r.name.toLowerCase().includes(q));
}

// ---- which tools are worth recording ----

/**
 * Salt-okuma / yan etkisiz tool'lar — routine'e KAYDEDİLMEZ.
 * Routine tekrar çalıştırılınca gereksiz aramalar/screenshot'lar tekrarlanmasın.
 */
const READONLY_PREFIXES = ["list_", "get_"];
const READONLY_TOOLS = new Set<string>([
    "web_search", "fetch_url", "screenshot", "analyze_screen", "screen_size",
    "spotify_now_playing", "spotify_get_queue", "spotify_recently_played",
    "spotify_me", "spotify_search", "steam_list", "steam_game_running",
    "read_file", "read_clipboard", "system_report", "get_weather",
    "search_knowledge", "content_search", "file_search", "app_search",
    "list_windows", "git_status", "git_log", "git_diff",
    // routine/macro/agent meta-tool'ları asla bir routine'in içine girmemeli
    "start_macro", "stop_macro", "run_macro", "list_macros", "delete_macro",
    "agent_run", "computer_use",
]);

/** Bu tool durum değiştiren bir eylem mi? (kayda değer mi) */
export function isRecordableTool(tool: string): boolean {
    if (tool.startsWith("routine_")) return false;
    if (READONLY_TOOLS.has(tool)) return false;
    if (tool.endsWith("_list") || tool.endsWith("_now_playing")) return false;
    for (const p of READONLY_PREFIXES) if (tool.startsWith(p)) return false;
    return true;
}

// ---- recording state (RAM) ----

let recording: {name: string; steps: RoutineStep[]} | null = null;

export function isRecording(): boolean {
    return recording !== null;
}

export function recordingName(): string | null {
    return recording?.name ?? null;
}

export function startRecording(name: string): string {
    const clean = name.trim() || "İsimsiz Routine";
    if (recording) {
        return `Zaten "${recording.name}" routine'i kaydediliyor (${recording.steps.length} adım). Önce "kayıt bitir" de.`;
    }
    recording = {name: clean, steps: []};
    return `🔴 "${clean}" routine kaydı başladı. Şimdi yapmamı istediğin işlemleri komut olarak ver; bitince "kayıt bitir" de.`;
}

/**
 * runAgent tool döngüsünden, her başarılı eylem tool'u sonrası çağrılır.
 * Kayıt aktif değilse veya tool kayda değmiyorsa sessizce yok sayar.
 */
export function captureStep(tool: string, args: Record<string, unknown>): void {
    if (!recording) return;
    if (!isRecordableTool(tool)) return;
    recording.steps.push({tool, args});
}

export function stopRecording(): string {
    if (!recording) return "Aktif routine kaydı yok.";
    const {name, steps} = recording;
    recording = null;

    if (steps.length === 0) {
        return `"${name}" routine'ine kaydedilecek bir eylem olmadı. Routine oluşturulmadı.`;
    }

    const routines = loadRoutines();
    const now = new Date().toISOString();
    const existing = findRoutine(routines, name);
    if (existing !== -1 && routines[existing].name.toLowerCase() === name.toLowerCase()) {
        routines[existing] = {...routines[existing], steps, updatedAt: now};
        saveRoutines(routines);
        return `✅ "${name}" routine'i güncellendi (${steps.length} adım).`;
    }
    routines.push({id: makeId(), name, steps, createdAt: now, updatedAt: now});
    saveRoutines(routines);
    return `✅ "${name}" routine'i kaydedildi (${steps.length} adım). "${name} aç/çalıştır" diyerek tekrarlayabilirsin.`;
}

/** Kaydı kaydetmeden iptal et. */
export function cancelRecording(): string {
    if (!recording) return "Aktif routine kaydı yok.";
    const name = recording.name;
    recording = null;
    return `"${name}" routine kaydı iptal edildi (kaydedilmedi).`;
}

// ---- CRUD ----

export function listRoutines(): string {
    const routines = loadRoutines();
    if (routines.length === 0) return "Kayıtlı routine yok. 'Kayıt başlat: <isim>' ile oluşturabilirsin.";
    return routines
        .map((r) => `• ${r.name} (${r.steps.length} adım, ID: ${r.id})`)
        .join("\n");
}

export function deleteRoutine(idOrName: string): string {
    const routines = loadRoutines();
    const idx = findRoutine(routines, idOrName);
    if (idx === -1) return `"${idOrName}" adında routine bulunamadı.`;
    const removed = routines.splice(idx, 1)[0];
    saveRoutines(routines);
    return `🗑️ "${removed.name}" routine'i silindi.`;
}

export function renameRoutine(idOrName: string, newName: string): string {
    const clean = newName.trim();
    if (!clean) return "Yeni isim boş olamaz.";
    const routines = loadRoutines();
    const idx = findRoutine(routines, idOrName);
    if (idx === -1) return `"${idOrName}" adında routine bulunamadı.`;
    const old = routines[idx].name;
    routines[idx].name = clean;
    routines[idx].updatedAt = new Date().toISOString();
    saveRoutines(routines);
    return `✏️ "${old}" → "${clean}" olarak yeniden adlandırıldı.`;
}

/** Bir adımı kaldır (1-tabanlı index). */
export function deleteRoutineStep(idOrName: string, stepNumber: number): string {
    const routines = loadRoutines();
    const idx = findRoutine(routines, idOrName);
    if (idx === -1) return `"${idOrName}" adında routine bulunamadı.`;
    const r = routines[idx];
    if (stepNumber < 1 || stepNumber > r.steps.length) {
        return `Geçersiz adım numarası ${stepNumber}. "${r.name}" routine'inde ${r.steps.length} adım var.`;
    }
    const removed = r.steps.splice(stepNumber - 1, 1)[0];
    r.updatedAt = new Date().toISOString();
    saveRoutines(routines);
    return `"${r.name}" routine'inden ${stepNumber}. adım (${removed.tool}) çıkarıldı. Kalan: ${r.steps.length} adım.`;
}

/** Bir routine'in adımlarını okunabilir biçimde göster (düzenleme öncesi). */
export function showRoutine(idOrName: string): string {
    const routines = loadRoutines();
    const idx = findRoutine(routines, idOrName);
    if (idx === -1) return `"${idOrName}" adında routine bulunamadı.`;
    const r = routines[idx];
    if (r.steps.length === 0) return `"${r.name}" routine'i boş.`;
    const lines = r.steps.map((s, i) => {
        const argStr = Object.entries(s.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
        return `  ${i + 1}. ${s.tool}(${argStr})`;
    });
    return `"${r.name}" routine'i (${r.steps.length} adım):\n${lines.join("\n")}`;
}

/** Çalıştırma için adımları döndür (null = bulunamadı). */
export function getRoutine(idOrName: string): Routine | null {
    const routines = loadRoutines();
    const idx = findRoutine(routines, idOrName);
    return idx === -1 ? null : routines[idx];
}

// ---- test helper ----

/** Test izolasyonu için: dosyayı ve kayıt durumunu sıfırla. */
export function _resetForTest(): void {
    recording = null;
    try { fs.rmSync(ROUTINES_PATH, {force: true}); } catch { /* yok */ }
}

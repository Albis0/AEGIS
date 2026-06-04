import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {exec as execCb} from "child_process";

const RULES_PATH = path.join(os.homedir(), ".aegis", "context-rules.json");
const CLIPBOARD_HIST_PATH = path.join(os.homedir(), ".aegis", "clipboard-history.json");

interface ContextRule {
    appPattern: string;
    suggestion: string;
    autoAction?: string;
}

interface ClipboardEntry {
    time: string;
    content: string;
    type: "url" | "code" | "error" | "text";
}

function load<T>(p: string, def: T): T {
    try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return def; }
}
function save(p: string, data: unknown): void {
    fs.mkdirSync(path.dirname(p), {recursive: true});
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}
function runPs(cmd: string): Promise<string> {
    return new Promise((res) => {
        execCb(`powershell -NoProfile -Command "${cmd.replace(/"/g, '\\"')}"`,
            {timeout: 8000, windowsHide: true},
            (err, stdout) => res(err ? "" : (stdout ?? "").trim())
        );
    });
}

export async function getActiveContext(): Promise<string> {
    const title = await runPs("(Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Sort-Object CPU -Descending | Select-Object -First 1).MainWindowTitle");
    const appName = await runPs("(Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Sort-Object CPU -Descending | Select-Object -First 1).ProcessName");
    const app = (appName || "bilinmiyor").toLowerCase();
    const t = (title || "").toLowerCase();

    let context = "genel";
    let suggestions: string[] = [];

    if (app.includes("code") || app.includes("devenv") || t.includes("visual studio")) {
        context = "kod editörü";
        suggestions = ["git_status — değişiklikleri gör", "run_tests — testleri çalıştır", "lint_project — kod kalitesini kontrol et"];
    } else if (app.includes("chrome") || app.includes("firefox") || app.includes("edge") || app.includes("browser")) {
        context = "web tarayıcı";
        suggestions = ["web_search — arama yap", "fetch_url — sayfayı oku", "translate_text — metni çevir"];
    } else if (app.includes("zoom") || app.includes("teams") || app.includes("meet") || t.includes("meeting") || t.includes("toplantı")) {
        context = "video toplantı";
        suggestions = ["meeting_start — toplantı kaydı başlat", "do_not_disturb 60 — rahatsız etme", "translation_start — anlık çeviri"];
    } else if (app.includes("steam") || app.includes("game") || app.includes("valorant") || app.includes("minecraft")) {
        context = "oyun";
        suggestions = ["do_not_disturb 120 — 2 saat rahatsız etme", "perf_mode_start — performans modu", "ambient_stop — arka plan sesi kapat"];
    } else if (app.includes("spotify") || app.includes("music") || app.includes("vlc")) {
        context = "medya";
        suggestions = ["play_sound — ses çal", "set_volume — ses ayarla"];
    }

    const rules: ContextRule[] = load(RULES_PATH, []);
    const matchedRule = rules.find((r) => app.includes(r.appPattern.toLowerCase()) || t.includes(r.appPattern.toLowerCase()));
    if (matchedRule) suggestions.unshift(`Kural: ${matchedRule.suggestion}`);

    return [
        `Aktif Uygulama: ${appName || "bilinmiyor"}`,
        `Pencere: ${title || "bilinmiyor"}`,
        `Bağlam: ${context}`,
        suggestions.length ? `Öneriler:\n${suggestions.map((s) => `  • ${s}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");
}

export function contextRuleSet(appPattern: string, suggestion: string, autoAction?: string): string {
    const rules: ContextRule[] = load(RULES_PATH, []);
    const idx = rules.findIndex((r) => r.appPattern.toLowerCase() === appPattern.toLowerCase());
    const rule: ContextRule = {appPattern, suggestion, autoAction};
    if (idx >= 0) rules[idx] = rule;
    else rules.push(rule);
    save(RULES_PATH, rules);
    return `Bağlam kuralı eklendi: "${appPattern}" → "${suggestion}"${autoAction ? ` (otomatik: ${autoAction})` : ""}`;
}

export function contextRuleList(): string {
    const rules: ContextRule[] = load(RULES_PATH, []);
    if (rules.length === 0) return "Bağlam kuralı yok.";
    return rules.map((r, i) => `${i + 1}. ${r.appPattern} → ${r.suggestion}${r.autoAction ? ` [otomatik: ${r.autoAction}]` : ""}`).join("\n");
}

export async function clipboardWatch(): Promise<string> {
    const raw = await runPs("Get-Clipboard");
    if (!raw) return "Pano boş.";
    const content = raw.trim();
    // classify
    let type: ClipboardEntry["type"] = "text";
    let suggestion = "";
    if (/^https?:\/\/\S+$/.test(content)) {
        type = "url";
        suggestion = "fetch_url ile sayfayı oku mu? Yoksa web_search ile arama?";
    } else if (/\n.*\n/.test(content) && (/function|class|def |import |const |var |let /.test(content))) {
        type = "code";
        suggestion = "Bu kodu açıklayayım mı? Veya lint/hata analizi?";
    } else if (/error|exception|traceback|at line|HATA/i.test(content)) {
        type = "error";
        suggestion = "Bu hatayı analiz edeyim mi?";
    }
    addToClipboardHistory({time: new Date().toISOString(), content: content.slice(0, 500), type});
    return `Pano içeriği (${type}): ${content.slice(0, 200)}${content.length > 200 ? "..." : ""}\n${suggestion ? `\nÖneri: ${suggestion}` : ""}`;
}

function addToClipboardHistory(entry: ClipboardEntry): void {
    const hist: ClipboardEntry[] = load(CLIPBOARD_HIST_PATH, []);
    hist.unshift(entry);
    save(CLIPBOARD_HIST_PATH, hist.slice(0, 50));
}

export function clipboardHistory(count: number): string {
    const hist: ClipboardEntry[] = load(CLIPBOARD_HIST_PATH, []);
    const n = Math.min(count || 10, hist.length);
    if (n === 0) return "Pano geçmişi boş.";
    return hist.slice(0, n).map((e, i) =>
        `${i + 1}. [${new Date(e.time).toLocaleTimeString("tr-TR")}] (${e.type}) ${e.content.slice(0, 80)}`
    ).join("\n");
}

export function clipboardSearch(query: string): string {
    const hist: ClipboardEntry[] = load(CLIPBOARD_HIST_PATH, []);
    const q = query.toLowerCase();
    const matches = hist.filter((e) => e.content.toLowerCase().includes(q));
    if (matches.length === 0) return `"${query}" pano geçmişinde bulunamadı.`;
    return matches.slice(0, 10).map((e, i) =>
        `${i + 1}. [${new Date(e.time).toLocaleTimeString("tr-TR")}] ${e.content.slice(0, 100)}`
    ).join("\n");
}

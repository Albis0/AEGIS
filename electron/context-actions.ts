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
function runPs(script: string): Promise<string> {
    return new Promise((res) => {
        const child = execCb(
            "powershell -NoProfile -NonInteractive -Command -",
            {timeout: 8000, windowsHide: true},
            (err, stdout) => res(err ? "" : (stdout ?? "").trim())
        );
        child.stdin?.end(script);
    });
}

export async function getActiveContext(): Promise<string> {
    const title = await runPs("(Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Sort-Object CPU -Descending | Select-Object -First 1).MainWindowTitle");
    const appName = await runPs("(Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Sort-Object CPU -Descending | Select-Object -First 1).ProcessName");
    const app = (appName || "unknown").toLowerCase();
    const t = (title || "").toLowerCase();

    let context = "general";
    let suggestions: string[] = [];

    if (app.includes("code") || app.includes("devenv") || t.includes("visual studio")) {
        context = "code editor";
        suggestions = ["git_status — see changes", "run_tests — run the tests", "lint_project — check code quality"];
    } else if (app.includes("chrome") || app.includes("firefox") || app.includes("edge") || app.includes("browser")) {
        context = "web browser";
        suggestions = ["web_search — search", "fetch_url — read the page", "translate_text — translate text"];
    } else if (app.includes("zoom") || app.includes("teams") || app.includes("meet") || t.includes("meeting") || t.includes("toplantı")) {
        context = "video meeting";
        suggestions = ["meeting_start — start meeting recording", "do_not_disturb 60 — do not disturb", "translation_start — live translation"];
    } else if (app.includes("steam") || app.includes("game") || app.includes("valorant") || app.includes("minecraft")) {
        context = "gaming";
        suggestions = ["do_not_disturb 120 — do not disturb for 2 hours", "perf_mode_start — performance mode", "ambient_stop — turn off background sound"];
    } else if (app.includes("spotify") || app.includes("music") || app.includes("vlc")) {
        context = "media";
        suggestions = ["play_sound — play a sound", "set_volume — adjust volume"];
    }

    const rules: ContextRule[] = load(RULES_PATH, []);
    const matchedRule = rules.find((r) => app.includes(r.appPattern.toLowerCase()) || t.includes(r.appPattern.toLowerCase()));
    if (matchedRule) suggestions.unshift(`Rule: ${matchedRule.suggestion}`);

    return [
        `Active Application: ${appName || "unknown"}`,
        `Window: ${title || "unknown"}`,
        `Context: ${context}`,
        suggestions.length ? `Suggestions:\n${suggestions.map((s) => `  • ${s}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");
}

export function contextRuleSet(appPattern: string, suggestion: string, autoAction?: string): string {
    const rules: ContextRule[] = load(RULES_PATH, []);
    const idx = rules.findIndex((r) => r.appPattern.toLowerCase() === appPattern.toLowerCase());
    const rule: ContextRule = {appPattern, suggestion, autoAction};
    if (idx >= 0) rules[idx] = rule;
    else rules.push(rule);
    save(RULES_PATH, rules);
    return `Context rule added: "${appPattern}" → "${suggestion}"${autoAction ? ` (auto: ${autoAction})` : ""}`;
}

export function contextRuleList(): string {
    const rules: ContextRule[] = load(RULES_PATH, []);
    if (rules.length === 0) return "No context rules.";
    return rules.map((r, i) => `${i + 1}. ${r.appPattern} → ${r.suggestion}${r.autoAction ? ` [auto: ${r.autoAction}]` : ""}`).join("\n");
}

export async function clipboardWatch(): Promise<string> {
    const raw = await runPs("Get-Clipboard");
    if (!raw) return "Clipboard is empty.";
    const content = raw.trim();
    // classify
    let type: ClipboardEntry["type"] = "text";
    let suggestion = "";
    if (/^https?:\/\/\S+$/.test(content)) {
        type = "url";
        suggestion = "Read the page with fetch_url? Or search with web_search?";
    } else if (/\n.*\n/.test(content) && (/function|class|def |import |const |var |let /.test(content))) {
        type = "code";
        suggestion = "Should I explain this code? Or run a lint/error analysis?";
    } else if (/error|exception|traceback|at line|HATA/i.test(content)) {
        type = "error";
        suggestion = "Should I analyze this error?";
    }
    addToClipboardHistory({time: new Date().toISOString(), content: content.slice(0, 500), type});
    return `Clipboard content (${type}): ${content.slice(0, 200)}${content.length > 200 ? "..." : ""}\n${suggestion ? `\nSuggestion: ${suggestion}` : ""}`;
}

function addToClipboardHistory(entry: ClipboardEntry): void {
    const hist: ClipboardEntry[] = load(CLIPBOARD_HIST_PATH, []);
    hist.unshift(entry);
    save(CLIPBOARD_HIST_PATH, hist.slice(0, 50));
}

export function clipboardHistory(count: number): string {
    const hist: ClipboardEntry[] = load(CLIPBOARD_HIST_PATH, []);
    const n = Math.min(count || 10, hist.length);
    if (n === 0) return "Clipboard history is empty.";
    return hist.slice(0, n).map((e, i) =>
        `${i + 1}. [${new Date(e.time).toLocaleTimeString("tr-TR")}] (${e.type}) ${e.content.slice(0, 80)}`
    ).join("\n");
}

export function clipboardSearch(query: string): string {
    const hist: ClipboardEntry[] = load(CLIPBOARD_HIST_PATH, []);
    const q = query.toLowerCase();
    const matches = hist.filter((e) => e.content.toLowerCase().includes(q));
    if (matches.length === 0) return `"${query}" not found in clipboard history.`;
    return matches.slice(0, 10).map((e, i) =>
        `${i + 1}. [${new Date(e.time).toLocaleTimeString("tr-TR")}] ${e.content.slice(0, 100)}`
    ).join("\n");
}

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {exec as execCb} from "child_process";

const HISTORY_PATH = path.join(os.homedir(), ".aegis", "notification-history.json");
const FILTERS_PATH = path.join(os.homedir(), ".aegis", "notification-filters.json");
const DND_PATH = path.join(os.homedir(), ".aegis", "dnd-state.json");

interface NotifRecord {
    time: string;
    app: string;
    title: string;
    body: string;
    priority?: number;
}

interface NotifFilter {
    app: string;
    action: "show" | "hide";
}

interface DndState {
    active: boolean;
    endsAt: number | null;
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
            {timeout: 15000, windowsHide: true},
            (err, stdout) => res(err ? "" : (stdout ?? "").trim())
        );
        child.stdin?.end(script);
    });
}

export async function getRecentNotifications(count: number): Promise<string> {
    const n = Math.min(count || 20, 100);
    const ps = `Get-WinEvent -ProviderName Microsoft-Windows-PushNotification-Platform -MaxEvents ${n} -ErrorAction SilentlyContinue | Select-Object TimeCreated,Message | ConvertTo-Json -Compress`;
    const raw = await runPs(ps);
    if (!raw || raw.length < 5) {
        // Fallback: uygulama event log
        const fb = await runPs(`Get-EventLog -LogName Application -Newest ${n} -ErrorAction SilentlyContinue | Select-Object TimeGenerated,Source,Message | ConvertTo-Json -Compress`);
        if (!fb || fb.length < 5) return "Bildirim geçmişi alınamadı (PushNotification log erişimi kısıtlı olabilir).";
        try {
            const arr = JSON.parse(fb.startsWith("[") ? fb : `[${fb}]`);
            const records: NotifRecord[] = arr.slice(0, n).map((e: Record<string, string>) => ({
                time: e.TimeGenerated,
                app: e.Source ?? "Sistem",
                title: (e.Message ?? "").slice(0, 80),
                body: "",
            }));
            saveHistory(records);
            return records.map((r) => `[${r.time}] ${r.app}: ${r.title}`).join("\n");
        } catch { return "Bildirim geçmişi çözümlenemedi."; }
    }
    try {
        const arr = JSON.parse(raw.startsWith("[") ? raw : `[${raw}]`);
        const records: NotifRecord[] = arr.map((e: Record<string, string>) => ({
            time: e.TimeCreated,
            app: "Windows",
            title: (e.Message ?? "").slice(0, 80),
            body: "",
        }));
        saveHistory(records);
        return records.map((r) => `[${r.time}] ${r.app}: ${r.title}`).join("\n");
    } catch { return raw.slice(0, 500); }
}

function saveHistory(records: NotifRecord[]): void {
    const existing: NotifRecord[] = load(HISTORY_PATH, []);
    const merged = [...records, ...existing].slice(0, 500);
    save(HISTORY_PATH, merged);
}

export function notifFilterSet(app: string, action: "show" | "hide"): string {
    const filters: NotifFilter[] = load(FILTERS_PATH, []);
    const idx = filters.findIndex((f) => f.app.toLowerCase() === app.toLowerCase());
    if (idx >= 0) filters[idx].action = action;
    else filters.push({app, action});
    save(FILTERS_PATH, filters);
    return `Kural eklendi: "${app}" uygulamasının bildirimleri ${action === "show" ? "gösterilecek" : "gizlenecek"}.`;
}

export function notifFilterList(): string {
    const filters: NotifFilter[] = load(FILTERS_PATH, []);
    if (filters.length === 0) return "Bildirim filtresi kuralı yok.";
    return filters.map((f) => `${f.action === "show" ? "GÖSTER" : "GİZLE"} — ${f.app}`).join("\n");
}

export function dndSet(minutes: number): string {
    const endsAt = Date.now() + minutes * 60 * 1000;
    save(DND_PATH, {active: true, endsAt});
    return `Rahatsız Etme modu ${minutes} dakika aktif. Sona erme: ${new Date(endsAt).toLocaleTimeString("tr-TR")}.`;
}

export function dndOff(): string {
    save(DND_PATH, {active: false, endsAt: null});
    return "Rahatsız Etme modu kapatıldı.";
}

export function getDndState(): DndState {
    return load<DndState>(DND_PATH, {active: false, endsAt: null});
}

export function getNotifHistory(count: number): string {
    const records: NotifRecord[] = load(HISTORY_PATH, []);
    const n = Math.min(count || 20, records.length);
    if (n === 0) return "Kayıtlı bildirim geçmişi yok.";
    return records.slice(0, n).map((r) => `[${r.time}] ${r.app}: ${r.title}`).join("\n");
}

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface Automation {
    id: string;
    condition: string;   // "cpu > 90" | "hour == 23" | "ram > 80"
    action: string;      // natural-language command sent to AEGIS
    createdAt: string;
    enabled: boolean;
    lastTriggered?: string;
}

const PATH = path.join(os.homedir(), ".aegis", "automations.json");

function ensureDir(): void {
    fs.mkdirSync(path.dirname(PATH), {recursive: true});
}

export function loadAutomations(): Automation[] {
    try { return JSON.parse(fs.readFileSync(PATH, "utf-8")); } catch { return []; }
}

function saveAutomations(list: Automation[]): void {
    ensureDir();
    fs.writeFileSync(PATH, JSON.stringify(list, null, 2), "utf-8");
}

export function addAutomation(condition: string, action: string): string {
    if (!parseCondition(condition)) {
        return `HATA: Geçersiz koşul formatı. Örnekler:\n  "cpu > 80"\n  "ram > 75"\n  "hour == 23"\n  "gpu > 90"`;
    }
    const auto: Automation = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        condition,
        action,
        createdAt: new Date().toISOString(),
        enabled: true,
    };
    const list = loadAutomations();
    list.push(auto);
    saveAutomations(list);
    return `Otomasyon oluşturuldu (ID: ${auto.id}):\n  Koşul: ${condition}\n  Eylem: ${action}`;
}

export function listAutomations(): string {
    const list = loadAutomations();
    if (list.length === 0) return "Tanımlı otomasyon yok.";
    return list.map((a) =>
        `[${a.enabled ? "✓" : "✗"}] ${a.id}: EĞer ${a.condition} → ${a.action}` +
        (a.lastTriggered ? `\n  Son tetiklenme: ${new Date(a.lastTriggered).toLocaleString("tr-TR")}` : ""),
    ).join("\n\n");
}

export function removeAutomation(idOrCondition: string): string {
    const list = loadAutomations();
    const idx = list.findIndex(
        (a) => a.id === idOrCondition || a.condition.toLowerCase().includes(idOrCondition.toLowerCase()),
    );
    if (idx === -1) return `"${idOrCondition}" ID/koşulda otomasyon bulunamadı.`;
    const removed = list.splice(idx, 1)[0];
    saveAutomations(list);
    return `Otomasyon silindi: ${removed.condition} → ${removed.action}`;
}

export function toggleAutomation(idOrCondition: string): string {
    const list = loadAutomations();
    const auto = list.find(
        (a) => a.id === idOrCondition || a.condition.toLowerCase().includes(idOrCondition.toLowerCase()),
    );
    if (!auto) return `"${idOrCondition}" ID/koşulda otomasyon bulunamadı.`;
    auto.enabled = !auto.enabled;
    saveAutomations(list);
    return `Otomasyon ${auto.enabled ? "etkinleştirildi" : "devre dışı"}: ${auto.condition}`;
}

// ---- Condition evaluation ----

interface Condition {
    metric: string;
    op: ">" | "<" | ">=" | "<=" | "==" | "!=";
    value: number;
}

function parseCondition(cond: string): Condition | null {
    const m = cond.trim().match(/^(\w+)\s*(>=|<=|==|!=|>|<)\s*(\d+(?:\.\d+)?)$/);
    if (!m) return null;
    return {metric: m[1].toLowerCase(), op: m[2] as Condition["op"], value: parseFloat(m[3])};
}

function evaluate(cond: Condition, metrics: Record<string, number>): boolean {
    const val = metrics[cond.metric];
    if (val === undefined) return false;
    switch (cond.op) {
        case ">":  return val > cond.value;
        case "<":  return val < cond.value;
        case ">=": return val >= cond.value;
        case "<=": return val <= cond.value;
        case "==": return val === cond.value;
        case "!=": return val !== cond.value;
    }
}

const _cooldowns = new Map<string, number>(); // id → last triggered ms

export function checkAutomations(
    metrics: Record<string, number>,
    onTrigger: (action: string) => void,
): void {
    const list = loadAutomations();
    let changed = false;
    const now = Date.now();

    for (const auto of list) {
        if (!auto.enabled) continue;
        const cond = parseCondition(auto.condition);
        if (!cond || !evaluate(cond, metrics)) continue;
        const last = _cooldowns.get(auto.id) ?? 0;
        if (now - last < 120_000) continue; // 2 dakika cooldown
        _cooldowns.set(auto.id, now);
        auto.lastTriggered = new Date().toISOString();
        changed = true;
        onTrigger(auto.action);
    }

    if (changed) saveAutomations(list);
}

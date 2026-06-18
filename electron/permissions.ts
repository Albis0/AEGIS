/**
 * Faz 54 — Yıkıcı Eylem İzin Kapısı
 *
 * `run_command` / `delete_file` / `kill_heavy_process` gibi tool'lar şu ana kadar
 * SINIRSIZdı: model tek yanlış argümanla geri dönülmez hasar verebilirdi. Güven =
 * geri alınamaz eylemde durup sorma. Bu modül her tool'u bir RİSK SEVİYESİNE atar
 * ve "her zaman izin ver" kararlarını `~/.aegis/permissions.json`'da kalıcı tutar.
 *
 * Bu modül SAF: sınıflandırma + store. Gerçek onay diyaloğu main.ts'te (UI katmanı).
 * Salt-okuma tool'lar HİÇ sormaz — yalnızca yıkıcı/yüksek-riskli olanlar kapıdan geçer.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export type RiskTier = "safe" | "destructive";

const STORE_PATH = path.join(os.homedir(), ".aegis", "permissions.json");

/**
 * Her zaman yıkıcı sayılan tool'lar (argümandan bağımsız). Geri alınamaz veya
 * sistem/dosya bütünlüğünü etkileyen eylemler.
 */
const ALWAYS_DESTRUCTIVE = new Set<string>([
    "delete_file",
    "move_file",
    "kill_heavy_process",
    "organize_folder",   // dosyaları toplu taşır
    "bulk_rename",       // toplu yeniden adlandırma
    "clear_old_data",    // veri siler
    "format_code",       // dosyaları yerinde değiştirir
]);

/**
 * `run_command` argümanı tehlikeliyse yıkıcı sayılır. Bu desenler SYSTEM_DESTROY'dan
 * (tools.ts — tamamen engellenenler) daha geniştir: bunlar engellenmez, ONAY ister.
 */
const COMMAND_DESTRUCTIVE_PATTERNS: RegExp[] = [
    /\bRemove-Item\b/i,
    /\brm\s+-[rf]/i,
    /\bdel\s+\/[sf]/i,
    /\brmdir\b/i,
    /\bStop-Process\b/i,
    /\btaskkill\b/i,
    /\bStop-Service\b/i,
    /\bSet-ItemProperty\b.*HK(LM|CU)/i,  // registry yazımı
    /\breg\s+(add|delete)\b/i,
    /\bShutdown\b/i,
    /\bRestart-Computer\b/i,
    /\b(Format|mkfs)\b/i,
    /\bUninstall-/i,
    /\b>\s*[A-Za-z]:\\/,                  // dosyaya yönlendirme (üzerine yazma)
];

/**
 * Bir tool çağrısının risk seviyesini döndürür. `run_command` için argümana bakar;
 * diğerleri için sabit listeye bakar; geri kalan her şey "safe" (kapı sormaz).
 */
export function classifyRisk(tool: string, args: Record<string, unknown>): RiskTier {
    if (ALWAYS_DESTRUCTIVE.has(tool)) return "destructive";
    if (tool === "run_command") {
        const cmd = String(args.command ?? "");
        if (COMMAND_DESTRUCTIVE_PATTERNS.some((p) => p.test(cmd))) return "destructive";
    }
    return "safe";
}

// ── Kalıcı "her zaman izin ver" store ────────────────────────────────────────

interface PermStore {
    /** "her zaman izin ver" denmiş tool adları. */
    alwaysAllow: string[];
}

let _cache: PermStore | null = null;

function load(): PermStore {
    if (_cache) return _cache;
    try {
        const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
        _cache = {alwaysAllow: Array.isArray(raw.alwaysAllow) ? raw.alwaysAllow : []};
    } catch {
        _cache = {alwaysAllow: []};
    }
    return _cache;
}

function save(s: PermStore): void {
    _cache = s;
    try {
        fs.mkdirSync(path.dirname(STORE_PATH), {recursive: true});
        fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2), "utf-8");
    } catch (e) {
        console.error("[permissions] kaydedilemedi:", (e as Error).message);
    }
}

/** Bu tool için kullanıcı daha önce "her zaman izin ver" demiş mi? */
export function isAlwaysAllowed(tool: string): boolean {
    return load().alwaysAllow.includes(tool);
}

/** Bu tool'u kalıcı izinli yap (bir daha sorulmaz). */
export function grantAlways(tool: string): void {
    const s = load();
    if (!s.alwaysAllow.includes(tool)) {
        save({alwaysAllow: [...s.alwaysAllow, tool]});
    }
}

/** Kalıcı izni geri al. */
export function revokeAlways(tool: string): void {
    const s = load();
    save({alwaysAllow: s.alwaysAllow.filter((t) => t !== tool)});
}

/** Test için: in-memory cache'i sıfırla (diskten yeniden okutur). */
export function _resetCache(): void { _cache = null; }

/**
 * Kapı kararı: bu çağrı onay GEREKTİRİYOR mu?
 * Yıkıcı + henüz kalıcı izin yok → true (UI onay sormalı). Aksi halde false.
 */
export function needsApproval(tool: string, args: Record<string, unknown>): boolean {
    if (classifyRisk(tool, args) !== "destructive") return false;
    return !isAlwaysAllowed(tool);
}

/**
 * Faz 17 — Güvenlik & Gizlilik
 *
 * 17.1 Windows Credential Manager (DPAPI) ile API key vault
 *      → safeStorage (Electron) kullanılır — AES-256 ile şifreli, OS kullanıcısına bağlı
 *
 * 17.2 Privacy audit: hangi veriler nerede saklanıyor
 *
 * 17.3 Otomatik silme: X günden eski konuşmaları temizle
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const BASE = path.join(os.homedir(), ".aegis");
const VAULT_PATH = path.join(BASE, "vault.enc.json");

// ---- 17.1 Güvenli Depo (safeStorage wrapper) ----
// safeStorage Electron main process'te kullanılabilir.
// Bu modül main.ts'ten import edilir, Electron ortamında çalışır.

let _safeStorage: {isEncryptionAvailable(): boolean; encryptString(s: string): Buffer; decryptString(b: Buffer): string} | null = null;

export function initVault(safeStorage: typeof _safeStorage): void {
    _safeStorage = safeStorage;
}

interface VaultData {
    [key: string]: string; // key → encrypted hex
}

function loadVault(): VaultData {
    try { return JSON.parse(fs.readFileSync(VAULT_PATH, "utf-8")); } catch { return {}; }
}

function saveVaultData(data: VaultData): void {
    fs.mkdirSync(BASE, {recursive: true});
    fs.writeFileSync(VAULT_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function vaultStore(key: string, value: string): string {
    if (!_safeStorage?.isEncryptionAvailable()) {
        return "HATA: Şifreli depo bu sistemde kullanılamıyor. Electron safeStorage gerekli.";
    }
    const encrypted = _safeStorage.encryptString(value);
    const data = loadVault();
    data[key] = encrypted.toString("hex");
    saveVaultData(data);
    return `"${key}" güvenli depoya kaydedildi.`;
}

export function vaultGet(key: string): string | null {
    if (!_safeStorage?.isEncryptionAvailable()) return null;
    const data = loadVault();
    if (!data[key]) return null;
    try {
        return _safeStorage.decryptString(Buffer.from(data[key], "hex"));
    } catch { return null; }
}

export function vaultList(): string {
    const data = loadVault();
    const keys = Object.keys(data);
    if (keys.length === 0) return "Güvenli depoda kayıtlı anahtar yok.";
    return `Güvenli depodaki anahtarlar:\n${keys.map((k) => `• ${k}`).join("\n")}`;
}

export function vaultDelete(key: string): string {
    const data = loadVault();
    if (!data[key]) return `"${key}" güvenli depoda bulunamadı.`;
    delete data[key];
    saveVaultData(data);
    return `"${key}" güvenli depodan silindi.`;
}

// ---- 17.2 Privacy Audit ----

export function privacyAudit(): string {
    const checks: {label: string; path: string}[] = [
        {label: "Ayarlar (API key'ler dahil)", path: path.join(BASE, "settings.json")},
        {label: "Config (Groq/Supabase key'leri)", path: path.join(BASE, "config.json")},
        {label: "Konuşma notu / Supabase URL", path: path.join(BASE, "config.json")},
        {label: "Kullanıcı profili", path: path.join(BASE, "profile.json")},
        {label: "Notlar (Supabase'de)", path: "(Supabase DB)"},
        {label: "Zamanlanmış görevler", path: path.join(BASE, "scheduled-tasks.json")},
        {label: "Makrolar", path: path.join(BASE, "macros.json")},
        {label: "Otomasyonlar", path: path.join(BASE, "automations.json")},
        {label: "Kalıcı gerçekler", path: path.join(BASE, "facts.json")},
        {label: "Bilgi tabanı index", path: path.join(BASE, "index/")},
        {label: "Güvenli vault", path: VAULT_PATH},
        {label: "API token", path: path.join(BASE, "api-token.txt")},
        {label: "Alışkanlık verisi", path: path.join(BASE, "habits.json")},
    ];

    const lines = checks.map((c) => {
        let exists = false;
        try {
            exists = fs.existsSync(c.path);
        } catch {}
        return `${exists ? "✓" : "○"} ${c.label}\n  → ${c.path}`;
    });

    return `GİZLİLİK DENETİMİ — AEGIS veri konumları:\n\n${lines.join("\n\n")}`;
}

// ---- 17.3 Otomatik Silme ----

export function clearOldData(olderThanDays: number): string {
    const results: string[] = [];
    const cutoff = Date.now() - olderThanDays * 86_400_000;

    // Bilgi tabanı — eski chunk'ları temizle
    const indexDir = path.join(BASE, "index");
    if (fs.existsSync(indexDir)) {
        let removed = 0;
        for (const f of fs.readdirSync(indexDir)) {
            const fp = path.join(indexDir, f);
            try {
                const stat = fs.statSync(fp);
                if (stat.mtimeMs < cutoff && f.endsWith(".json") && f !== "_meta.json") {
                    fs.unlinkSync(fp);
                    removed++;
                }
            } catch {}
        }
        if (removed > 0) results.push(`Bilgi tabanı: ${removed} eski chunk silindi.`);
    }

    // Zamanlanmış görevler — devre dışı + eski
    const tasksPath = path.join(BASE, "scheduled-tasks.json");
    if (fs.existsSync(tasksPath)) {
        try {
            const tasks = JSON.parse(fs.readFileSync(tasksPath, "utf-8")) as {enabled: boolean; createdAt: string}[];
            const before = tasks.length;
            const kept = tasks.filter((t) => t.enabled || new Date(t.createdAt).getTime() > cutoff);
            if (kept.length < before) {
                fs.writeFileSync(tasksPath, JSON.stringify(kept, null, 2), "utf-8");
                results.push(`Zamanlanmış görevler: ${before - kept.length} eski devre dışı görev silindi.`);
            }
        } catch {}
    }

    if (results.length === 0) return `${olderThanDays} günden eski silinecek veri bulunamadı.`;
    return results.join("\n");
}

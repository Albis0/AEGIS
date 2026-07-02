/**
 * Phase 17 — Security & Privacy
 *
 * 17.1 API key vault via Windows Credential Manager (DPAPI)
 *      → uses safeStorage (Electron) — AES-256 encrypted, bound to the OS user
 *
 * 17.2 Privacy audit: which data is stored where
 *
 * 17.3 Automatic deletion: clear conversations older than X days
 */

import {writeJsonAtomic} from "./json-store";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const BASE = path.join(os.homedir(), ".aegis");
const VAULT_PATH = path.join(BASE, "vault.enc.json");

// ---- 17.1 Secure Vault (safeStorage wrapper) ----
// safeStorage is available in the Electron main process.
// This module is imported from main.ts and runs in the Electron environment.

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
    writeJsonAtomic(VAULT_PATH, data);
}

export function vaultStore(key: string, value: string): string {
    if (!_safeStorage?.isEncryptionAvailable()) {
        return "ERROR: Encrypted vault is not available on this system. Electron safeStorage is required.";
    }
    const encrypted = _safeStorage.encryptString(value);
    const data = loadVault();
    data[key] = encrypted.toString("hex");
    saveVaultData(data);
    return `"${key}" saved to the secure vault.`;
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
    if (keys.length === 0) return "No keys stored in the secure vault.";
    return `Keys in the secure vault:\n${keys.map((k) => `• ${k}`).join("\n")}`;
}

export function vaultDelete(key: string): string {
    const data = loadVault();
    if (!data[key]) return `"${key}" not found in the secure vault.`;
    delete data[key];
    saveVaultData(data);
    return `"${key}" deleted from the secure vault.`;
}

// ---- 17.2 Privacy Audit ----

export function privacyAudit(): string {
    const checks: {label: string; path: string}[] = [
        {label: "Settings (including API keys)", path: path.join(BASE, "settings.json")},
        {label: "Config (Groq/Supabase keys)", path: path.join(BASE, "config.json")},
        {label: "Conversation note / Supabase URL", path: path.join(BASE, "config.json")},
        {label: "User profile", path: path.join(BASE, "profile.json")},
        {label: "Notes (in Supabase)", path: "(Supabase DB)"},
        {label: "Scheduled tasks", path: path.join(BASE, "scheduled-tasks.json")},
        {label: "Macros", path: path.join(BASE, "macros.json")},
        {label: "Automations", path: path.join(BASE, "automations.json")},
        {label: "Persistent facts", path: path.join(BASE, "facts.json")},
        {label: "Knowledge base index", path: path.join(BASE, "index/")},
        {label: "Secure vault", path: VAULT_PATH},
        {label: "API token", path: path.join(BASE, "api-token.txt")},
        {label: "Habit data", path: path.join(BASE, "habits.json")},
    ];

    const lines = checks.map((c) => {
        let exists = false;
        try {
            exists = fs.existsSync(c.path);
        } catch {}
        return `${exists ? "✓" : "○"} ${c.label}\n  → ${c.path}`;
    });

    return `PRIVACY AUDIT — AEGIS data locations:\n\n${lines.join("\n\n")}`;
}

// ---- 17.3 Automatic Deletion ----

export function clearOldData(olderThanDays: number): string {
    const results: string[] = [];
    const cutoff = Date.now() - olderThanDays * 86_400_000;

    // Knowledge base — clear old chunks
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
        if (removed > 0) results.push(`Knowledge base: ${removed} old chunks deleted.`);
    }

    // Scheduled tasks — disabled + old
    const tasksPath = path.join(BASE, "scheduled-tasks.json");
    if (fs.existsSync(tasksPath)) {
        try {
            const tasks = JSON.parse(fs.readFileSync(tasksPath, "utf-8")) as {enabled: boolean; createdAt: string}[];
            const before = tasks.length;
            const kept = tasks.filter((t) => t.enabled || new Date(t.createdAt).getTime() > cutoff);
            if (kept.length < before) {
                fs.writeFileSync(tasksPath, JSON.stringify(kept, null, 2), "utf-8");
                results.push(`Scheduled tasks: ${before - kept.length} old disabled tasks deleted.`);
            }
        } catch {}
    }

    if (results.length === 0) return `No data older than ${olderThanDays} days found to delete.`;
    return results.join("\n");
}

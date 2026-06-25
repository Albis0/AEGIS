// AEGIS — Cloud Sync (Phase 30.7)
//
// Writes the signed-in user's settings + (encrypted) API keys to the Supabase
// user_configs table and syncs them across devices.
//
// Encryption: API keys are encrypted client-side with AES-256-GCM. The key is
// derived via scrypt from the user's Supabase user.id + an application constant.
// The server only ever sees the encrypted blob — the plaintext key never leaves
// for the cloud.
//
// NOTE: This is weaker than password-based encryption (user.id is not a secret),
// but RLS already protects the row; this layer provides the guarantee that "even
// if a database dump leaks, the keys are not in plaintext". Full password
// derivation can be added later.

import * as crypto from "crypto";
import {getAuthClient, getCurrentUser} from "./auth";
import {loadSettings, saveSettings, type AppSettings} from "./settings";

// Application constant — used as salt in key derivation (public-safe, protected by RLS).
const APP_PEPPER = "aegis-v1-sync-pepper-7f3a";

function deriveKey(userId: string): Buffer {
    return crypto.scryptSync(userId + APP_PEPPER, "aegis-sync-salt", 32);
}

function encrypt(plain: string, userId: string): string {
    const key = deriveKey(userId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // iv:tag:ciphertext (all base64)
    return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

function decrypt(blob: string, userId: string): string | null {
    try {
        const [ivB64, tagB64, dataB64] = blob.split(":");
        const key = deriveKey(userId);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
        decipher.setAuthTag(Buffer.from(tagB64, "base64"));
        return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf-8");
    } catch {
        return null;
    }
}

// Synced setting fields (non-sensitive preferences). providerKeys are sent
// separately (encrypted); aiApiKey is also kept separate since it is sensitive.
const SYNCED_SETTING_KEYS: (keyof AppSettings)[] = [
    "model", "ttsVoice", "ttsRate", "accentColor", "ttsProvider", "aiProvider",
    "ollamaUrl", "ollamaNumCtx", "skin", "font", "layout", "customCss", "language",
    "telemetryWidgets", "telemetryUpdateMs", "temperature", "maxTokens", "topP",
    "presencePenalty", "frequencyPenalty", "mistralSafeMode", "tempUnit", "aiMode",
];

function pickSyncedSettings(s: AppSettings): Partial<AppSettings> {
    const out: Record<string, unknown> = {};
    for (const k of SYNCED_SETTING_KEYS) out[k] = s[k];
    return out as Partial<AppSettings>;
}

// "Sync this device" preference — stored in settings.json (not itself synced).
function syncEnabled(): boolean {
    const s = loadSettings() as AppSettings & {cloudSync?: boolean};
    return s.cloudSync !== false; // on by default (if signed in)
}

// Tracks the timestamp of this device's last successful push, so a later pull
// racing against an in-flight push doesn't overwrite a newer local edit with a
// stale cloud row (see the updated_at check in pullFromCloud).
let _lastLocalPushAt: number | null = null;

// Write local settings + keys to the cloud (called debounced).
export async function pushToCloud(): Promise<{ok: boolean; error?: string}> {
    if (!syncEnabled()) return {ok: false, error: "sync disabled"};
    const user = await getCurrentUser();
    if (!user) return {ok: false, error: "not signed in"};

    const s = loadSettings();
    const settingsJson = pickSyncedSettings(s);
    const keysPlain = JSON.stringify({providerKeys: s.providerKeys ?? {}, aiApiKey: s.aiApiKey ?? ""});
    const encrypted = encrypt(keysPlain, user.userId);
    const now = new Date().toISOString();

    const {error} = await getAuthClient()
        .from("user_configs")
        .upsert({
            user_id: user.userId,
            settings: settingsJson,
            encrypted_keys: encrypted,
            updated_at: now,
        });
    if (error) return {ok: false, error: error.message};
    _lastLocalPushAt = new Date(now).getTime();
    return {ok: true};
}

// Pull from the cloud, merge with local (updated_at drives last-writer-wins).
// Called at startup. Return value: true if a change was applied.
export async function pullFromCloud(): Promise<{ok: boolean; applied: boolean; error?: string}> {
    if (!syncEnabled()) return {ok: false, applied: false, error: "sync disabled"};
    const user = await getCurrentUser();
    if (!user) return {ok: false, applied: false, error: "not signed in"};

    const {data, error} = await getAuthClient()
        .from("user_configs")
        .select("settings, encrypted_keys, updated_at")
        .eq("user_id", user.userId)
        .maybeSingle();

    if (error) return {ok: false, applied: false, error: error.message};
    if (!data) return {ok: true, applied: false}; // no record in the cloud (first time)

    const local = loadSettings();
    // Last-writer-wins by updated_at: if THIS device pushed more recently than the
    // cloud row says, the local edit is newer (still in flight to the server) and
    // must not be clobbered by a pull that raced ahead of it.
    if (_lastLocalPushAt && data.updated_at && new Date(data.updated_at).getTime() < _lastLocalPushAt) {
        return {ok: true, applied: false};
    }
    // Check that data.settings is safe — don't let corrupt cloud data overwrite local
    let cloudSettings: Partial<AppSettings> = {};
    if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) {
        cloudSettings = data.settings as Partial<AppSettings>;
    }
    const merged: AppSettings = {...local, ...cloudSettings};

    // Decrypt and merge the encrypted keys
    if (data.encrypted_keys) {
        const dec = decrypt(data.encrypted_keys, user.userId);
        if (dec) {
            try {
                const {providerKeys, aiApiKey} = JSON.parse(dec);
                if (providerKeys && typeof providerKeys === 'object') merged.providerKeys = {...(local.providerKeys ?? {}), ...providerKeys};
                if (aiApiKey && typeof aiApiKey === 'string') merged.aiApiKey = aiApiKey;
            } catch { /* corrupt blob — ignore */ }
        }
    }

    saveSettings(merged);
    return {ok: true, applied: true};
}

// AEGIS — Cloud Sync (Faz 30.7)
//
// Giriş yapan kullanıcının ayarlarını + (şifreli) API anahtarlarını Supabase
// user_configs tablosuna yazar ve cihazlar arası senkronlar.
//
// Şifreleme: API key'ler istemci tarafında AES-256-GCM ile şifrelenir. Anahtar,
// kullanıcının Supabase user.id'sinden + uygulama sabitinden scrypt ile türetilir.
// Sunucu yalnızca şifreli blob görür — düz key asla buluta gitmez.
//
// NOT: Bu, parola-tabanlı şifrelemeden zayıftır (user.id sır değil), ama RLS
// zaten satırı korur; bu katman "veritabanı dökümü sızsa bile key'ler düz değil"
// güvencesi verir. Tam parola-türetme ileride eklenebilir.

import * as crypto from "crypto";
import {getAuthClient, getCurrentUser} from "./auth";
import {loadSettings, saveSettings, type AppSettings} from "./settings";

// Uygulama sabiti — anahtar türetmede tuz olarak kullanılır (public-safe, RLS korur).
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
    // iv:tag:ciphertext (hepsi base64)
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

// Senkronlanan ayar alanları (hassas olmayan tercihler). providerKeys ayrı
// (şifreli) gider; aiApiKey de hassas olduğu için ayrı tutulur.
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

// "Bu cihazı senkronla" tercihi — settings.json'da tutulur (sync edilmez).
function syncEnabled(): boolean {
    const s = loadSettings() as AppSettings & {cloudSync?: boolean};
    return s.cloudSync !== false; // default açık (giriş varsa)
}

// Yerel ayar + key'leri buluta yaz (debounce'lu çağrılır).
export async function pushToCloud(): Promise<{ok: boolean; error?: string}> {
    if (!syncEnabled()) return {ok: false, error: "sync kapalı"};
    const user = await getCurrentUser();
    if (!user) return {ok: false, error: "giriş yok"};

    const s = loadSettings();
    const settingsJson = pickSyncedSettings(s);
    const keysPlain = JSON.stringify({providerKeys: s.providerKeys ?? {}, aiApiKey: s.aiApiKey ?? ""});
    const encrypted = encrypt(keysPlain, user.userId);

    const {error} = await getAuthClient()
        .from("user_configs")
        .upsert({
            user_id: user.userId,
            settings: settingsJson,
            encrypted_keys: encrypted,
            updated_at: new Date().toISOString(),
        });
    return error ? {ok: false, error: error.message} : {ok: true};
}

// Buluttan çek, yerelle birleştir (en yeni kazanır mantığı için updated_at).
// Açılışta çağrılır. Dönen değer: değişiklik yapıldıysa true.
export async function pullFromCloud(): Promise<{ok: boolean; applied: boolean; error?: string}> {
    if (!syncEnabled()) return {ok: false, applied: false, error: "sync kapalı"};
    const user = await getCurrentUser();
    if (!user) return {ok: false, applied: false, error: "giriş yok"};

    const {data, error} = await getAuthClient()
        .from("user_configs")
        .select("settings, encrypted_keys, updated_at")
        .eq("user_id", user.userId)
        .maybeSingle();

    if (error) return {ok: false, applied: false, error: error.message};
    if (!data) return {ok: true, applied: false}; // bulutta kayıt yok (ilk kez)

    const local = loadSettings();
    // data.settings güvenli mi kontrol et — bozuk cloud verisi local'i ezmesin
    let cloudSettings: Partial<AppSettings> = {};
    if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) {
        cloudSettings = data.settings as Partial<AppSettings>;
    }
    const merged: AppSettings = {...local, ...cloudSettings};

    // Şifreli key'leri çöz ve birleştir
    if (data.encrypted_keys) {
        const dec = decrypt(data.encrypted_keys, user.userId);
        if (dec) {
            try {
                const {providerKeys, aiApiKey} = JSON.parse(dec);
                if (providerKeys && typeof providerKeys === 'object') merged.providerKeys = {...(local.providerKeys ?? {}), ...providerKeys};
                if (aiApiKey && typeof aiApiKey === 'string') merged.aiApiKey = aiApiKey;
            } catch { /* bozuk blob — yoksay */ }
        }
    }

    saveSettings(merged);
    return {ok: true, applied: true};
}

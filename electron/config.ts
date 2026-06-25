import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {reportCorruptedFile} from "./corrupted-file-tracker";
import {encryptValue, decryptValue} from "./secret-storage";

export interface AegisConfig {
    groqApiKey: string;
    supabaseUrl: string;
    supabaseServiceKey: string;
    tavilyApiKey?: string;
    serperApiKey?: string;
    elevenlabsApiKey?: string;
    steamApiKey?: string;
    steamId64?: string;
    homeAssistantUrl?: string;    // Phase 62 — smart home: http://homeassistant.local:8123
    homeAssistantToken?: string;  // long-lived access token
}

const CONFIG_PATH = path.join(os.homedir(), ".aegis", "config.json");

function ensureDir(): void {
    fs.mkdirSync(path.dirname(CONFIG_PATH), {recursive: true});
}

const SECRET_FIELDS: (keyof AegisConfig)[] = [
    "groqApiKey", "supabaseServiceKey", "tavilyApiKey", "serperApiKey",
    "elevenlabsApiKey", "steamApiKey", "homeAssistantToken",
];

export function loadConfig(): AegisConfig | null {
    let raw: string;
    try {
        raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    } catch {
        return null; // file doesn't exist — first run, not corruption
    }
    let parsed: AegisConfig;
    try {
        parsed = JSON.parse(raw) as AegisConfig;
    } catch {
        reportCorruptedFile("API keys (config.json)");
        try {
            fs.copyFileSync(CONFIG_PATH, CONFIG_PATH + ".bak");
        } catch { /* best-effort backup */ }
        return null;
    }
    for (const f of SECRET_FIELDS) {
        const v = parsed[f] as string | undefined;
        if (v !== undefined) (parsed as unknown as Record<string, unknown>)[f] = decryptValue(v);
    }
    return parsed;
}

export function loadConfigStrict(): AegisConfig | null {
    const c = loadConfig();
    if (!c?.groqApiKey || !c.supabaseUrl || !c.supabaseServiceKey) return null;
    return c;
}

export function saveConfig(config: AegisConfig): void {
    ensureDir();
    const out: AegisConfig = {...config};
    for (const f of SECRET_FIELDS) {
        const v = out[f] as string | undefined;
        if (v !== undefined) (out as unknown as Record<string, unknown>)[f] = encryptValue(v);
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(out, null, 2), "utf-8");
}

export function applyConfig(config: AegisConfig): void {
    if (config.groqApiKey) process.env.GROQ_API_KEY = config.groqApiKey;
    if (config.supabaseUrl) process.env.SUPABASE_URL = config.supabaseUrl;
    if (config.supabaseServiceKey) process.env.SUPABASE_SERVICE_KEY = config.supabaseServiceKey;
    if (config.tavilyApiKey) process.env.TAVILY_API_KEY = config.tavilyApiKey;
    if (config.serperApiKey) process.env.SERPER_API_KEY = config.serperApiKey;
    if (config.elevenlabsApiKey) process.env.ELEVENLABS_API_KEY = config.elevenlabsApiKey;
    if (config.steamApiKey) process.env.STEAM_API_KEY = config.steamApiKey;
    if (config.steamId64) process.env.STEAM_ID64 = config.steamId64;
    if (config.homeAssistantUrl) process.env.HOME_ASSISTANT_URL = config.homeAssistantUrl;
    if (config.homeAssistantToken) process.env.HOME_ASSISTANT_TOKEN = config.homeAssistantToken;
}

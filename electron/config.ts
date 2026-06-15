import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface AegisConfig {
    groqApiKey: string;
    supabaseUrl: string;
    supabaseServiceKey: string;
    tavilyApiKey?: string;
    serperApiKey?: string;
    elevenlabsApiKey?: string;
    steamApiKey?: string;
    steamId64?: string;
}

const CONFIG_PATH = path.join(os.homedir(), ".aegis", "config.json");

function ensureDir(): void {
    fs.mkdirSync(path.dirname(CONFIG_PATH), {recursive: true});
}

export function loadConfig(): AegisConfig | null {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
        return JSON.parse(raw) as AegisConfig;
    } catch {
        return null;
    }
}

export function loadConfigStrict(): AegisConfig | null {
    const c = loadConfig();
    if (!c?.groqApiKey || !c.supabaseUrl || !c.supabaseServiceKey) return null;
    return c;
}

export function saveConfig(config: AegisConfig): void {
    ensureDir();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
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
}

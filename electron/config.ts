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
}

const CONFIG_PATH = path.join(os.homedir(), ".aegis", "config.json");

function ensureDir(): void {
    fs.mkdirSync(path.dirname(CONFIG_PATH), {recursive: true});
}

export function loadConfig(): AegisConfig | null {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
        const c = JSON.parse(raw) as AegisConfig;
        if (!c.groqApiKey || !c.supabaseUrl || !c.supabaseServiceKey) return null;
        return c;
    } catch {
        return null;
    }
}

export function saveConfig(config: AegisConfig): void {
    ensureDir();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export function applyConfig(config: AegisConfig): void {
    process.env.GROQ_API_KEY = config.groqApiKey;
    process.env.SUPABASE_URL = config.supabaseUrl;
    process.env.SUPABASE_SERVICE_KEY = config.supabaseServiceKey;
    if (config.tavilyApiKey) process.env.TAVILY_API_KEY = config.tavilyApiKey;
    if (config.serperApiKey) process.env.SERPER_API_KEY = config.serperApiKey;
}

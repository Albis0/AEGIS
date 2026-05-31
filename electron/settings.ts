import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface AppSettings {
    model: string;
    ttsVoice: string;
    ttsRate: number; // 0.5 – 2.0
    accentColor: string; // CSS rgb triplet e.g. "34,211,238"
    ttsProvider: "edge" | "elevenlabs"; // TTS motoru
    aiProvider: "groq" | "openai" | "anthropic" | "mistral" | "ollama"; // LLM sağlayıcı
    aiApiKey: string; // groq dışındaki sağlayıcılar için key
    ollamaUrl: string; // Ollama base URL, örn. http://localhost:11434
    skin: "hologram" | "minimal" | "terminal" | "dashboard";
    font: "jetbrains" | "sharetech" | "orbitron" | "oxanium" | "syne" | "rajdhani" | "poppins" | "inter" | "spacegrotesk";
    layout: "normal" | "compact";
    customCss: string;
}

const DEFAULTS: AppSettings = {
    model: "qwen/qwen3-32b",
    ttsVoice: "tr-TR-EmelNeural",
    ttsRate: 1.0,
    accentColor: "34,211,238",
    ttsProvider: "edge",
    aiProvider: "groq",
    aiApiKey: "",
    ollamaUrl: "http://localhost:11434",
    skin: "hologram",
    font: "jetbrains",
    layout: "normal",
    customCss: "",
};

const SETTINGS_PATH = path.join(os.homedir(), ".aegis", "settings.json");

function ensureDir(): void {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), {recursive: true});
}

export function loadSettings(): AppSettings {
    try {
        const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
        return {...DEFAULTS, ...JSON.parse(raw)};
    } catch {
        return {...DEFAULTS};
    }
}

export function saveSettings(settings: AppSettings): void {
    ensureDir();
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

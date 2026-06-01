import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export type TelemetryWidget =
    | "cpu" | "ram" | "disk" | "battery" | "network"
    | "gpu" | "fans" | "processes" | "system" | "activeWindow";

export type AiProvider =
    | "groq" | "openai" | "anthropic" | "mistral"
    | "gemini" | "xai" | "deepseek" | "ollama";

export interface AppSettings {
    model: string;
    ttsVoice: string;
    ttsRate: number;
    accentColor: string;
    ttsProvider: "edge" | "elevenlabs";
    aiProvider: AiProvider;
    aiApiKey: string; // backward compat — prefer providerKeys
    providerKeys: Record<string, string>;
    ollamaUrl: string;
    ollamaNumCtx: number;
    skin: "hologram" | "minimal" | "terminal" | "dashboard";
    font: "jetbrains" | "sharetech" | "orbitron" | "oxanium" | "syne" | "rajdhani" | "poppins" | "inter" | "spacegrotesk";
    layout: "normal" | "compact";
    customCss: string;
    language: "tr" | "en" | "de" | "fr" | "es";
    telemetryWidgets: TelemetryWidget[];
    telemetryUpdateMs: number;
    // AI generation parameters
    temperature: number;
    maxTokens: number;
    topP: number;
    presencePenalty: number;
    frequencyPenalty: number;
    mistralSafeMode: boolean;
    autoLaunch: boolean;
    minimizeToTray: boolean;
}

const ALL_WIDGETS: TelemetryWidget[] = ["cpu", "ram", "disk", "battery", "network", "gpu", "fans", "processes", "system", "activeWindow"];

const DEFAULTS: AppSettings = {
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    ttsVoice: "tr-TR-EmelNeural",
    ttsRate: 1.0,
    accentColor: "34,211,238",
    ttsProvider: "edge",
    aiProvider: "groq",
    aiApiKey: "",
    providerKeys: {},
    ollamaUrl: "http://localhost:11434",
    ollamaNumCtx: 4096,
    skin: "hologram",
    font: "jetbrains",
    layout: "normal",
    customCss: "",
    language: "tr",
    telemetryWidgets: ALL_WIDGETS,
    telemetryUpdateMs: 1500,
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
    presencePenalty: 0,
    frequencyPenalty: 0,
    mistralSafeMode: false,
    autoLaunch: false,
    minimizeToTray: true,
};

const SETTINGS_PATH = path.join(os.homedir(), ".aegis", "settings.json");

function ensureDir(): void {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), {recursive: true});
}

export function loadSettings(): AppSettings {
    try {
        const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
        const saved = JSON.parse(raw) as Partial<AppSettings>;
        const merged: AppSettings = {...DEFAULTS, ...saved};
        // Migrate old aiApiKey to providerKeys
        if (saved.aiApiKey && !saved.providerKeys) {
            const p = merged.aiProvider;
            if (p && p !== "groq" && p !== "ollama") {
                merged.providerKeys = {...(merged.providerKeys ?? {}), [p]: saved.aiApiKey};
            }
        }
        return merged;
    } catch {
        return {...DEFAULTS};
    }
}

export function saveSettings(settings: AppSettings): void {
    ensureDir();
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

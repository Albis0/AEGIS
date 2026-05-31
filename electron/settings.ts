import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export type TelemetryWidget =
    | "cpu" | "ram" | "disk" | "battery" | "network"
    | "gpu" | "fans" | "processes" | "system" | "activeWindow";

export interface AppSettings {
    model: string;
    ttsVoice: string;
    ttsRate: number;
    accentColor: string;
    ttsProvider: "edge" | "elevenlabs";
    aiProvider: "groq" | "openai" | "anthropic" | "mistral" | "ollama";
    aiApiKey: string;
    ollamaUrl: string;
    skin: "hologram" | "minimal" | "terminal" | "dashboard";
    font: "jetbrains" | "sharetech" | "orbitron" | "oxanium" | "syne" | "rajdhani" | "poppins" | "inter" | "spacegrotesk";
    layout: "normal" | "compact";
    customCss: string;
    language: "tr" | "en" | "de" | "fr" | "es";
    telemetryWidgets: TelemetryWidget[];
    telemetryUpdateMs: number;
}

const ALL_WIDGETS: TelemetryWidget[] = ["cpu", "ram", "disk", "battery", "network", "gpu", "fans", "processes", "system", "activeWindow"];

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
    language: "tr",
    telemetryWidgets: ALL_WIDGETS,
    telemetryUpdateMs: 1500,
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

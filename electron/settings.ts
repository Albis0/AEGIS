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
    ttsProvider: "edge" | "elevenlabs" | "kokoro";
    // Phase 30 — distribution mode:
    //   "trial" = trial; chat goes through your proxy (rate limited). If the user
    //             enters their own Groq key, the proxy is bypassed and it goes straight to Groq.
    //   "own"   = advanced; the user's chosen provider + their own key (no proxy).
    aiMode: "trial" | "own";
    aiProvider: AiProvider;
    aiApiKey: string; // backward compat — prefer providerKeys
    providerKeys: Record<string, string>;
    ollamaUrl: string;
    ollamaNumCtx: number;
    skin: string; // skin id (registry.tsx): hologram/minimal/terminal/dashboard/nebula-*
    uiFamily: string; // color/background palette preset (themes.ts): cyber/synthwave/matrix/aurora/ember
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
    proactiveSuggestions: boolean;   // Phase 61 — opt-in proactive pattern suggestions (off by default)
    apiServerEnabled: boolean;
    alertCpuPct: number | null;
    alertRamPct: number | null;
    alertGpuPct: number | null;
    alertDiskPct: number | null;
    telemetryHistorySec: number;
    telemetryNotifyChannel: "feed" | "toast" | "both";
    tempUnit: "C" | "F";
    fullPcAccess: boolean;
    disabledTools: string[];
    // Developer setting — when on, the reference resolver's decision (intent/confidence/
    // memory/tool/args/resolution) is appended to the chat stream as an [EXPLANATION] block.
    explainMode: boolean;
    cloudSync: boolean; // "Sync this device" (Phase 30.7) — if signed in, settings/keys sync to the cloud
    weatherCity: string; // manual city name; if empty, falls back to IP geolocation
    reactorStyle: "rings" | "hexcore" | "pulsar" | "vortex" | "orb" | "plasma" | "helix" | "quantum";
}

const ALL_WIDGETS: TelemetryWidget[] = ["cpu", "ram", "disk", "battery", "network", "gpu", "fans", "processes", "system", "activeWindow"];

const DEFAULTS: AppSettings = {
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    ttsVoice: "tr-TR-EmelNeural",
    ttsRate: 1.0,
    accentColor: "34,211,238",
    ttsProvider: "edge",
    aiMode: "own", // don't break existing installs; new users choose in 30.4
    aiProvider: "groq",
    aiApiKey: "",
    providerKeys: {},
    ollamaUrl: "http://localhost:11434",
    ollamaNumCtx: 4096,
    skin: "hologram",
    uiFamily: "cyber",
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
    proactiveSuggestions: false,   // Phase 61 — OFF by default (opt-in)
    apiServerEnabled: false,
    alertCpuPct: null,
    alertRamPct: null,
    alertGpuPct: null,
    alertDiskPct: null,
    telemetryHistorySec: 60,
    telemetryNotifyChannel: "both",
    tempUnit: "C",
    fullPcAccess: false,
    disabledTools: [],
    explainMode: false,
    cloudSync: true,
    weatherCity: "",
    reactorStyle: "rings",
};

const SETTINGS_PATH = path.join(os.homedir(), ".aegis", "settings.json");

function ensureDir(): void {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), {recursive: true});
}

// Convert hex (#rrggbb) → "r,g,b" string — accentColor must always be in "r,g,b" format
function normalizeAccent(color: string | undefined): string {
    if (!color) return DEFAULTS.accentColor;
    const hex = color.trim();
    if (hex.startsWith("#")) {
        const h = hex.slice(1);
        const full = h.length === 3
            ? h.split("").map((c) => c + c).join("")
            : h;
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return `${r},${g},${b}`;
    }
    return color;
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
        // Normalize accentColor: hex → "r,g,b"
        merged.accentColor = normalizeAccent(merged.accentColor);
        return merged;
    } catch {
        return {...DEFAULTS};
    }
}

export function saveSettings(settings: AppSettings): void {
    ensureDir();
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

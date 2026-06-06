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
    // Faz 30 — dağıtım modu:
    //   "trial" = deneme; chat senin proxy'inden (rate limited). Kullanıcı kendi
    //             Groq key'ini girerse proxy bypass edilir, direkt Groq'a gider.
    //   "own"   = gelişmiş; kullanıcının seçtiği provider + kendi key'i (proxy yok).
    aiMode: "trial" | "own";
    aiProvider: AiProvider;
    aiApiKey: string; // backward compat — prefer providerKeys
    providerKeys: Record<string, string>;
    ollamaUrl: string;
    ollamaNumCtx: number;
    skin: string; // skin id (registry.tsx): hologram/minimal/terminal/dashboard/nebula-*
    uiFamily: string; // renk/zemin palet preset (themes.ts): cyber/synthwave/matrix/aurora/ember
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
    cloudSync: boolean; // "Bu cihazı senkronla" (Faz 30.7) — giriş varsa ayar/key bulut sync
    weatherCity: string; // manuel şehir adı; boşsa IP geolocation fallback
    reactorStyle: "rings" | "hexcore" | "pulsar" | "vortex";
}

const ALL_WIDGETS: TelemetryWidget[] = ["cpu", "ram", "disk", "battery", "network", "gpu", "fans", "processes", "system", "activeWindow"];

const DEFAULTS: AppSettings = {
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    ttsVoice: "tr-TR-EmelNeural",
    ttsRate: 1.0,
    accentColor: "34,211,238",
    ttsProvider: "edge",
    aiMode: "own", // mevcut kurulumlar bozulmasın; yeni kullanıcı 30.4'te seçer
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
    cloudSync: true,
    weatherCity: "",
    reactorStyle: "rings",
};

const SETTINGS_PATH = path.join(os.homedir(), ".aegis", "settings.json");

function ensureDir(): void {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), {recursive: true});
}

// Hex (#rrggbb) → "r,g,b" string dönüştür — accentColor her zaman "r,g,b" formatında olmalı
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

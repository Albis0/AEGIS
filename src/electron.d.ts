export interface GpuInfo {
    name: string;
    load: number;
    vramUsed: number;
    vramTotal: number;
    temp: number | null;
}

export interface ProcInfo {
    name: string;
    cpu: number;
    ram: number;
    pid: number;
}

export interface DiskInfo {
    drive: string;
    usedPct: number;
    usedGB: number;
    totalGB: number;
}

export interface NetInfo {
    name: string;
    up: number;
    down: number;
}

export interface Telemetry {
    // CPU
    cpu: number;
    cpuCores: number[];
    cpuModel: string;
    cpuTemp: number | null;
    cpuFreqMHz: number | null;
    cpuCoreCount: number;
    // RAM
    ram: number;
    ramUsedMB: number;
    ramTotalMB: number;
    ramFreeMB: number;
    // Disk
    disk: number;
    disks: DiskInfo[];
    // Battery
    battery: number | null;
    batteryCharging: boolean | null;
    // Network
    netUp: number;
    netDown: number;
    netAdapters: NetInfo[];
    // GPU
    gpu: GpuInfo[];
    // Fans
    fanSpeeds: number[];
    // Processes
    topProcs: ProcInfo[];
    // System
    uptime: number;
    host: string;
    platform: string;
    sysModel: string;
    sysBoard: string;
    activeWindow: string;
}

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
    aiMode: "trial" | "own";
    aiProvider: AiProvider;
    aiApiKey: string;
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
}

export interface AegisConfig {
    groqApiKey: string;
    supabaseUrl: string;
    supabaseServiceKey: string;
    tavilyApiKey?: string;
    serperApiKey?: string;
    elevenlabsApiKey?: string;
}

export interface Weather {
    city?: string;
    country?: string;
    temp?: number;
    feels?: number;
    humidity?: number;
    desc?: string;
    error?: string;
}

declare global {
    interface Window {
        jarvis: {
            sendChat: (messages: unknown[], reqId: string) => void;
            on: (channel: string, cb: (payload: any) => void) => () => void;
            weather: () => Promise<Weather>;
            transcribe: (audioBuffer: ArrayBuffer) => Promise<{text?: string; error?: string}>;
            tts: (text: string) => Promise<{buffer?: Buffer; error?: string}>;
            settingsGet: () => Promise<AppSettings>;
            settingsSet: (patch: Partial<AppSettings>) => Promise<AppSettings>;
            configGet: () => Promise<AegisConfig>;
            configSet: (patch: Partial<AegisConfig>) => Promise<void>;
            setupSave: (config: AegisConfig) => Promise<void>;
            authSignUp: (email: string, password: string) => Promise<{ok: boolean; error?: string; userId?: string; email?: string}>;
            authSignIn: (email: string, password: string) => Promise<{ok: boolean; error?: string; userId?: string; email?: string}>;
            authSignOut: () => Promise<void>;
            authCurrentUser: () => Promise<{userId: string; email?: string} | null>;
            screenshot: () => Promise<void>;
            sessionsList: () => Promise<{id: string; summary: string | null; ended_at: string | null; created_at: string}[]>;
            sessionMessages: (sessionId: string) => Promise<{role: string; content: string; tool_name: string | null; created_at: string}[]>;
            minimize: () => void;
            maximize: () => void;
            fullscreen: () => void;
            close: () => void;
            apiInfo: () => Promise<{ip: string; port: number; token: string; running: boolean}>;
            apiServerToggle: (enable: boolean) => Promise<string>;
        };
    }
}
export {};

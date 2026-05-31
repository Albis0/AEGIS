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
}

export interface Telemetry {
    cpu: number;
    ram: number;
    disk: number;
    battery: number | null;
    netUp: number;
    netDown: number;
    uptime: number;
    host: string;
    platform: string;
    gpu: GpuInfo[];
    cpuTemp: number | null;
    topProcs: ProcInfo[];
    activeWindow: string;
}

export interface AppSettings {
    model: string;
    ttsVoice: string;
    ttsRate: number;
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
            minimize: () => void;
            maximize: () => void;
            fullscreen: () => void;
            close: () => void;
        };
    }
}
export {};

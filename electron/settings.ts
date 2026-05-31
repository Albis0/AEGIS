import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface AppSettings {
    model: string;
    ttsVoice: string;
    ttsRate: number; // 0.5 – 2.0
    accentColor: string; // CSS rgb triplet e.g. "34,211,238"
}

const DEFAULTS: AppSettings = {
    model: "qwen/qwen3-32b",
    ttsVoice: "tr-TR-EmelNeural",
    ttsRate: 1.0,
    accentColor: "34,211,238",
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

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface Macro {
    id: string;
    name: string;
    steps: string[];   // each step is a natural-language command
    createdAt: string;
}

const MACROS_PATH = path.join(os.homedir(), ".aegis", "macros.json");

function ensureDir(): void {
    fs.mkdirSync(path.dirname(MACROS_PATH), {recursive: true});
}

function loadMacros(): Macro[] {
    try { return JSON.parse(fs.readFileSync(MACROS_PATH, "utf-8")); } catch { return []; }
}

function saveMacros(macros: Macro[]): void {
    ensureDir();
    fs.writeFileSync(MACROS_PATH, JSON.stringify(macros, null, 2), "utf-8");
}

// Recording state
let recording: {name: string; steps: string[]} | null = null;

export function startMacroRecording(name: string): string {
    if (recording) return `Zaten "${recording.name}" makrosu kaydediliyor. Önce durdur.`;
    recording = {name, steps: []};
    return `"${name}" makrosu kaydedilmeye başlandı. Komutlarını ver, bitince "makroyu durdur" de.`;
}

export function addMacroStep(command: string): void {
    recording?.steps.push(command);
}

export function stopMacroRecording(): string {
    if (!recording) return "Aktif makro kaydı yok.";
    if (recording.steps.length === 0) return `"${recording.name}" makrosuna hiç adım eklenmedi. Kaydedilmedi.`;

    const macro: Macro = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        name: recording.name,
        steps: recording.steps,
        createdAt: new Date().toISOString(),
    };
    const macros = loadMacros();
    const existing = macros.findIndex((m) => m.name.toLowerCase() === macro.name.toLowerCase());
    if (existing !== -1) macros[existing] = macro;
    else macros.push(macro);
    saveMacros(macros);
    recording = null;
    return `"${macro.name}" makrosu kaydedildi (${macro.steps.length} adım).`;
}

export function isRecording(): boolean { return recording !== null; }

export function listMacros(): string {
    const macros = loadMacros();
    if (macros.length === 0) return "Kayıtlı makro yok.";
    return macros.map((m) => `• ${m.name} (${m.steps.length} adım, ID: ${m.id})`).join("\n");
}

export function deleteMacro(idOrName: string): string {
    const macros = loadMacros();
    const idx = macros.findIndex(
        (m) => m.id === idOrName || m.name.toLowerCase().includes(idOrName.toLowerCase()),
    );
    if (idx === -1) return `"${idOrName}" adında makro bulunamadı.`;
    const removed = macros.splice(idx, 1)[0];
    saveMacros(macros);
    return `"${removed.name}" makrosu silindi.`;
}

export function getMacroSteps(idOrName: string): string[] | null {
    const macros = loadMacros();
    const m = macros.find(
        (m) => m.id === idOrName || m.name.toLowerCase().includes(idOrName.toLowerCase()),
    );
    return m?.steps ?? null;
}

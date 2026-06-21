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
    if (recording) return `The "${recording.name}" macro is already being recorded. Stop it first.`;
    recording = {name, steps: []};
    return `Started recording the "${name}" macro. Give your commands, and when done say "makroyu durdur".`;
}

export function addMacroStep(command: string): void {
    recording?.steps.push(command);
}

export function stopMacroRecording(): string {
    if (!recording) return "No active macro recording.";
    if (recording.steps.length === 0) return `No steps were added to the "${recording.name}" macro. Not saved.`;

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
    return `The "${macro.name}" macro was saved (${macro.steps.length} steps).`;
}

export function isRecording(): boolean { return recording !== null; }

export function listMacros(): string {
    const macros = loadMacros();
    if (macros.length === 0) return "No saved macros.";
    return macros.map((m) => `• ${m.name} (${m.steps.length} steps, ID: ${m.id})`).join("\n");
}

export function deleteMacro(idOrName: string): string {
    const macros = loadMacros();
    const idx = macros.findIndex(
        (m) => m.id === idOrName || m.name.toLowerCase().includes(idOrName.toLowerCase()),
    );
    if (idx === -1) return `No macro found named "${idOrName}".`;
    const removed = macros.splice(idx, 1)[0];
    saveMacros(macros);
    return `The "${removed.name}" macro was deleted.`;
}

export function getMacroSteps(idOrName: string): string[] | null {
    const macros = loadMacros();
    const m = macros.find(
        (m) => m.id === idOrName || m.name.toLowerCase().includes(idOrName.toLowerCase()),
    );
    return m?.steps ?? null;
}

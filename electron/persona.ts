import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PERSONAS_FILE = path.join(os.homedir(), ".aegis", "personas.json");
const ROLEPLAY_STATE = path.join(os.homedir(), ".aegis", "roleplay-state.json");

interface Persona {
    name: string;
    description: string;
    systemPrompt: string;
    createdAt: number;
}

interface Personas {
    active: string;
    personas: Record<string, Persona>;
}

const DEFAULT_PERSONAS: Record<string, Persona> = {
    default: {
        name: "default",
        description: "Standard AEGIS assistant — short and clear",
        systemPrompt: "",
        createdAt: 0,
    },
    formal: {
        name: "formal",
        description: "Formal assistant — corporate tone, respectful address",
        systemPrompt: "Use formal, corporate language. Address the user as 'Dear user'. Keep every response structured and professional.",
        createdAt: 0,
    },
    friendly: {
        name: "friendly",
        description: "Close friend — relaxed, warm, fun",
        systemPrompt: "Use warm, friendly language. Talk to the user like a friend, in a casual tone. You can be lightly humorous.",
        createdAt: 0,
    },
    coach: {
        name: "coach",
        description: "Tough coach — direct, motivating, results-driven",
        systemPrompt: "Act like a performance coach. Be direct and clear. Motivate the user, push them, keep them focused on their goals. Don't accept excuses.",
        createdAt: 0,
    },
    teacher: {
        name: "teacher",
        description: "Teacher — patient, explanatory, step by step",
        systemPrompt: "Act like a patient teacher. Explain topics step by step, use examples. Check whether the user understands.",
        createdAt: 0,
    },
};

function loadPersonas(): Personas {
    try {
        const data = JSON.parse(fs.readFileSync(PERSONAS_FILE, "utf-8"));
        // Merge built-in personas
        data.personas = {...DEFAULT_PERSONAS, ...data.personas};
        return data;
    } catch {
        return {active: "default", personas: {...DEFAULT_PERSONAS}};
    }
}

function savePersonas(data: Personas): void {
    fs.mkdirSync(path.dirname(PERSONAS_FILE), {recursive: true});
    // Don't save built-ins (they're always merged at load)
    const custom: Record<string, Persona> = {};
    for (const [k, v] of Object.entries(data.personas)) {
        if (!DEFAULT_PERSONAS[k]) custom[k] = v;
    }
    fs.writeFileSync(PERSONAS_FILE, JSON.stringify({active: data.active, personas: custom}, null, 2));
}

export function setActivePersona(name: string): string {
    const data = loadPersonas();
    if (!data.personas[name]) {
        return `Persona not found: "${name}". Available: ${Object.keys(data.personas).join(", ")}`;
    }
    data.active = name;
    savePersonas(data);
    const p = data.personas[name];
    return `Active persona: ${name}${p.description ? ` — ${p.description}` : ""}`;
}

export function getActivePersona(): string {
    const data = loadPersonas();
    const p = data.personas[data.active] ?? data.personas["default"];
    return `Active persona: ${p.name}\nDescription: ${p.description || "—"}\nInstruction: ${p.systemPrompt || "(default AEGIS behavior)"}`;
}

export function listPersonas(): string {
    const data = loadPersonas();
    const active = data.active;
    const lines = Object.values(data.personas).map((p) =>
        `${p.name === active ? "▶" : "•"} ${p.name} — ${p.description || "no description"}`
    );
    return `Personas (${lines.length}):\n${lines.join("\n")}`;
}

export function addPersona(name: string, description: string, systemPrompt: string): string {
    if (!name.trim()) return "ERROR: Persona name is required.";
    const data = loadPersonas();
    data.personas[name] = {name, description, systemPrompt, createdAt: Date.now()};
    savePersonas(data);
    return `New persona added: "${name}"`;
}

export function getPersonaSystemPrompt(): string {
    try {
        const data = loadPersonas();
        const roleplayState = getRoleplayState();
        if (roleplayState.active) {
            return `[ROLEPLAY MODE]\nCharacter: ${roleplayState.character}\n${roleplayState.scenario ? "Scenario: " + roleplayState.scenario : ""}\nSpeak as this character. Do not break character.`;
        }
        const p = data.personas[data.active];
        if (!p || !p.systemPrompt) return "";
        return `[PERSONA: ${p.name.toUpperCase()}]\n${p.systemPrompt}`;
    } catch {
        return "";
    }
}

interface RoleplayState {
    active: boolean;
    character: string;
    scenario: string;
    startedAt: number;
}

function getRoleplayState(): RoleplayState {
    try {
        return JSON.parse(fs.readFileSync(ROLEPLAY_STATE, "utf-8"));
    } catch {
        return {active: false, character: "", scenario: "", startedAt: 0};
    }
}

export function startRoleplay(character: string, scenario: string): string {
    if (!character.trim()) return "ERROR: Character description is required.";
    const state: RoleplayState = {active: true, character, scenario, startedAt: Date.now()};
    fs.mkdirSync(path.dirname(ROLEPLAY_STATE), {recursive: true});
    fs.writeFileSync(ROLEPLAY_STATE, JSON.stringify(state, null, 2));
    return `Roleplay mode started.\nCharacter: ${character}${scenario ? "\nScenario: " + scenario : ""}`;
}

export function stopRoleplay(): string {
    const state = getRoleplayState();
    if (!state.active) return "No active roleplay mode.";
    fs.writeFileSync(ROLEPLAY_STATE, JSON.stringify({...state, active: false}, null, 2));
    return "Roleplay mode disabled. Back to normal mode.";
}

export function getRoleplayPrompt(): string {
    return getRoleplayState().active ? `ROLE: ${getRoleplayState().character}` : "";
}

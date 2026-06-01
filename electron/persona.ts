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
        description: "Standart AEGIS asistanı — kısa ve net",
        systemPrompt: "",
        createdAt: 0,
    },
    formal: {
        name: "formal",
        description: "Resmi asistan — kurumsal dil, saygılı hitap",
        systemPrompt: "Resmi ve kurumsal bir dil kullan. Kullanıcıya 'Sayın kullanıcı' ile hitap et. Her yanıt yapılandırılmış ve profesyonel olsun.",
        createdAt: 0,
    },
    friendly: {
        name: "friendly",
        description: "Samimi arkadaş — rahat, sıcak, eğlenceli",
        systemPrompt: "Samimi ve sıcak bir dil kullan. Kullanıcıyla arkadaş gibi konuş, sen-sen hitabı kullan. Hafif esprili olabilirsin.",
        createdAt: 0,
    },
    coach: {
        name: "coach",
        description: "Sert koç — doğrudan, motive edici, sonuç odaklı",
        systemPrompt: "Bir performans koçu gibi davran. Doğrudan ve net ol. Kullanıcıyı motive et, zorla, hedeflerine odaklanmasını sağla. Bahane kabul etme.",
        createdAt: 0,
    },
    teacher: {
        name: "teacher",
        description: "Öğretmen — sabırlı, açıklayıcı, adım adım",
        systemPrompt: "Sabırlı bir öğretmen gibi davran. Konuları adım adım açıkla, örnekler kullan. Kullanıcının anlayıp anlamadığını kontrol et.",
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
        return `Kişilik bulunamadı: "${name}". Mevcut: ${Object.keys(data.personas).join(", ")}`;
    }
    data.active = name;
    savePersonas(data);
    const p = data.personas[name];
    return `Aktif kişilik: ${name}${p.description ? ` — ${p.description}` : ""}`;
}

export function getActivePersona(): string {
    const data = loadPersonas();
    const p = data.personas[data.active] ?? data.personas["default"];
    return `Aktif kişilik: ${p.name}\nAçıklama: ${p.description || "—"}\nYönerge: ${p.systemPrompt || "(varsayılan AEGIS davranışı)"}`;
}

export function listPersonas(): string {
    const data = loadPersonas();
    const active = data.active;
    const lines = Object.values(data.personas).map((p) =>
        `${p.name === active ? "▶" : "•"} ${p.name} — ${p.description || "açıklama yok"}`
    );
    return `Kişilikler (${lines.length}):\n${lines.join("\n")}`;
}

export function addPersona(name: string, description: string, systemPrompt: string): string {
    if (!name.trim()) return "HATA: Kişilik adı gerekli.";
    const data = loadPersonas();
    data.personas[name] = {name, description, systemPrompt, createdAt: Date.now()};
    savePersonas(data);
    return `Yeni kişilik eklendi: "${name}"`;
}

export function getPersonaSystemPrompt(): string {
    try {
        const data = loadPersonas();
        const roleplayState = getRoleplayState();
        if (roleplayState.active) {
            return `[ROL YAPMA MODU]\nKarakter: ${roleplayState.character}\n${roleplayState.scenario ? "Senaryo: " + roleplayState.scenario : ""}\nBu karakterde konuş. Karakter dışına çıkma.`;
        }
        const p = data.personas[data.active];
        if (!p || !p.systemPrompt) return "";
        return `[KİŞİLİK: ${p.name.toUpperCase()}]\n${p.systemPrompt}`;
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
    if (!character.trim()) return "HATA: Karakter açıklaması gerekli.";
    const state: RoleplayState = {active: true, character, scenario, startedAt: Date.now()};
    fs.mkdirSync(path.dirname(ROLEPLAY_STATE), {recursive: true});
    fs.writeFileSync(ROLEPLAY_STATE, JSON.stringify(state, null, 2));
    return `Rol yapma modu başladı.\nKarakter: ${character}${scenario ? "\nSenaryo: " + scenario : ""}`;
}

export function stopRoleplay(): string {
    const state = getRoleplayState();
    if (!state.active) return "Aktif rol yapma modu yok.";
    fs.writeFileSync(ROLEPLAY_STATE, JSON.stringify({...state, active: false}, null, 2));
    return "Rol yapma modu kapatıldı. Normal moda dönüldü.";
}

export function getRoleplayPrompt(): string {
    return getRoleplayState().active ? `ROL: ${getRoleplayState().character}` : "";
}

// AEGIS — Smart Home layer · Phase 62
//
// Controls smart home devices via the Home Assistant REST API. A single Home
// Assistant server manages all the brands behind it (Hue, Tapo, Tuya, Matter,
// Zigbee…) from one API → the user sets up once, hundreds of devices.
//
// This module is PURE logic + HTTP (not dependent on Electron); the tools.ts executors
// call the functions here. The intelligence is here:
//   - Natural language ("dim the living room", "turn everything off") → entity resolution
//   - Room / group / device name normalize + fuzzy matching (TR + EN)
//   - Confirmation gate for critical devices (lock/heater/garage/outlet)
//
// Auth: HA base URL + long-lived access token. Stored in Settings (AegisConfig).

export interface HAConfig {
    url: string;     // http://homeassistant.local:8123  (trailing / optional)
    token: string;   // long-lived access token
}

export interface HAEntity {
    entity_id: string;            // "light.salon", "switch.kahve", "lock.on_kapi"
    state: string;                // "on" | "off" | "23.5" | "locked" …
    attributes: Record<string, unknown>;
    friendly_name: string;        // attributes.friendly_name ?? entity_id
    domain: string;               // the head of entity_id: light, switch, lock, climate…
}

// ── Domain classification ─────────────────────────────────────────────────────
// Domains that can run directly without confirmation (harmless). Everything else is "critical".
const SAFE_DOMAINS = new Set([
    "light", "switch", "scene", "script", "media_player", "fan",
    "input_boolean", "automation", "group",
]);

// Explicitly "critical" (physical/security) domains — require confirmation.
const CRITICAL_DOMAINS = new Set([
    "lock",        // door lock
    "cover",       // garage / blind / shutter
    "climate",     // heater / AC / thermostat
    "water_heater",
    "vacuum",      // robot vacuum (it moves)
    "alarm_control_panel",
]);

// If a switch/outlet's name contains these words, treat it as critical (heater outlet, etc.).
const CRITICAL_NAME_HINTS = [
    "isitici", "heater", "soba", "firin", "oven", "ocak", "stove",
    "kombi", "boiler", "kazan", "garaj", "garage", "kapi", "door",
    "kilit", "lock", "pompa", "pump", "su", "water",
];

export function isCriticalEntity(e: HAEntity): boolean {
    if (CRITICAL_DOMAINS.has(e.domain)) return true;
    if (e.domain === "switch" || e.domain === "input_boolean") {
        const n = normalize(e.friendly_name + " " + e.entity_id);
        return CRITICAL_NAME_HINTS.some((h) => n.includes(h));
    }
    return false;
}

// ── Normalize (TR + accents → ASCII) ──────────────────────────────────────────
export function normalize(s: string): string {
    return s.toLowerCase()
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
        .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
        .replace(/î/g, "i").replace(/â/g, "a")
        .replace(/[äàáâ]/g, "a").replace(/[éèêë]/g, "e").replace(/[íìï]/g, "i")
        .replace(/[óòô]/g, "o").replace(/[úùû]/g, "u").replace(/ñ/g, "n")
        .replace(/[_\-.]/g, " ")
        .replace(/\s+/g, " ").trim();
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function baseUrl(cfg: HAConfig): string {
    return cfg.url.replace(/\/+$/, "");
}

async function haFetch(
    cfg: HAConfig, path: string, init?: RequestInit, timeoutMs = 10000,
): Promise<Response> {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), timeoutMs);
    try {
        return await fetch(`${baseUrl(cfg)}${path}`, {
            ...init,
            signal: ac.signal,
            headers: {
                Authorization: `Bearer ${cfg.token}`,
                "Content-Type": "application/json",
                ...(init?.headers ?? {}),
            },
        });
    } finally {
        clearTimeout(tid);
    }
}

function toEntity(raw: any): HAEntity {
    const entity_id: string = raw.entity_id ?? "";
    return {
        entity_id,
        state: raw.state ?? "unknown",
        attributes: raw.attributes ?? {},
        friendly_name: raw.attributes?.friendly_name ?? entity_id,
        domain: entity_id.split(".")[0] ?? "",
    };
}

/** Connection test — is HA up and is the token valid? */
export async function testConnection(cfg: HAConfig): Promise<{ok: boolean; message: string}> {
    if (!cfg.url || !cfg.token) {
        return {ok: false, message: "Home Assistant URL or token is not set. Enter it in Settings → Smart Home."};
    }
    try {
        const r = await haFetch(cfg, "/api/", undefined, 6000);
        if (r.status === 401) return {ok: false, message: "Token is invalid (401). Check the token in Settings → Smart Home."};
        if (!r.ok) return {ok: false, message: `Home Assistant returned ${r.status}.`};
        return {ok: true, message: "Connected to Home Assistant."};
    } catch (e) {
        return {ok: false, message: `Could not reach Home Assistant: ${(e as Error).message}. Is the URL correct? (e.g. http://homeassistant.local:8123)`};
    }
}

/** Fetch all entities (limited to controllable domains). */
export async function fetchStates(cfg: HAConfig): Promise<HAEntity[]> {
    const r = await haFetch(cfg, "/api/states");
    if (!r.ok) throw new Error(`Home Assistant /api/states ${r.status}`);
    const arr = (await r.json()) as any[];
    return arr.map(toEntity);
}

// Only devices the user would "control" (filter out sensors/automation-internal, etc.).
const CONTROLLABLE = new Set([
    ...SAFE_DOMAINS, ...CRITICAL_DOMAINS,
]);

export function controllable(entities: HAEntity[]): HAEntity[] {
    return entities.filter((e) => CONTROLLABLE.has(e.domain));
}

// ── Natural language → entity resolution ──────────────────────────────────────
// Map phrases like "salon", "salondaki ışıklar", "yatak odası lambası" to entities.
// Strategy: normalize the target text → compute a word-overlap score against each
// entity's friendly_name+id → return the best match(es). When a room name appears it
// can cover ALL suitable devices in that room ("salonu karart" → living-room lights).
const STOPWORDS = new Set([
    "yi", "yu", "yi", "i", "u", "deki", "daki", "teki", "taki", "nin", "nun",
    "lar", "ler", "le", "yi", "ye", "ya", "the", "a", "an", "in", "on", "of",
    "isigi", "isik", "isiklar", "isiklari", "lamba", "lambasi", "lambalar",
    "light", "lights", "lamp",
]);

export interface ResolveResult {
    matches: HAEntity[];
    /** A description when multiple devices or a broad scope ("everything") matched. */
    scope: string;
}

/** Is it a bulk phrase like "her şey / hepsi / tüm ışıklar / all"? */
function isAllScope(target: string): "all" | "all_lights" | null {
    const t = normalize(target);
    // "tüm ışık" is most specific → check first (otherwise "tüm" would fall into all).
    // After normalize, suffixes remain ASCII ("isiklari"), hence the substring check.
    if (/(tum isik|butun isik|tum lamba|butun lamba|all light|all lamp|tum led)/.test(t)) return "all_lights";
    if (/(her sey|hersey|hepsi|tum cihaz|butun cihaz|all device|everything|tum ev)/.test(t)) return "all";
    return null;
}

export function resolveEntities(target: string, entities: HAEntity[]): ResolveResult {
    const ctrl = controllable(entities);

    // Bulk scope
    const all = isAllScope(target);
    if (all === "all") {
        return {matches: ctrl.filter((e) => SAFE_DOMAINS.has(e.domain)), scope: "all devices"};
    }
    if (all === "all_lights") {
        return {matches: ctrl.filter((e) => e.domain === "light"), scope: "all lights"};
    }

    // If a full entity_id was given, match directly
    const exact = ctrl.find((e) => normalize(e.entity_id) === normalize(target));
    if (exact) return {matches: [exact], scope: ""};

    const targetWords = normalize(target).split(" ").filter((w) => w && !STOPWORDS.has(w));
    if (targetWords.length === 0) return {matches: [], scope: ""};

    type Scored = {e: HAEntity; score: number};
    const scored: Scored[] = ctrl.map((e) => {
        const hay = normalize(e.friendly_name + " " + e.entity_id).split(" ");
        let score = 0;
        for (const w of targetWords) {
            if (hay.includes(w)) score += 2;                       // exact word
            else if (hay.some((h) => h.startsWith(w) || w.startsWith(h))) score += 1; // prefix
        }
        return {e, score};
    }).filter((s) => s.score > 0);

    if (scored.length === 0) return {matches: [], scope: ""};

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0].score;

    // Highest-scoring matches. A broad match like a room name can return multiple devices
    // (e.g. "salon" → salon_lamba + salon_spot). If there are lights, prioritize lights.
    const top = scored.filter((s) => s.score === best).map((s) => s.e);

    if (top.length > 1) {
        const lights = top.filter((e) => e.domain === "light");
        if (lights.length > 0 && lights.length < top.length) {
            return {matches: lights, scope: `${lights.length} lights`};
        }
        return {matches: top, scope: `${top.length} devices`};
    }
    return {matches: top, scope: ""};
}

// ── Service call ──────────────────────────────────────────────────────────────
export async function callService(
    cfg: HAConfig, domain: string, service: string, data: Record<string, unknown>,
): Promise<void> {
    const r = await haFetch(cfg, `/api/services/${domain}/${service}`, {
        method: "POST",
        body: JSON.stringify(data),
    });
    if (!r.ok) {
        const body = await r.text().catch(() => "");
        throw new Error(`service ${domain}.${service} ${r.status}${body ? ": " + body.slice(0, 120) : ""}`);
    }
}

export type Action =
    | {kind: "on"}
    | {kind: "off"}
    | {kind: "toggle"}
    | {kind: "brightness"; pct: number}     // 0-100
    | {kind: "temperature"; celsius: number}
    | {kind: "lock"}
    | {kind: "unlock"}
    | {kind: "open"}                         // cover
    | {kind: "close"};

/** Apply an action to an entity — picks the right service based on the domain. */
export async function applyAction(cfg: HAConfig, e: HAEntity, action: Action): Promise<string> {
    const id = e.entity_id;
    const d = e.domain;

    switch (action.kind) {
        case "on":
            await callService(cfg, d === "light" || d === "switch" || d === "fan" || d === "media_player" ? d : "homeassistant", "turn_on", {entity_id: id});
            return `${e.friendly_name} turned on`;
        case "off":
            await callService(cfg, d === "light" || d === "switch" || d === "fan" || d === "media_player" ? d : "homeassistant", "turn_off", {entity_id: id});
            return `${e.friendly_name} turned off`;
        case "toggle":
            await callService(cfg, "homeassistant", "toggle", {entity_id: id});
            return `${e.friendly_name} toggled`;
        case "brightness": {
            const pct = Math.max(0, Math.min(100, Math.round(action.pct)));
            if (pct === 0) {
                await callService(cfg, "light", "turn_off", {entity_id: id});
                return `${e.friendly_name} turned off (0%)`;
            }
            await callService(cfg, "light", "turn_on", {entity_id: id, brightness_pct: pct});
            return `${e.friendly_name} brightness set to ${pct}%`;
        }
        case "temperature":
            await callService(cfg, "climate", "set_temperature", {entity_id: id, temperature: action.celsius});
            return `${e.friendly_name} set to ${action.celsius}°C`;
        case "lock":
            await callService(cfg, "lock", "lock", {entity_id: id});
            return `${e.friendly_name} locked`;
        case "unlock":
            await callService(cfg, "lock", "unlock", {entity_id: id});
            return `${e.friendly_name} unlocked`;
        case "open":
            await callService(cfg, "cover", "open_cover", {entity_id: id});
            return `${e.friendly_name} opened`;
        case "close":
            await callService(cfg, "cover", "close_cover", {entity_id: id});
            return `${e.friendly_name} closed`;
    }
}

// ── Human-readable status summary ─────────────────────────────────────────────
export function describeState(e: HAEntity): string {
    const a = e.attributes;
    switch (e.domain) {
        case "light": {
            if (e.state !== "on") return `${e.friendly_name}: off`;
            const b = typeof a.brightness === "number" ? Math.round((a.brightness / 255) * 100) : null;
            return `${e.friendly_name}: on${b != null ? ` (${b}%)` : ""}`;
        }
        case "climate": {
            const cur = a.current_temperature;
            const tgt = a.temperature;
            return `${e.friendly_name}: ${e.state}${cur != null ? `, ambient ${cur}°C` : ""}${tgt != null ? `, target ${tgt}°C` : ""}`;
        }
        case "lock":
            return `${e.friendly_name}: ${e.state === "locked" ? "locked" : "unlocked"}`;
        case "cover":
            return `${e.friendly_name}: ${e.state}`;
        case "sensor":
            return `${e.friendly_name}: ${e.state}${a.unit_of_measurement ? " " + a.unit_of_measurement : ""}`;
        default:
            return `${e.friendly_name}: ${e.state}`;
    }
}

/** Group by room/area (rough guess from the first word of friendly_name). */
export function groupByArea(entities: HAEntity[]): Map<string, HAEntity[]> {
    const map = new Map<string, HAEntity[]>();
    for (const e of entities) {
        const area = (e.attributes.area as string) || normalize(e.friendly_name).split(" ")[0] || "other";
        if (!map.has(area)) map.set(area, []);
        map.get(area)!.push(e);
    }
    return map;
}

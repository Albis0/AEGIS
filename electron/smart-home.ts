// AEGIS — Akıllı Ev (Smart Home) katmanı · Faz 62
//
// Home Assistant REST API üzerinden akıllı ev cihazlarını kontrol eder. Tek bir
// Home Assistant sunucusu, arkasındaki tüm markaları (Hue, Tapo, Tuya, Matter,
// Zigbee…) tek API'den yönetir → kullanıcı tek kurulum yapar, yüzlerce cihaz.
//
// Bu modül SAF mantık + HTTP'dir (Electron'a bağımlı değil); tools.ts executor'ları
// buradaki fonksiyonları çağırır. Akıllılık burada:
//   - Doğal dil ("salonu karart", "her şeyi kapat") → entity çözümleme
//   - Oda / grup / cihaz adı normalize + fuzzy eşleştirme (TR + EN)
//   - Kritik cihazlarda (kilit/ısıtıcı/garaj/priz) onay kapısı
//
// Kimlik: HA base URL + long-lived access token. Settings'te (AegisConfig) saklanır.

export interface HAConfig {
    url: string;     // http://homeassistant.local:8123  (sondaki / opsiyonel)
    token: string;   // long-lived access token
}

export interface HAEntity {
    entity_id: string;            // "light.salon", "switch.kahve", "lock.on_kapi"
    state: string;                // "on" | "off" | "23.5" | "locked" …
    attributes: Record<string, unknown>;
    friendly_name: string;        // attributes.friendly_name ?? entity_id
    domain: string;               // entity_id'nin başı: light, switch, lock, climate…
}

// ── Domain sınıflandırması ────────────────────────────────────────────────────
// Onaysız direkt çalışabilen (zararsız) domain'ler. Diğer her şey "kritik" sayılır.
const SAFE_DOMAINS = new Set([
    "light", "switch", "scene", "script", "media_player", "fan",
    "input_boolean", "automation", "group",
]);

// Açıkça "kritik" (fiziksel/güvenlik) domain'ler — onay ister.
const CRITICAL_DOMAINS = new Set([
    "lock",        // kapı kilidi
    "cover",       // garaj / panjur / kepenk
    "climate",     // ısıtıcı / klima / termostat
    "water_heater",
    "vacuum",      // robot süpürge (hareket eder)
    "alarm_control_panel",
]);

// Bir switch/outlet'in adı bu kelimeleri içeriyorsa kritik say (ısıtıcı prizi vb.).
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

// ── Normalize (TR + aksan → ASCII) ────────────────────────────────────────────
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

// ── HTTP yardımcıları ─────────────────────────────────────────────────────────
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

/** Bağlantı testi — HA ayağa kalkmış ve token geçerli mi? */
export async function testConnection(cfg: HAConfig): Promise<{ok: boolean; message: string}> {
    if (!cfg.url || !cfg.token) {
        return {ok: false, message: "Home Assistant URL veya token ayarlı değil. Ayarlar → Akıllı Ev'den gir."};
    }
    try {
        const r = await haFetch(cfg, "/api/", undefined, 6000);
        if (r.status === 401) return {ok: false, message: "Token geçersiz (401). Ayarlar → Akıllı Ev'den token'ı kontrol et."};
        if (!r.ok) return {ok: false, message: `Home Assistant ${r.status} döndü.`};
        return {ok: true, message: "Home Assistant'a bağlanıldı."};
    } catch (e) {
        return {ok: false, message: `Home Assistant'a ulaşılamadı: ${(e as Error).message}. URL doğru mu? (örn: http://homeassistant.local:8123)`};
    }
}

/** Tüm entity'leri çek (kontrol edilebilir domain'lerle sınırla). */
export async function fetchStates(cfg: HAConfig): Promise<HAEntity[]> {
    const r = await haFetch(cfg, "/api/states");
    if (!r.ok) throw new Error(`Home Assistant /api/states ${r.status}`);
    const arr = (await r.json()) as any[];
    return arr.map(toEntity);
}

// Yalnızca kullanıcının "kontrol edeceği" türden cihazlar (sensör/otomasyon-iç vs. ele).
const CONTROLLABLE = new Set([
    ...SAFE_DOMAINS, ...CRITICAL_DOMAINS,
]);

export function controllable(entities: HAEntity[]): HAEntity[] {
    return entities.filter((e) => CONTROLLABLE.has(e.domain));
}

// ── Doğal dil → entity çözümleme ──────────────────────────────────────────────
// "salon", "salondaki ışıklar", "yatak odası lambası" gibi ifadeleri entity'lere eşle.
// Strateji: hedef metni normalize et → her entity'nin friendly_name+id'sine karşı
// kelime-örtüşme skoru hesapla → en iyi eşleşen(ler)i döndür. Oda adı geçince o odadaki
// TÜM uygun cihazları kapsayabilir ("salonu karart" → salon ışıkları).
const STOPWORDS = new Set([
    "yi", "yu", "yi", "i", "u", "deki", "daki", "teki", "taki", "nin", "nun",
    "lar", "ler", "le", "yi", "ye", "ya", "the", "a", "an", "in", "on", "of",
    "isigi", "isik", "isiklar", "isiklari", "lamba", "lambasi", "lambalar",
    "light", "lights", "lamp",
]);

export interface ResolveResult {
    matches: HAEntity[];
    /** Birden çok cihaz veya geniş kapsam ("her şey") eşleştiyse açıklama. */
    scope: string;
}

/** "her şey / hepsi / tüm ışıklar / all" gibi toplu ifade mi? */
function isAllScope(target: string): "all" | "all_lights" | null {
    const t = normalize(target);
    // "tüm ışık" en spesifik → önce kontrol et (yoksa "tüm" → all'a düşer).
    // normalize sonrası ekler ASCII olarak kalır ("isiklari"), bu yüzden substring kontrolü.
    if (/(tum isik|butun isik|tum lamba|butun lamba|all light|all lamp|tum led)/.test(t)) return "all_lights";
    if (/(her sey|hersey|hepsi|tum cihaz|butun cihaz|all device|everything|tum ev)/.test(t)) return "all";
    return null;
}

export function resolveEntities(target: string, entities: HAEntity[]): ResolveResult {
    const ctrl = controllable(entities);

    // Toplu kapsam
    const all = isAllScope(target);
    if (all === "all") {
        return {matches: ctrl.filter((e) => SAFE_DOMAINS.has(e.domain)), scope: "tüm cihazlar"};
    }
    if (all === "all_lights") {
        return {matches: ctrl.filter((e) => e.domain === "light"), scope: "tüm ışıklar"};
    }

    // Tam entity_id verildiyse direkt
    const exact = ctrl.find((e) => normalize(e.entity_id) === normalize(target));
    if (exact) return {matches: [exact], scope: ""};

    const targetWords = normalize(target).split(" ").filter((w) => w && !STOPWORDS.has(w));
    if (targetWords.length === 0) return {matches: [], scope: ""};

    type Scored = {e: HAEntity; score: number};
    const scored: Scored[] = ctrl.map((e) => {
        const hay = normalize(e.friendly_name + " " + e.entity_id).split(" ");
        let score = 0;
        for (const w of targetWords) {
            if (hay.includes(w)) score += 2;                       // tam kelime
            else if (hay.some((h) => h.startsWith(w) || w.startsWith(h))) score += 1; // önek
        }
        return {e, score};
    }).filter((s) => s.score > 0);

    if (scored.length === 0) return {matches: [], scope: ""};

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0].score;

    // En yüksek skorlu eşleşmeler. Oda adı gibi geniş eşleşmede birden çok cihaz dönebilir
    // (örn. "salon" → salon_lamba + salon_spot). Işık varsa ışıkları öncele.
    const top = scored.filter((s) => s.score === best).map((s) => s.e);

    if (top.length > 1) {
        const lights = top.filter((e) => e.domain === "light");
        if (lights.length > 0 && lights.length < top.length) {
            return {matches: lights, scope: `${lights.length} ışık`};
        }
        return {matches: top, scope: `${top.length} cihaz`};
    }
    return {matches: top, scope: ""};
}

// ── Servis çağrısı ────────────────────────────────────────────────────────────
export async function callService(
    cfg: HAConfig, domain: string, service: string, data: Record<string, unknown>,
): Promise<void> {
    const r = await haFetch(cfg, `/api/services/${domain}/${service}`, {
        method: "POST",
        body: JSON.stringify(data),
    });
    if (!r.ok) {
        const body = await r.text().catch(() => "");
        throw new Error(`servis ${domain}.${service} ${r.status}${body ? ": " + body.slice(0, 120) : ""}`);
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

/** Bir entity'ye bir aksiyon uygula — domain'e göre doğru servisi seçer. */
export async function applyAction(cfg: HAConfig, e: HAEntity, action: Action): Promise<string> {
    const id = e.entity_id;
    const d = e.domain;

    switch (action.kind) {
        case "on":
            await callService(cfg, d === "light" || d === "switch" || d === "fan" || d === "media_player" ? d : "homeassistant", "turn_on", {entity_id: id});
            return `${e.friendly_name} açıldı`;
        case "off":
            await callService(cfg, d === "light" || d === "switch" || d === "fan" || d === "media_player" ? d : "homeassistant", "turn_off", {entity_id: id});
            return `${e.friendly_name} kapatıldı`;
        case "toggle":
            await callService(cfg, "homeassistant", "toggle", {entity_id: id});
            return `${e.friendly_name} değiştirildi`;
        case "brightness": {
            const pct = Math.max(0, Math.min(100, Math.round(action.pct)));
            if (pct === 0) {
                await callService(cfg, "light", "turn_off", {entity_id: id});
                return `${e.friendly_name} kapatıldı (%0)`;
            }
            await callService(cfg, "light", "turn_on", {entity_id: id, brightness_pct: pct});
            return `${e.friendly_name} parlaklığı %${pct} yapıldı`;
        }
        case "temperature":
            await callService(cfg, "climate", "set_temperature", {entity_id: id, temperature: action.celsius});
            return `${e.friendly_name} ${action.celsius}°C'ye ayarlandı`;
        case "lock":
            await callService(cfg, "lock", "lock", {entity_id: id});
            return `${e.friendly_name} kilitlendi`;
        case "unlock":
            await callService(cfg, "lock", "unlock", {entity_id: id});
            return `${e.friendly_name} kilidi açıldı`;
        case "open":
            await callService(cfg, "cover", "open_cover", {entity_id: id});
            return `${e.friendly_name} açıldı`;
        case "close":
            await callService(cfg, "cover", "close_cover", {entity_id: id});
            return `${e.friendly_name} kapatıldı`;
    }
}

// ── İnsan-okur durum özeti ────────────────────────────────────────────────────
export function describeState(e: HAEntity): string {
    const a = e.attributes;
    switch (e.domain) {
        case "light": {
            if (e.state !== "on") return `${e.friendly_name}: kapalı`;
            const b = typeof a.brightness === "number" ? Math.round((a.brightness / 255) * 100) : null;
            return `${e.friendly_name}: açık${b != null ? ` (%${b})` : ""}`;
        }
        case "climate": {
            const cur = a.current_temperature;
            const tgt = a.temperature;
            return `${e.friendly_name}: ${e.state}${cur != null ? `, ortam ${cur}°C` : ""}${tgt != null ? `, hedef ${tgt}°C` : ""}`;
        }
        case "lock":
            return `${e.friendly_name}: ${e.state === "locked" ? "kilitli" : "açık"}`;
        case "cover":
            return `${e.friendly_name}: ${e.state}`;
        case "sensor":
            return `${e.friendly_name}: ${e.state}${a.unit_of_measurement ? " " + a.unit_of_measurement : ""}`;
        default:
            return `${e.friendly_name}: ${e.state}`;
    }
}

/** Oda/alan bazlı gruplama (friendly_name'in ilk kelimesinden kaba tahmin). */
export function groupByArea(entities: HAEntity[]): Map<string, HAEntity[]> {
    const map = new Map<string, HAEntity[]>();
    for (const e of entities) {
        const area = (e.attributes.area as string) || normalize(e.friendly_name).split(" ")[0] || "diğer";
        if (!map.has(area)) map.set(area, []);
        map.get(area)!.push(e);
    }
    return map;
}

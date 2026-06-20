/**
 * Faz 61 — Proaktif Örüntü Öğrenme (opt-in)
 *
 * "İkinci ben"in tacı proaktifliktir — ama güven tabanı kurulmadan ters teper.
 * Bu yüzden EN SON ve OPT-IN: varsayılan KAPALI, kullanıcı açarsa öneri gelir.
 *
 * Bu modül, zaman-damgalı tool kullanım kayıtlarından "ne zaman + hangi tool"
 * örüntüsünü çıkarır: ör. "her gün ~09:00 civarı spotify_play kullanıyorsun —
 * otomatikleştireyim mi?". Saf fonksiyon (Electron/IO bağımsız) — kayıtları alır,
 * öneri döndürür. Kalıcılık + opt-in bayrağı memory-plus/settings tarafında.
 *
 * OpenJarvis `agents/proactive_agent.py` (cron + tier'lı öneri) ilhamı; digest_collect
 * / connector ağı ALINMADI. Faz 54 izin kapısıyla uyumlu (öneri ≠ otomatik eylem).
 */

export interface UsageRecord {
    tool: string;
    /** Yerel saat dilimine göre 0-23 saat. */
    hour: number;
    /** Epoch ms — yeterli geçmiş var mı kontrolü ve "gün" ayrımı için. */
    ts: number;
}

export interface Pattern {
    tool: string;
    /** Örüntünün merkezlendiği saat (0-23). */
    hour: number;
    /** Bu (tool, saat-bandı) kaç kez görüldü. */
    occurrences: number;
    /** Kaç ayrı günde görüldü (gerçek alışkanlık = çok gün). */
    days: number;
    /** Opt-in öneri metni (Türkçe). */
    suggestion: string;
}

/** Saati 3 saatlik banda yuvarlar (sabah/öğle… toleransı). */
function band(hour: number): number {
    return Math.floor(hour / 3) * 3;
}

function bandLabel(b: number): string {
    if (b >= 5 && b < 12) return "sabah";
    if (b >= 12 && b < 17) return "öğleden sonra";
    if (b >= 17 && b < 22) return "akşam";
    return "gece";
}

/**
 * Kullanım kayıtlarından zamansal örüntüleri çıkarır. Bir örüntü "gerçek alışkanlık"
 * sayılması için:
 *   - en az `minDays` AYRI günde görülmeli (tek seferlik tesadüf elenir)
 *   - en az `minOccurrences` toplam tekrar
 * En güçlü örüntüler önce; en çok `limit` öneri döner. Spam'i bu eşikler önler.
 */
export function detectPatterns(
    records: UsageRecord[],
    {minDays = 2, minOccurrences = 3, limit = 3}: {minDays?: number; minOccurrences?: number; limit?: number} = {},
): Pattern[] {
    // (tool, saat-bandı) → {sayı, gün-kümesi}
    const groups = new Map<string, {tool: string; band: number; count: number; days: Set<string>}>();
    for (const r of records) {
        const b = band(r.hour);
        const key = `${r.tool}::${b}`;
        const g = groups.get(key) ?? {tool: r.tool, band: b, count: 0, days: new Set<string>()};
        g.count++;
        g.days.add(new Date(r.ts).toDateString());
        groups.set(key, g);
    }
    const patterns: Pattern[] = [];
    for (const g of groups.values()) {
        if (g.days.size >= minDays && g.count >= minOccurrences) {
            patterns.push({
                tool: g.tool,
                hour: g.band,
                occurrences: g.count,
                days: g.days.size,
                suggestion: `${bandLabel(g.band)} saatlerinde sık sık "${g.tool}" kullanıyorsun (${g.days.size} ayrı gün). İstersen bunu o saatte otomatik hatırlatabilir/çalıştırabilirim — açmak ister misin?`,
            });
        }
    }
    patterns.sort((a, b) => (b.days - a.days) || (b.occurrences - a.occurrences));
    return patterns.slice(0, limit);
}

/**
 * Opt-in proaktif öneri üretir. `enabled` false ise (varsayılan) HİÇBİR şey döndürmez
 * — güven tabanı kurulmadan ters tepmesin. Açıksa en güçlü örüntüleri özetler.
 */
export function buildProactiveSuggestion(records: UsageRecord[], enabled: boolean): string | null {
    if (!enabled) return null;
    const patterns = detectPatterns(records);
    if (patterns.length === 0) return null;
    return patterns.map((p) => `• ${p.suggestion}`).join("\n");
}

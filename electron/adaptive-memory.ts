/**
 * Faz 57 — Adaptif Hafıza: Semantik arama + otomatik çıkarım + çelişki çözme
 *
 * `facts.json` düz-JSON + keyword'dü: AEGIS kullanıcıyı KAYDEDİYOR ama ÖĞRENMİYORDU.
 * Bu modül üç saf yetenek ekler (Electron/IO bağımsız — `Fact[]` alır, `Fact[]` döner):
 *
 *   1. searchFacts   — token-overlap skoruyla anlamca en yakın gerçekleri bulur
 *                      ("geçen ay X hakkında ne demiştim?"). Embedding YOK — yerel,
 *                      sıfır-bağımlılık keyword skoru (knowledge.ts BM25-lite ruhu).
 *                      Embedding eklenirse buraya takılır; yokken graceful keyword.
 *   2. inferFacts    — bir kullanıcı mesajından otomatik gerçek çıkarır
 *                      ("benim adım X", "Python kullanıyorum", "kahveyi severim").
 *   3. reconcileFact — yeni gerçek eskisiyle ÇELİŞİYORSA (aynı özne/yüklem, farklı
 *                      değer) eskiyi günceller; değilse ekler.
 *
 * Yeni provider EKLENMEZ (ROADMAP kuralı). Saf fonksiyonlar; kalıcılık memory-plus.ts'te.
 */

export interface FactLike {
    id: string;
    content: string;
    addedAt: string;
    source: "manual" | "auto";
    tags: string[];
}

// ── 1. Semantik (token-overlap) arama ────────────────────────────────────────

const STOP = new Set([
    "ve", "ile", "bir", "bu", "şu", "o", "da", "de", "ki", "mi", "ne", "için",
    "the", "a", "an", "is", "to", "of", "in", "on", "and", "or", "my", "i",
    "benim", "ben", "sen", "senin", "var", "yok", "çok", "en",
]);

function toTokens(s: string): string[] {
    return s.toLowerCase()
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
        .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 1 && !STOP.has(w));
}

/**
 * Sorguya anlamca en yakın gerçekleri skorlu döndürür. Skor = ortak token sayısı /
 * sorgu token sayısı (Jaccard-benzeri). 0 skorlular elenir; en yüksek `limit` döner.
 */
export function searchFacts(facts: FactLike[], query: string, limit = 5): {fact: FactLike; score: number}[] {
    const q = toTokens(query);
    if (q.length === 0) return [];
    const qSet = new Set(q);
    const scored = facts.map((f) => {
        const ft = new Set(toTokens(f.content + " " + f.tags.join(" ")));
        let overlap = 0;
        for (const t of qSet) if (ft.has(t)) overlap++;
        return {fact: f, score: overlap / qSet.size};
    });
    return scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

// ── 2. Konuşmadan otomatik çıkarım ───────────────────────────────────────────

/**
 * Bir kullanıcı mesajından kalıcı sayılabilecek gerçekleri çıkarır. Yalnızca NET,
 * kişisel ve kalıcı ifadeler (isim, kullanılan teknoloji, tercih) — geçici/komut
 * cümleleri ("dosyayı aç") çıkarılmaz. Her gerçek bir `subject` (çelişki çözmede
 * kullanılır) ile döner.
 */
export interface InferredFact {
    content: string;
    subject: string;   // çelişki çözme anahtarı: "isim", "dil:python", "tercih:kahve"
    tags: string[];
}

const PATTERNS: {re: RegExp; build: (m: RegExpMatchArray) => InferredFact}[] = [
    // İsim
    {re: /\b(?:benim )?ad[ıi]m\s+([a-zçğıöşü]+)/i,
     build: (m) => ({content: `Kullanıcının adı ${cap(m[1])}.`, subject: "isim", tags: ["profil", "isim"]})},
    {re: /\bbana\s+([a-zçğıöşü]+)\s+de(?:nir|yebilirsin|rler)?\b/i,
     build: (m) => ({content: `Kullanıcının adı ${cap(m[1])}.`, subject: "isim", tags: ["profil", "isim"]})},
    {re: /\bmy name is\s+([a-z]+)/i,
     build: (m) => ({content: `Kullanıcının adı ${cap(m[1])}.`, subject: "isim", tags: ["profil", "isim"]})},
    // Kullanılan teknoloji/dil
    {re: /\b([a-zçğıöşü0-9+#.]+)\s+(?:kullan[ıi]yorum|ile çalış[ıi]yorum|yaz[ıi]yorum)\b/i,
     build: (m) => ({content: `Kullanıcı ${m[1]} kullanıyor.`, subject: `dil:${norm(m[1])}`, tags: ["teknoloji"]})},
    {re: /\bi (?:use|code in|work with)\s+([a-z0-9+#.]+)/i,
     build: (m) => ({content: `Kullanıcı ${m[1]} kullanıyor.`, subject: `dil:${norm(m[1])}`, tags: ["teknoloji"]})},
    // Tercih (sevme)
    {re: /\b([a-zçğıöşü ]+?)['ıiyu]?\s*(?:severim|seviyorum|bay[ıi]l[ıi]r[ıi]m)\b/i,
     build: (m) => ({content: `Kullanıcı ${m[1].trim()} sever.`, subject: `tercih:${norm(m[1])}`, tags: ["tercih"]})},
    // Tercih (sevmeme)
    {re: /\b([a-zçğıöşü ]+?)['ıiyu]?\s*(?:sevmem|sevmiyorum|nefret ederim)\b/i,
     build: (m) => ({content: `Kullanıcı ${m[1].trim()} sevmez.`, subject: `tercih:${norm(m[1])}`, tags: ["tercih"]})},
];

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function norm(s: string): string {
    return s.toLowerCase().trim()
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
        .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");
}

export function inferFacts(message: string): InferredFact[] {
    const out: InferredFact[] = [];
    const seen = new Set<string>();
    for (const p of PATTERNS) {
        const m = message.match(p.re);
        if (m) {
            const f = p.build(m);
            if (!seen.has(f.subject)) { seen.add(f.subject); out.push(f); }
        }
    }
    return out;
}

// ── 3. Çelişki çözme ─────────────────────────────────────────────────────────

// Kaydedilmiş gerçek cümlelerinin ("Kullanıcının adı X.", "Kullanıcı Y kullanıyor.",
// "Kullanıcı Z sever/sevmez.") öznesini tanıyan desenler — çelişki çözmede mevcut
// gerçeğin subject'ini bulmak için (girdi kalıpları inferFacts'ta, bunlar ÇIKTI kalıpları).
const STORED_SUBJECT: {re: RegExp; subject: (m: RegExpMatchArray) => string}[] = [
    {re: /kullanıcının ad[ıi]\s+/i, subject: () => "isim"},
    {re: /kullanıcı\s+(.+?)\s+kullanıyor/i, subject: (m) => `dil:${norm(m[1])}`},
    {re: /kullanıcı\s+(.+?)\s+sev(?:er|mez)/i, subject: (m) => `tercih:${norm(m[1])}`},
];

/**
 * Bir gerçeğin "öznesini" çıkarır (çelişki anahtarı). Hem girdi kalıplarını
 * (inferFacts: "benim adım X") hem kaydedilmiş çıktı kalıplarını ("Kullanıcının
 * adı X.") tanır — böylece reconcileFact mevcut gerçeğin öznesini bulabilir.
 */
export function subjectOf(content: string): string | null {
    for (const s of STORED_SUBJECT) {
        const m = content.match(s.re);
        if (m) return s.subject(m);
    }
    const inferred = inferFacts(content);
    return inferred.length ? inferred[0].subject : null;
}

export interface ReconcileResult {
    facts: FactLike[];
    action: "added" | "updated" | "duplicate";
    message: string;
}

/**
 * Yeni içerik mevcut gerçeklerle çelişiyorsa (aynı subject, farklı içerik) ESKİYİ
 * günceller; aynıysa duplicate; çelişki yoksa ekler. Subject yalnızca otomatik
 * çıkarılabilen tiplerde (isim/dil/tercih) hesaplanır; çıkarılamıyorsa düz ekleme.
 */
export function reconcileFact(
    facts: FactLike[],
    newContent: string,
    subject: string | null,
    now: () => string = () => new Date().toISOString(),
): ReconcileResult {
    const trimmed = newContent.trim();
    // Birebir aynı içerik → duplicate
    if (facts.some((f) => f.content.toLowerCase() === trimmed.toLowerCase())) {
        return {facts, action: "duplicate", message: "Bu gerçek zaten kayıtlı."};
    }
    if (subject) {
        const idx = facts.findIndex((f) => (subjectOf(f.content) === subject));
        if (idx !== -1) {
            const old = facts[idx].content;
            const updated = [...facts];
            updated[idx] = {...updated[idx], content: trimmed, addedAt: now(), source: "auto"};
            return {facts: updated, action: "updated",
                message: `Güncellendi: "${old}" → "${trimmed}"`};
        }
    }
    const fact: FactLike = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        content: trimmed, addedAt: now(), source: "auto", tags: [],
    };
    return {facts: [...facts, fact], action: "added", message: `Gerçek kaydedildi: "${trimmed}"`};
}

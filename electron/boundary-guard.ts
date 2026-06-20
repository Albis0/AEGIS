/**
 * Faz 58 — Boundary Guard: Dışarı Sızıntı Koruması
 *
 * Tool sonuçları + dosya içeriği LLM'e (deneme modunda senin proxy'inden) gidiyor.
 * Bir `.env` okutup özetletmek = API anahtarının log'a/3. tarafa düşmesi. Bir sızıntı
 * = kalıcı güven kaybı. Bu modül GİDEN içerikte sır desenlerini tespit edip REDAKTE
 * eder (maskeleyerek), içeriğin geri kalanını bozmadan.
 *
 * Saf fonksiyon — Electron/IO/ağ bağımsız. ai-client.ts giden mesajları çağırmadan
 * hemen önce uygular (perf etkisi ihmal edilebilir: birkaç regex/mesaj).
 *
 * OpenJarvis `security/boundary.py` redact modu + `credential_stripper.py`'den
 * sadeleştirilerek alındı. Taint/SSRF/signing ALINMADI.
 */

export interface SecretPattern {
    name: string;
    re: RegExp;
    /** Eşleşmenin tamamı mı yoksa bir yakalama grubu mu maskelenecek? */
    group?: number;
}

// Bilinen sır desenleri. `g` bayrağı şart (replaceAll için). Sıra: en özelden
// gevşeğe — bir token birden çok desene uymasın diye spesifik olanlar önce.
const PATTERNS: SecretPattern[] = [
    // AWS access key id
    {name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g},
    // AWS secret access key (40 char base64-ish, "secret" bağlamında)
    {name: "aws-secret", re: /\b(?:aws_secret_access_key|aws_secret)\s*[=:]\s*([A-Za-z0-9/+]{40})/gi, group: 1},
    // OpenAI / Anthropic / generic "sk-" keys
    {name: "openai-key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/g},
    // Anthropic
    {name: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g},
    // Google API key
    {name: "google-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g},
    // GitHub token
    {name: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g},
    // Slack token
    {name: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g},
    // Stripe
    {name: "stripe-key", re: /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g},
    // JWT (three base64url segments)
    {name: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g},
    // Bearer token (Authorization header)
    {name: "bearer", re: /\b(?:Bearer|Authorization:\s*Bearer)\s+([A-Za-z0-9._-]{16,})/gi, group: 1},
    // Private key blocks
    {name: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g},
    // password=... / parola=... / pwd:... (anahtar=değer biçimi)
    {name: "password-kv", re: /\b(?:password|passwd|pwd|parola|şifre|sifre)\s*[=:]\s*("[^"]+"|'[^']+'|[^\s,;]{4,})/gi, group: 1},
    // Generic "api_key=..." / "token=..." / "secret=..." (uzun değerler).
    // Prefix'li anahtarları da yakalar (GOOGLE_API_KEY, MY_ACCESS_TOKEN) — bu yüzden
    // \b yerine "kelime başı VEYA _ ardından" sınırı kullanılır.
    {name: "generic-secret-kv", re: /(?:^|[^A-Za-z])(?:[a-z]+[_-])*(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret[_-]?key|client[_-]?secret|api[_-]?token)\s*[=:]\s*("[^"]+"|'[^']+'|[A-Za-z0-9._-]{12,})/gi, group: 1},
];

const MASK = "[REDACTED]";

/** Bir metni maskeler. Hiç sır yoksa AYNI referansı döndürür (perf). */
export function redactSecrets(text: string): string {
    if (!text || text.length < 8) return text;
    let out = text;
    for (const p of PATTERNS) {
        p.re.lastIndex = 0;
        if (p.group != null) {
            out = out.replace(p.re, (full, captured) =>
                full.replace(captured, MASK));
        } else {
            out = out.replace(p.re, MASK);
        }
    }
    return out;
}

/**
 * Bir metinde HAM (maskelenmemiş) sır var mı? Zaten redakte edilmiş `[REDACTED]`
 * değerlerini sır SAYMAZ → redaksiyon idempotenttir (redact(redact(x))==redact(x)).
 */
export function hasSecret(text: string): boolean {
    if (!text || text.length < 8) return false;
    for (const p of PATTERNS) {
        p.re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = p.re.exec(text)) !== null) {
            const secretPart = p.group != null ? m[p.group] : m[0];
            // Maskelenmiş değer (sadece [REDACTED]) gerçek sır değildir.
            if (secretPart && !/^["']?\[REDACTED\]["']?$/.test(secretPart)) return true;
            if (p.re.lastIndex === m.index) p.re.lastIndex++; // sonsuz döngü koruması
        }
    }
    return false;
}

/**
 * Bir OAI mesaj içeriğini (string | parça dizisi) redakte eder. String → string;
 * parça dizisinde yalnız text parçaları maskelenir (görüntü/diğer parçalar dokunulmaz).
 */
export function redactContent(content: unknown): unknown {
    if (typeof content === "string") return redactSecrets(content);
    if (Array.isArray(content)) {
        return content.map((part) => {
            if (part && typeof part === "object" && "type" in part && (part as {type: string}).type === "text" && "text" in part) {
                return {...part, text: redactSecrets(String((part as {text: string}).text))};
            }
            return part;
        });
    }
    return content;
}

/**
 * Giden mesaj dizisini redakte eder. system + user + tool + assistant içerikleri
 * taranır; tool_calls argümanları da maskelenebilir (model'in döndürdüğü args'ta
 * sır olabilir). Yeni dizi döner; sır yoksa orijinal referans korunur (perf).
 */
export function redactMessages<T extends {role: string; content?: unknown; tool_calls?: unknown}>(messages: T[]): T[] {
    let changed = false;
    const out = messages.map((m) => {
        const redactedContent = m.content != null ? redactContent(m.content) : m.content;
        if (redactedContent !== m.content) { changed = true; return {...m, content: redactedContent}; }
        return m;
    });
    return changed ? out : messages;
}

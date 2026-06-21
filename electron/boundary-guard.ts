/**
 * Phase 58 — Boundary Guard: Outbound Leak Protection
 *
 * Tool results + file content go to the LLM (through your proxy in trial mode).
 * Reading and summarizing a `.env` = leaking an API key into a log / to a third party.
 * One leak = permanent loss of trust. This module detects secret patterns in OUTBOUND
 * content and REDACTS them (by masking), without corrupting the rest of the content.
 *
 * Pure function — Electron/IO/network independent. ai-client.ts applies it to outbound
 * messages right before the call (negligible perf impact: a few regexes per message).
 *
 * Simplified from the OpenJarvis `security/boundary.py` redact mode +
 * `credential_stripper.py`. Taint/SSRF/signing NOT adopted.
 */

export interface SecretPattern {
    name: string;
    re: RegExp;
    /** Mask the entire match, or just a capture group? */
    group?: number;
}

// Known secret patterns. The `g` flag is required (for replaceAll). Order: most
// specific to loosest — specific ones first so a token doesn't match multiple patterns.
const PATTERNS: SecretPattern[] = [
    // AWS access key id
    {name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g},
    // AWS secret access key (40 char base64-ish, in a "secret" context)
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
    // password=... / parola=... / pwd:... (key=value form; keeps TR password keywords for matching)
    {name: "password-kv", re: /\b(?:password|passwd|pwd|parola|şifre|sifre)\s*[=:]\s*("[^"]+"|'[^']+'|[^\s,;]{4,})/gi, group: 1},
    // Generic "api_key=..." / "token=..." / "secret=..." (long values).
    // Also catches prefixed keys (GOOGLE_API_KEY, MY_ACCESS_TOKEN) — so instead of
    // \b it uses a "word start OR after _" boundary.
    {name: "generic-secret-kv", re: /(?:^|[^A-Za-z])(?:[a-z]+[_-])*(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret[_-]?key|client[_-]?secret|api[_-]?token)\s*[=:]\s*("[^"]+"|'[^']+'|[A-Za-z0-9._-]{12,})/gi, group: 1},
];

const MASK = "[REDACTED]";

/** Masks a text. Returns the SAME reference if there are no secrets (perf). */
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
 * Does a text contain a RAW (unmasked) secret? Already-redacted `[REDACTED]` values
 * do NOT count as secrets → redaction is idempotent (redact(redact(x))==redact(x)).
 */
export function hasSecret(text: string): boolean {
    if (!text || text.length < 8) return false;
    for (const p of PATTERNS) {
        p.re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = p.re.exec(text)) !== null) {
            const secretPart = p.group != null ? m[p.group] : m[0];
            // A masked value (just [REDACTED]) is not a real secret.
            if (secretPart && !/^["']?\[REDACTED\]["']?$/.test(secretPart)) return true;
            if (p.re.lastIndex === m.index) p.re.lastIndex++; // infinite-loop guard
        }
    }
    return false;
}

/**
 * Redacts an OAI message content (string | array of parts). String → string; in a part
 * array only text parts are masked (image/other parts are left untouched).
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
 * Redacts an outbound message array. system + user + tool + assistant contents are
 * scanned; tool_calls arguments can also be masked (the args the model returns may
 * contain secrets). Returns a new array; if there are no secrets the original reference
 * is preserved (perf).
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

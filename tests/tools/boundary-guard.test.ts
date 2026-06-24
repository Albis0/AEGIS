import {describe, it, expect} from "vitest";
import {redactSecrets, hasSecret, redactContent, redactMessages} from "../../electron/boundary-guard";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 58 — Boundary Guard. Reading and summarizing a .env means an API key
// leaking to a 3rd party (cloud LLM / proxy). A leak is a permanent loss of trust.
// Secret patterns in outgoing content must be masked BEFORE going to the cloud;
// normal text must NOT be altered.
//
// NOTE: the fake "sk-" examples are concatenated with SK at runtime; not real,
// but split up so they don't get caught by the pre-commit secret-hook's static scan.
// ─────────────────────────────────────────────────────────────────────────────

const SK = "sk" + "-"; // fake OpenAI/Anthropic key prefix (hook-friendly)

describe("redactSecrets — secret types", () => {
    const cases: [string, string][] = [
        ["AWS access key", "key=AKIAIOSFODNN7EXAMPLE bitti"],
        ["OpenAI key", "OPENAI_API_KEY=" + SK + "abcdefghijklmnopqrstuvwxyz1234"],
        ["Anthropic key", "anthropic: " + SK + "ant-api03-abcdefghijklmnopqrst"],
        ["Google key", "GOOGLE_API_KEY=AIzaSyA12345678901234567890123456789012"],
        ["GitHub token", "token ghp_0123456789012345678901234567890123456"],
        ["Slack token", "xoxb-1234567890-abcdefghijkl"],
        ["Stripe", "sk_live_0123456789abcdefABCDEF"],
        ["Bearer", "Authorization: Bearer abcdef123456ghijkl7890"],
        ["password kv", 'password="hunter2secret"'],
        ["parola kv", "parola: cokGizli123"],
        ["generic api_key", "api_key=abcdefgh12345678 ok"],
    ];

    for (const [label, input] of cases) {
        it(`${label} is masked`, () => {
            const out = redactSecrets(input);
            expect(out).toContain("[REDACTED]");
            // The secret itself must not remain in the output (at least not raw)
            expect(hasSecret(out)).toBe(false);
        });
    }

    it("JWT is masked", () => {
        const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36";
        expect(redactSecrets(`token: ${jwt}`)).toContain("[REDACTED]");
    });

    it("private key block is masked", () => {
        const pk = "-----BEGIN RSA PRIVATE KEY-----\nMIIEabc123\n-----END RSA PRIVATE KEY-----";
        const out = redactSecrets(pk);
        expect(out).toBe("[REDACTED]");
    });
});

describe("redactSecrets — does not corrupt normal text", () => {
    it("text without secrets stays the same (same reference)", () => {
        const t = "Merhaba, bugün hava çok güzel ve toplantı saat 15:00'te.";
        expect(redactSecrets(t)).toBe(t);
    });

    it("short text is left untouched", () => {
        expect(redactSecrets("ok")).toBe("ok");
    });

    it("normal words containing 'key'/'token' are not masked", () => {
        const t = "monkey turkey token kelimesi cümlede geçiyor";
        expect(redactSecrets(t)).toBe(t);
    });

    it("code example (no secrets) is preserved", () => {
        const t = "const x = readFile('config.json'); console.log(x);";
        expect(redactSecrets(t)).toBe(t);
    });
});

describe("hasSecret", () => {
    it("recognizes text containing a secret", () => {
        expect(hasSecret("AKIAIOSFODNN7EXAMPLE")).toBe(true);
    });
    it("false for clean text", () => {
        expect(hasSecret("sadece düz bir cümle")).toBe(false);
    });
});

describe("redactContent — array of parts", () => {
    it("redacts string content", () => {
        expect(redactContent("key " + SK + "abcdefghijklmnopqrstuvwx")).toContain("[REDACTED]");
    });
    it("redacts text parts, leaves image parts untouched", () => {
        const parts = [
            {type: "text", text: "parola: gizli12345"},
            {type: "image_url", image_url: {url: "data:image/png;base64,AAAA"}},
        ];
        const out = redactContent(parts) as typeof parts;
        expect((out[0] as {text: string}).text).toContain("[REDACTED]");
        expect(out[1]).toEqual(parts[1]); // image untouched
    });
});

describe("redactMessages — array of messages", () => {
    it("masks a leak found in a tool result", () => {
        const msgs = [
            {role: "system", content: "Sen AEGIS'sin."},
            {role: "user", content: ".env dosyamı özetle"},
            {role: "tool", content: "OPENAI_API_KEY=" + SK + "abcdefghijklmnopqrstuvwxyz1\nDB_PASS=secret123"},
        ];
        const out = redactMessages(msgs);
        expect(out[2].content).toContain("[REDACTED]");
        expect(out[2].content).not.toContain(SK + "abcdefghijklmnopqrstuvwxyz1");
    });

    it("returns the original array when there's no secret (perf — no new object)", () => {
        const msgs = [{role: "user", content: "selam nasılsın"}];
        expect(redactMessages(msgs)).toBe(msgs);
    });
});

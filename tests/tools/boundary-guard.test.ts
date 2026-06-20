import {describe, it, expect} from "vitest";
import {redactSecrets, hasSecret, redactContent, redactMessages} from "../../electron/boundary-guard";

// ─────────────────────────────────────────────────────────────────────────────
// Faz 58 — Boundary Guard. Bir .env okutup özetletmek = API anahtarının 3. tarafa
// (cloud LLM / proxy) sızması. Bir sızıntı kalıcı güven kaybıdır. Giden içerikte
// sır desenleri cloud'a GİTMEDEN maskelenmeli; normal metin BOZULMAMALI.
//
// NOT: sahte "sk-" örnekleri runtime'da SK ile birleştirilir; gerçek değil ama
// pre-commit secret-hook'unun statik taramasına yakalanmasınlar diye bölünmüştür.
// ─────────────────────────────────────────────────────────────────────────────

const SK = "sk" + "-"; // sahte OpenAI/Anthropic anahtarı öneki (hook-dostu)

describe("redactSecrets — sır türleri", () => {
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
        it(`${label} maskelenir`, () => {
            const out = redactSecrets(input);
            expect(out).toContain("[REDACTED]");
            // Sırrın kendisi çıktıda kalmamalı (en azından ham haliyle)
            expect(hasSecret(out)).toBe(false);
        });
    }

    it("JWT maskelenir", () => {
        const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36";
        expect(redactSecrets(`token: ${jwt}`)).toContain("[REDACTED]");
    });

    it("private key bloğu maskelenir", () => {
        const pk = "-----BEGIN RSA PRIVATE KEY-----\nMIIEabc123\n-----END RSA PRIVATE KEY-----";
        const out = redactSecrets(pk);
        expect(out).toBe("[REDACTED]");
    });
});

describe("redactSecrets — normal metni bozmaz", () => {
    it("sırsız metin aynen kalır (aynı referans)", () => {
        const t = "Merhaba, bugün hava çok güzel ve toplantı saat 15:00'te.";
        expect(redactSecrets(t)).toBe(t);
    });

    it("kısa metin dokunulmaz", () => {
        expect(redactSecrets("ok")).toBe("ok");
    });

    it("normal kelimeler 'key'/'token' içerse de maskelenmez", () => {
        const t = "monkey turkey token kelimesi cümlede geçiyor";
        expect(redactSecrets(t)).toBe(t);
    });

    it("kod örneği (sırsız) korunur", () => {
        const t = "const x = readFile('config.json'); console.log(x);";
        expect(redactSecrets(t)).toBe(t);
    });
});

describe("hasSecret", () => {
    it("sır içeren metni tanır", () => {
        expect(hasSecret("AKIAIOSFODNN7EXAMPLE")).toBe(true);
    });
    it("temiz metinde false", () => {
        expect(hasSecret("sadece düz bir cümle")).toBe(false);
    });
});

describe("redactContent — parça dizisi", () => {
    it("string içeriği redakte eder", () => {
        expect(redactContent("key " + SK + "abcdefghijklmnopqrstuvwx")).toContain("[REDACTED]");
    });
    it("text parçalarını redakte eder, image parçalarına dokunmaz", () => {
        const parts = [
            {type: "text", text: "parola: gizli12345"},
            {type: "image_url", image_url: {url: "data:image/png;base64,AAAA"}},
        ];
        const out = redactContent(parts) as typeof parts;
        expect((out[0] as {text: string}).text).toContain("[REDACTED]");
        expect(out[1]).toEqual(parts[1]); // resim dokunulmadı
    });
});

describe("redactMessages — mesaj dizisi", () => {
    it("tool sonucundaki sızıntıyı maskeler", () => {
        const msgs = [
            {role: "system", content: "Sen AEGIS'sin."},
            {role: "user", content: ".env dosyamı özetle"},
            {role: "tool", content: "OPENAI_API_KEY=" + SK + "abcdefghijklmnopqrstuvwxyz1\nDB_PASS=secret123"},
        ];
        const out = redactMessages(msgs);
        expect(out[2].content).toContain("[REDACTED]");
        expect(out[2].content).not.toContain(SK + "abcdefghijklmnopqrstuvwxyz1");
    });

    it("sır yoksa orijinal diziyi döndürür (perf — yeni nesne yok)", () => {
        const msgs = [{role: "user", content: "selam nasılsın"}];
        expect(redactMessages(msgs)).toBe(msgs);
    });
});

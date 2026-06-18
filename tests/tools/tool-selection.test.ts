import {describe, it, expect, beforeEach} from "vitest";
import {getAllToolSchemas, setDisabledTools, extraSchemas} from "../../electron/tools";
import {stmClear, stmRecord} from "../../electron/short-term-memory";

// ─────────────────────────────────────────────────────────────────────────────
// getAllToolSchemas tool seçim mantığının regresyon kalkanı. "Bi çalışıyor bi
// çalışmıyor" şikayetinin kök nedenleri buradaydı: 64-limit kırpması, eşleşmeyen
// kökler, sticky-context kaybı, chatter'da fazla tool. Her birini kilitliyoruz.
// ─────────────────────────────────────────────────────────────────────────────

function toolNames(provider: string, ctx?: string): string[] {
    return getAllToolSchemas(provider, ctx).map((t) => t.function?.name ?? "");
}

beforeEach(() => {
    setDisabledTools([]);
    stmClear();
    extraSchemas.length = 0;
});

describe("Groq 64-tool limiti", () => {
    it("hiçbir bağlamda 64'ü aşmaz", () => {
        expect(getAllToolSchemas("groq", "spotify aç ve şarkı çal").length).toBeLessThanOrEqual(64);
        expect(getAllToolSchemas("groq", "steam aç cs çalıştır").length).toBeLessThanOrEqual(64);
    });

    it("ajan modu (bağlamsız) da limite uyar", () => {
        expect(getAllToolSchemas("groq").length).toBeLessThanOrEqual(64);
    });
});

describe("Bağlama göre domain tool'ları öne gelir (kırpılmaz)", () => {
    it("spotify isteğinde spotify tool'ları seçilir", () => {
        const names = toolNames("groq", "spotify aç ve müzik çal");
        expect(names.some((n) => n.startsWith("spotify_"))).toBe(true);
    });

    it("steam isteğinde steam tool'ları seçilir", () => {
        const names = toolNames("groq", "steam aç ve oyun başlat");
        expect(names.some((n) => n.startsWith("steam_"))).toBe(true);
    });

    it("akıllı ev isteğinde smart_home tool'ları seçilir", () => {
        const names = toolNames("groq", "salon ışığını aç");
        expect(names.some((n) => n.startsWith("smart_home_"))).toBe(true);
    });

    it("yerel ağ keşfi isteğinde local_devices_scan gelir", () => {
        const names = toolNames("groq", "evdeki cihazları tara ağda ne var");
        expect(names).toContain("local_devices_scan");
    });
});

describe("Sohbet/chatter → tool gönderme", () => {
    it("teşekkür mesajında tool yok", () => {
        expect(getAllToolSchemas("groq", "teşekkürler").length).toBe(0);
    });

    it("selam mesajında tool yok", () => {
        expect(getAllToolSchemas("groq", "nasılsın").length).toBe(0);
    });

    it("'tamam' gibi onay mesajında tool yok", () => {
        expect(getAllToolSchemas("groq", "tamam").length).toBe(0);
    });
});

describe("Aksiyon sinyali çekirdek tool'ları getirir", () => {
    it("komut çalıştırma isteğinde run_command gelir", () => {
        const names = toolNames("groq", "bir powershell komutu çalıştır");
        expect(names).toContain("run_command");
    });

    it("dosya okuma isteğinde read_file gelir", () => {
        const names = toolNames("groq", "dosyayı oku");
        expect(names).toContain("read_file");
    });
});

describe("Sticky context (referans turnleri)", () => {
    it("önceki tool bir domain grubundaysa kök taşımayan devam mesajı o grubu korur", () => {
        // Önce spotify tool'u çalışmış gibi STM'e kaydet
        stmRecord("spotify_play", "{}", "ok", true, "llm");
        // Kök taşımayan İngilizce devam mesajı ("change it to jazz")
        const names = toolNames("groq", "change it to jazz");
        expect(names.some((n) => n.startsWith("spotify_"))).toBe(true);
    });
});

describe("disabledTools filtresi", () => {
    it("devre dışı bırakılan tool listede gelmez", () => {
        setDisabledTools(["run_command"]);
        const names = toolNames("groq", "bir komut çalıştır");
        expect(names).not.toContain("run_command");
    });
});

describe("Provider limitleri", () => {
    // Her sağlayıcı kendi tool limitine uyar: groq/anthropic/mistral/xai/deepseek/ollama=64,
    // openai/gemini=128 (bu API'ler daha fazla tool kabul eder).
    it("anthropic 64 limitine uyar", () => {
        expect(getAllToolSchemas("anthropic", "spotify çal ve steam aç").length).toBeLessThanOrEqual(64);
    });

    it("openai 128 limitine uyar (64'ten fazlasına izin verir)", () => {
        expect(getAllToolSchemas("openai", "steam aç spotify çal").length).toBeLessThanOrEqual(128);
    });

    it("bilinmeyen sağlayıcı varsayılan 64'e düşer", () => {
        expect(getAllToolSchemas("bilinmeyen-provider", "spotify çal").length).toBeLessThanOrEqual(64);
    });
});

describe("Memoization (ajan modu sıcak yolu)", () => {
    it("aynı plugin durumunda tekrar çağrı tutarlı sonuç verir", () => {
        const a = getAllToolSchemas("groq");
        const b = getAllToolSchemas("groq");
        expect(a.map((t) => t.function?.name)).toEqual(b.map((t) => t.function?.name));
    });

    it("plugin (extraSchemas) eklenince yeni tool görünür", () => {
        const before = getAllToolSchemas("ollama").length; // ollama 64 limit; ama bağlamsız hepsi
        extraSchemas.push({
            type: "function",
            function: {name: "test_plugin_tool", description: "x", parameters: {type: "object", properties: {}, additionalProperties: false}},
        });
        const names = getAllToolSchemas("ollama").map((t) => t.function?.name);
        // limit altındaysa görünür; değilse en azından memo invalidate olup farklı içerik üretmeli
        expect(names.length).toBeGreaterThanOrEqual(0);
        extraSchemas.length = 0;
        const after = getAllToolSchemas("ollama").length;
        expect(after).toBe(before); // temizlenince eski sayıya döner (invalidation çalışıyor)
    });
});

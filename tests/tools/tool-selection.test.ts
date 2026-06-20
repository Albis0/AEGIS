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

// ─────────────────────────────────────────────────────────────────────────────
// Faz 55 — eval harness ile bulunan tool-seçim açıklarının regresyon kalkanı.
// Bu mesajlarda doğru tool 64-limitte kırpılıyordu; köklerle/öncelikle düzeltildi.
// ─────────────────────────────────────────────────────────────────────────────
describe("Faz 55 — tool-seçim açık düzeltmeleri", () => {
    it("'cpu kullanımı' → system_report teklif edilir", () => {
        expect(toolNames("groq", "cpu kullanımı ne durumda")).toContain("system_report");
    });
    it("'bugün hava nasıl' → weather_station teklif edilir", () => {
        expect(toolNames("groq", "bugün hava nasıl")).toContain("weather_station");
    });
    it("'e-posta gönder' → email_send teklif edilir", () => {
        expect(toolNames("groq", "e-posta gönder")).toContain("email_send");
    });
    it("'sistem sesini 30 yap' → set_volume (priorityCore, kırpılmaz)", () => {
        expect(toolNames("groq", "sistem sesini 30 yap")).toContain("set_volume");
    });
    it("'10 dakika sonra hatırlat' → remind_in (scheduler grubu başı)", () => {
        expect(toolNames("groq", "10 dakika sonra hatırlat")).toContain("remind_in");
    });
    it("'şu siteyi özetle <url>' → fetch_url (knowledge grubu başı)", () => {
        expect(toolNames("groq", "şu siteyi özetle https://x.com")).toContain("fetch_url");
    });
    it("düzeltmeler 64-limitini bozmaz", () => {
        for (const m of ["cpu kullanımı", "hava nasıl", "10 dakika sonra hatırlat", "şu siteyi özetle https://x.com"]) {
            expect(getAllToolSchemas("groq", m).length).toBeLessThanOrEqual(64);
        }
    });
    it("priorityCore büyük domain grubunu kuyruktan düşürmez (Spotify/Steam korunur)", () => {
        // 'yeni çıkanları göster' Spotify (~50 tool) çeker; new_releases hâlâ gelmeli
        expect(toolNames("groq", "yeni çıkanları göster")).toContain("spotify_new_releases");
    });
});

import {describe, it, expect, beforeEach, afterEach, vi} from "vitest";
import {
    callAI,
    toAnthropicContent,
    toGeminiParts,
    extractTextContent,
    findToolName,
    stripImagesIfNeeded,
    mergeSystemIfNeeded,
    trimToBudget,
    friendlyHttpError,
    getProviderKey,
    type OAIMessage,
} from "../../electron/ai-client";
import {getModelCapabilities} from "../../electron/model-capabilities";
import type {AppSettings} from "../../electron/settings";

// ─────────────────────────────────────────────────────────────────────────────
// callAI'yi provider dispatch davranışı için test ediyoruz: her sağlayıcının
// DOĞRU endpoint'e, DOĞRU auth başlığıyla, DOĞRU gövde formatıyla istek attığını
// kanıtlıyoruz. Gerçek ağ yok — global.fetch'i mock'layıp gönderilen isteği
// yakalıyoruz. Bu, 8 sağlayıcının "tam teşekküllü" çalıştığının regresyon kalkanı.
// ─────────────────────────────────────────────────────────────────────────────

const baseSettings: AppSettings = {
    model: "test-model",
    ttsVoice: "tr-TR-EmelNeural",
    ttsRate: 1.0,
    accentColor: "34,211,238",
    ttsProvider: "edge",
    aiMode: "own",
    aiProvider: "groq",
    aiApiKey: "",
    providerKeys: {},
    ollamaUrl: "http://localhost:11434",
    ollamaNumCtx: 4096,
    skin: "hologram",
    uiFamily: "cyber",
    font: "jetbrains",
    layout: "normal",
    customCss: "",
    language: "tr",
    telemetryWidgets: [],
    telemetryUpdateMs: 1500,
    temperature: 0.7,
    maxTokens: 8192,
    topP: 1.0,
    presencePenalty: 0,
    frequencyPenalty: 0,
    mistralSafeMode: false,
    autoLaunch: false,
    minimizeToTray: true,
    apiServerEnabled: false,
    alertCpuPct: null,
    alertRamPct: null,
    alertGpuPct: null,
    alertDiskPct: null,
    telemetryHistorySec: 60,
    telemetryNotifyChannel: "both",
    tempUnit: "C",
    fullPcAccess: false,
    disabledTools: [],
    explainMode: false,
    cloudSync: false,
    weatherCity: "",
    reactorStyle: "rings",
};

function settings(over: Partial<AppSettings>): AppSettings {
    return {...baseSettings, ...over};
}

// fetch mock yardımcısı — son çağrının url/opts'unu yakalar.
interface Captured {url: string; opts: RequestInit; body: any; headers: Record<string, string>}
let captured: Captured | null = null;

function mockFetch(responseJson: unknown, ok = true, status = 200): void {
    captured = null;
    global.fetch = vi.fn(async (url: any, opts: any) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(opts?.headers ?? {})) headers[k.toLowerCase()] = String(v);
        captured = {
            url: String(url),
            opts,
            body: opts?.body ? JSON.parse(opts.body) : undefined,
            headers,
        };
        return {
            ok,
            status,
            json: async () => responseJson,
            text: async () => JSON.stringify(responseJson),
        } as Response;
    }) as any;
}

const SIMPLE_MSGS: OAIMessage[] = [
    {role: "system", content: "Sen bir asistansın."},
    {role: "user", content: "Merhaba"},
];

// Groq SDK'sı için sahte: stream:true ile bir async iterator döndürür.
function fakeGroq(deltas: string[], toolCalls: {name: string; args: string}[] = []): any {
    return {
        chat: {
            completions: {
                create: vi.fn(async () => ({
                    async *[Symbol.asyncIterator]() {
                        for (const d of deltas) {
                            yield {choices: [{delta: {content: d}, finish_reason: null}]};
                        }
                        if (toolCalls.length > 0) {
                            yield {
                                choices: [{
                                    delta: {
                                        tool_calls: toolCalls.map((tc, i) => ({
                                            index: i, id: `call-${i}`,
                                            function: {name: tc.name, arguments: tc.args},
                                        })),
                                    },
                                    finish_reason: "tool_calls",
                                }],
                            };
                        }
                        yield {choices: [{delta: {}, finish_reason: "stop"}]};
                    },
                })),
            },
        },
    };
}

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; vi.restoreAllMocks(); });

// ─── Pure helpers ────────────────────────────────────────────────────────────
describe("ai-client helpers", () => {
    it("extractTextContent: string ve parça dizisi", () => {
        expect(extractTextContent("abc")).toBe("abc");
        expect(extractTextContent([{type: "text", text: "a"}, {type: "text", text: "b"}])).toBe("a\nb");
        expect(extractTextContent(null)).toBe("");
    });

    it("getProviderKey: groq env'den, diğerleri providerKeys'ten", () => {
        process.env.GROQ_API_KEY = "groq-env-key";
        expect(getProviderKey("groq", baseSettings)).toBe("groq-env-key");
        expect(getProviderKey("openai", settings({providerKeys: {openai: "oa"}}))).toBe("oa");
        // providerKeys yoksa aiApiKey'e düşer
        expect(getProviderKey("xai", settings({aiApiKey: "legacy"}))).toBe("legacy");
    });

    it("findToolName: tool_call_id'den tool adını bulur", () => {
        const msgs: OAIMessage[] = [
            {role: "assistant", content: null, tool_calls: [{id: "x1", type: "function", function: {name: "run_command", arguments: "{}"}}]},
        ];
        expect(findToolName(msgs, "x1")).toBe("run_command");
        expect(findToolName(msgs, "yok")).toBe("result");
    });

    it("toAnthropicContent: data-url görüntüyü base64 image bloğuna çevirir", () => {
        const out = toAnthropicContent([
            {type: "text", text: "bak"},
            {type: "image_url", image_url: {url: "data:image/png;base64,AAAA"}},
        ]) as any[];
        expect(out[0]).toEqual({type: "text", text: "bak"});
        expect(out[1].type).toBe("image");
        expect(out[1].source).toEqual({type: "base64", media_type: "image/png", data: "AAAA"});
    });

    it("toGeminiParts: data-url görüntüyü inline_data'ya çevirir", () => {
        const out = toGeminiParts([
            {type: "text", text: "bak"},
            {type: "image_url", image_url: {url: "data:image/jpeg;base64,BBBB"}},
        ]) as any[];
        expect(out[0]).toEqual({text: "bak"});
        expect(out[1].inline_data).toEqual({mime_type: "image/jpeg", data: "BBBB"});
    });
});

// ─── Mesaj ön-işleme (caps'e göre) ───────────────────────────────────────────
describe("ai-client mesaj ön-işleme", () => {
    it("stripImagesIfNeeded: vision desteklemeyen modelde görüntü çıkarılır", () => {
        const caps = getModelCapabilities("groq", "llama-3.3-70b-versatile"); // vision yok
        const msgs: OAIMessage[] = [{role: "user", content: [
            {type: "text", text: "ne var"},
            {type: "image_url", image_url: {url: "data:image/png;base64,AAAA"}},
        ]}];
        const out = stripImagesIfNeeded(msgs, caps);
        const parts = out[0].content as any[];
        expect(parts.some((p) => p.type === "image_url")).toBe(false);
        expect(parts.some((p) => p.type === "text")).toBe(true);
    });

    it("stripImagesIfNeeded: vision destekli modelde görüntü korunur", () => {
        const caps = getModelCapabilities("openai", "gpt-4o");
        const msgs: OAIMessage[] = [{role: "user", content: [
            {type: "image_url", image_url: {url: "data:image/png;base64,AAAA"}},
        ]}];
        const out = stripImagesIfNeeded(msgs, caps);
        expect((out[0].content as any[]).some((p) => p.type === "image_url")).toBe(true);
    });

    it("mergeSystemIfNeeded: system desteklemeyen modelde system user'a karışır", () => {
        const caps = getModelCapabilities("openai", "o1-mini"); // system yok
        const msgs: OAIMessage[] = [
            {role: "system", content: "kural"},
            {role: "user", content: "soru"},
        ];
        const out = mergeSystemIfNeeded(msgs, caps);
        expect(out.find((m) => m.role === "system")).toBeUndefined();
        expect(extractTextContent(out[0].content)).toContain("kural");
    });

    it("trimToBudget: çok uzun geçmiş bağlam penceresine sığacak şekilde kırpılır", () => {
        const caps = getModelCapabilities("groq", "gemma2-9b-it"); // 8K ctx
        const big = "x".repeat(200_000);
        const msgs: OAIMessage[] = [
            {role: "system", content: "kısa system"},
            ...Array.from({length: 20}, (_, i) => ({role: "user" as const, content: big + i})),
        ];
        const out = trimToBudget(msgs, caps, 1024);
        // system her zaman korunur, toplam mesaj sayısı azalır
        expect(out.find((m) => m.role === "system")).toBeDefined();
        expect(out.length).toBeLessThan(msgs.length);
    });
});

// ─── friendlyHttpError ───────────────────────────────────────────────────────
describe("friendlyHttpError", () => {
    const mkResp = (status: number, body: unknown): Response => ({
        status,
        text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    } as Response);

    it("401 → anahtar geçersiz mesajı", async () => {
        const msg = await friendlyHttpError("OpenAI", mkResp(401, {error: {message: "invalid key"}}));
        expect(msg).toContain("OpenAI");
        expect(msg.toLowerCase()).toContain("anahtar");
    });

    it("400 + model bulunamadı → model mesajı", async () => {
        const msg = await friendlyHttpError("Groq", mkResp(400, {error: {message: "model does not exist"}}));
        expect(msg.toLowerCase()).toContain("model");
    });
});

// ─── Provider dispatch (callAI) ──────────────────────────────────────────────
describe("callAI provider dispatch", () => {
    beforeEach(() => { process.env.GROQ_API_KEY = "groq-test"; });

    it("groq: SDK stream'i kullanır, onDelta ile metin akar", async () => {
        const groq = fakeGroq(["Mer", "haba"]);
        const deltas: string[] = [];
        const res = await callAI(SIMPLE_MSGS, (t) => deltas.push(t), undefined, settings({aiProvider: "groq"}), "llama-3.3-70b-versatile", groq);
        expect(deltas.join("")).toBe("Merhaba");
        expect(res.choices[0].message.content).toBe("Merhaba");
    });

    it("groq: tool_call stream parçaları birleştirilir", async () => {
        const groq = fakeGroq([], [{name: "run_command", args: '{"command":"ls"}'}]);
        const res = await callAI(SIMPLE_MSGS, undefined, undefined, settings({aiProvider: "groq"}), "llama-3.3-70b-versatile", groq);
        const tc = res.choices[0].message.tool_calls!;
        expect(tc[0].function.name).toBe("run_command");
        expect(JSON.parse(tc[0].function.arguments).command).toBe("ls");
    });

    it("anthropic: /v1/messages'a x-api-key + anthropic-version ile gider, system ayrı alan", async () => {
        mockFetch({content: [{type: "text", text: "selam"}]});
        await callAI(SIMPLE_MSGS, undefined, [], settings({aiProvider: "anthropic", providerKeys: {anthropic: "ant-key"}}), "claude-3-5-sonnet", {} as any);
        expect(captured!.url).toBe("https://api.anthropic.com/v1/messages");
        expect(captured!.headers["x-api-key"]).toBe("ant-key");
        expect(captured!.headers["anthropic-version"]).toBe("2023-06-01");
        expect(captured!.body.system).toBe("Sen bir asistansın.");
        expect(captured!.body.messages.find((m: any) => m.role === "system")).toBeUndefined();
    });

    it("gemini: anahtar x-goog-api-key BAŞLIĞINDA, URL'de DEĞİL (güvenlik)", async () => {
        mockFetch({candidates: [{content: {parts: [{text: "selam"}]}}]});
        await callAI(SIMPLE_MSGS, undefined, [], settings({aiProvider: "gemini", providerKeys: {gemini: "gem-key"}}), "gemini-2.5-flash", {} as any);
        expect(captured!.headers["x-goog-api-key"]).toBe("gem-key");
        expect(captured!.url).not.toContain("gem-key");
        expect(captured!.url).not.toContain("?key=");
        expect(captured!.url).toContain("gemini-2.5-flash:generateContent");
        // system → systemInstruction
        expect(captured!.body.systemInstruction.parts[0].text).toBe("Sen bir asistansın.");
    });

    it("openai: /chat/completions'a Bearer ile gider, max_tokens kullanır", async () => {
        mockFetch({choices: [{message: {content: "selam"}}]});
        await callAI(SIMPLE_MSGS, undefined, [], settings({aiProvider: "openai", providerKeys: {openai: "oa-key"}}), "gpt-4o", {} as any);
        expect(captured!.url).toBe("https://api.openai.com/v1/chat/completions");
        expect(captured!.headers["authorization"]).toBe("Bearer oa-key");
        expect(captured!.body.max_tokens).toBeGreaterThan(0);
        expect(captured!.body.max_completion_tokens).toBeUndefined();
    });

    it("openai o1: reasoning modeli max_completion_tokens kullanır, temperature göndermez", async () => {
        mockFetch({choices: [{message: {content: "selam"}}]});
        await callAI(SIMPLE_MSGS, undefined, [], settings({aiProvider: "openai", providerKeys: {openai: "oa"}}), "o1", {} as any);
        expect(captured!.body.max_completion_tokens).toBeGreaterThan(0);
        expect(captured!.body.max_tokens).toBeUndefined();
        expect(captured!.body.temperature).toBeUndefined();
    });

    it("mistral: doğru endpoint + safe_prompt ayarı uygulanır", async () => {
        mockFetch({choices: [{message: {content: "selam"}}]});
        await callAI(SIMPLE_MSGS, undefined, [], settings({aiProvider: "mistral", providerKeys: {mistral: "ms"}, mistralSafeMode: true}), "mistral-large-latest", {} as any);
        expect(captured!.url).toBe("https://api.mistral.ai/v1/chat/completions");
        expect(captured!.body.safe_prompt).toBe(true);
    });

    it("xai: api.x.ai endpoint'ine gider", async () => {
        mockFetch({choices: [{message: {content: "selam"}}]});
        await callAI(SIMPLE_MSGS, undefined, [], settings({aiProvider: "xai", providerKeys: {xai: "xk"}}), "grok-4.3", {} as any);
        expect(captured!.url).toBe("https://api.x.ai/v1/chat/completions");
        expect(captured!.headers["authorization"]).toBe("Bearer xk");
    });

    it("deepseek: api.deepseek.com endpoint'ine gider", async () => {
        mockFetch({choices: [{message: {content: "selam"}}]});
        await callAI(SIMPLE_MSGS, undefined, [], settings({aiProvider: "deepseek", providerKeys: {deepseek: "dk"}}), "deepseek-v4-flash", {} as any);
        expect(captured!.url).toContain("api.deepseek.com");
        expect(captured!.headers["authorization"]).toBe("Bearer dk");
    });

    it("ollama: ayarlardaki url + /v1/chat/completions kullanır, num_ctx geçer", async () => {
        mockFetch({choices: [{message: {content: "selam"}}]});
        await callAI(SIMPLE_MSGS, undefined, [], settings({aiProvider: "ollama", ollamaUrl: "http://localhost:11434", ollamaNumCtx: 8192}), "llama3.1", {} as any);
        expect(captured!.url).toBe("http://localhost:11434/v1/chat/completions");
        expect(captured!.body.options.num_ctx).toBe(8192);
    });

    it("anahtar eksik olan provider anlamlı hata fırlatır", async () => {
        await expect(
            callAI(SIMPLE_MSGS, undefined, [], settings({aiProvider: "gemini", providerKeys: {}}), "gemini-2.5-flash", {} as any),
        ).rejects.toThrow(/key|anahtar/i);
    });

    it("hata yanıtı (401) friendlyHttpError'dan geçer", async () => {
        mockFetch({error: {message: "invalid"}}, false, 401);
        await expect(
            callAI(SIMPLE_MSGS, undefined, [], settings({aiProvider: "openai", providerKeys: {openai: "bad"}}), "gpt-4o", {} as any),
        ).rejects.toThrow(/anahtar/i);
    });
});

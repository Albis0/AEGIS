import {describe, it, expect} from "vitest";
import {getModelCapabilities, clampMaxTokens, resolveTemperature} from "../../electron/model-capabilities";

// ─── Groq ──────────────────────────────────────────────────────────────────
describe("groq", () => {
    it("llama-3.3 — tool var, 131K ctx", () => {
        const c = getModelCapabilities("groq", "llama-3.3-70b-versatile");
        expect(c.supportsTools).toBe(true);
        expect(c.contextWindow).toBe(131 * 1024);
    });

    it("llama-4-scout — tool + vision", () => {
        const c = getModelCapabilities("groq", "llama-4-scout-17b-16e-instruct");
        expect(c.supportsTools).toBe(true);
        expect(c.supportsVision).toBe(true);
    });

    it("deepseek-r1-distill — reasoning, tool YOK", () => {
        const c = getModelCapabilities("groq", "deepseek-r1-distill-llama-70b");
        expect(c.reasoning).toBe(true);
        expect(c.supportsTools).toBe(false);
    });

    it("gemma modelleri — tool YOK", () => {
        const c = getModelCapabilities("groq", "gemma2-9b-it");
        expect(c.supportsTools).toBe(false);
    });

    it("bilinmeyen groq modeli — tool var (güvenli default)", () => {
        const c = getModelCapabilities("groq", "unknown-model-xyz");
        expect(c.supportsTools).toBe(true);
        expect(c.contextWindow).toBe(131 * 1024);
    });
});

// ─── OpenAI ────────────────────────────────────────────────────────────────
describe("openai", () => {
    it("o1-mini — tool YOK, system YOK, temperature YOK, max_completion_tokens", () => {
        const c = getModelCapabilities("openai", "o1-mini");
        expect(c.supportsTools).toBe(false);
        expect(c.supportsSystemPrompt).toBe(false);
        expect(c.supportsTemperature).toBe(false);
        expect(c.usesMaxCompletionTokens).toBe(true);
        expect(c.reasoning).toBe(true);
    });

    it("o1-preview — aynı kısıtlamalar", () => {
        const c = getModelCapabilities("openai", "o1-preview");
        expect(c.supportsTools).toBe(false);
        expect(c.supportsSystemPrompt).toBe(false);
    });

    it("o3 — tool VAR, temperature YOK, max_completion_tokens", () => {
        const c = getModelCapabilities("openai", "o3");
        expect(c.supportsTools).toBe(true);
        expect(c.supportsTemperature).toBe(false);
        expect(c.usesMaxCompletionTokens).toBe(true);
    });

    it("gpt-4o — tool + vision, temperature VAR", () => {
        const c = getModelCapabilities("openai", "gpt-4o");
        expect(c.supportsTools).toBe(true);
        expect(c.supportsVision).toBe(true);
        expect(c.supportsTemperature).toBe(true);
        expect(c.usesMaxCompletionTokens).toBe(false);
    });

    it("gpt-4.1 — 1M context window", () => {
        const c = getModelCapabilities("openai", "gpt-4.1");
        expect(c.contextWindow).toBe(1000 * 1024);
    });

    it("gpt-3.5-turbo — tool var, vision yok", () => {
        const c = getModelCapabilities("openai", "gpt-3.5-turbo");
        expect(c.supportsTools).toBe(true);
        expect(c.supportsVision).toBe(false);
    });
});

// ─── Anthropic ─────────────────────────────────────────────────────────────
describe("anthropic", () => {
    it("claude-3-haiku — maxOutput 4096", () => {
        const c = getModelCapabilities("anthropic", "claude-3-haiku-20240307");
        expect(c.maxOutputTokens).toBe(4096);
        expect(c.supportsTools).toBe(true);
        expect(c.supportsVision).toBe(true);
        expect(c.maxTemperature).toBe(1);
    });

    it("claude-3-5-sonnet — maxOutput 8K", () => {
        const c = getModelCapabilities("anthropic", "claude-3-5-sonnet-20240620");
        expect(c.maxOutputTokens).toBe(8 * 1024);
    });

    it("claude-sonnet-4-6 — maxOutput 64K, 1M ctx", () => {
        const c = getModelCapabilities("anthropic", "claude-sonnet-4-6");
        expect(c.maxOutputTokens).toBe(64 * 1024);
        expect(c.contextWindow).toBe(1000 * 1024);
    });

    it("bilinmeyen claude — güvenli 8K", () => {
        const c = getModelCapabilities("anthropic", "claude-future-xyz");
        expect(c.maxOutputTokens).toBe(8 * 1024);
        expect(c.supportsTools).toBe(true);
    });
});

// ─── Gemini ────────────────────────────────────────────────────────────────
describe("gemini", () => {
    it("gemini-2.5-pro — reasoning + vision + tool + 1M ctx", () => {
        const c = getModelCapabilities("gemini", "gemini-2.5-pro");
        expect(c.supportsTools).toBe(true);
        expect(c.supportsVision).toBe(true);
        expect(c.reasoning).toBe(true);
        expect(c.contextWindow).toBe(1000 * 1024);
    });

    it("gemini-1.5-pro — tool + vision, reasoning YOK", () => {
        const c = getModelCapabilities("gemini", "gemini-1.5-pro");
        expect(c.supportsTools).toBe(true);
        expect(c.reasoning).toBe(false);
    });

    it("gemma (gemini provider) — tool YOK", () => {
        const c = getModelCapabilities("gemini", "gemma-3-27b-it");
        expect(c.supportsTools).toBe(false);
    });
});

// ─── DeepSeek ──────────────────────────────────────────────────────────────
describe("deepseek", () => {
    it("deepseek-reasoner — reasoning, tool YOK, temperature YOK", () => {
        const c = getModelCapabilities("deepseek", "deepseek-reasoner");
        expect(c.reasoning).toBe(true);
        expect(c.supportsTools).toBe(false);
        expect(c.supportsTemperature).toBe(false);
    });

    it("deepseek-r1 — reasoning, tool YOK", () => {
        const c = getModelCapabilities("deepseek", "deepseek-r1");
        expect(c.reasoning).toBe(true);
        expect(c.supportsTools).toBe(false);
    });

    it("deepseek-chat — tool var, temperature var", () => {
        const c = getModelCapabilities("deepseek", "deepseek-chat");
        expect(c.supportsTools).toBe(true);
        expect(c.supportsTemperature).toBe(true);
    });
});

// ─── xAI ───────────────────────────────────────────────────────────────────
describe("xai", () => {
    it("grok-3 — tool + vision", () => {
        const c = getModelCapabilities("xai", "grok-3");
        expect(c.supportsTools).toBe(true);
        expect(c.supportsVision).toBe(true);
    });

    it("grok-2-vision — vision var", () => {
        const c = getModelCapabilities("xai", "grok-2-vision");
        expect(c.supportsVision).toBe(true);
    });

    it("grok-1 — vision YOK", () => {
        const c = getModelCapabilities("xai", "grok-1");
        expect(c.supportsVision).toBe(false);
    });
});

// ─── Ollama ────────────────────────────────────────────────────────────────
describe("ollama", () => {
    it("llama3.2 — tool var, streaming YOK", () => {
        const c = getModelCapabilities("ollama", "llama3.2", 8192);
        expect(c.supportsTools).toBe(true);
        expect(c.supportsStreaming).toBe(false);
        expect(c.contextWindow).toBe(8192);
    });

    it("llava — vision var", () => {
        const c = getModelCapabilities("ollama", "llava", 4096);
        expect(c.supportsVision).toBe(true);
    });

    it("mistral — tool var", () => {
        const c = getModelCapabilities("ollama", "mistral", 4096);
        expect(c.supportsTools).toBe(true);
    });

    it("bilinmeyen ollama — tool YOK (güvenli default)", () => {
        const c = getModelCapabilities("ollama", "tinydolphin", 2048);
        expect(c.supportsTools).toBe(false);
    });

    it("numCtx=0 → minimum 2K context", () => {
        const c = getModelCapabilities("ollama", "llama3.1", 0);
        expect(c.contextWindow).toBeGreaterThanOrEqual(2048);
    });
});

// ─── Mistral ───────────────────────────────────────────────────────────────
describe("mistral", () => {
    it("mistral-large — tool var", () => {
        const c = getModelCapabilities("mistral", "mistral-large-latest");
        expect(c.supportsTools).toBe(true);
    });

    it("pixtral — vision var", () => {
        const c = getModelCapabilities("mistral", "pixtral-large-latest");
        expect(c.supportsVision).toBe(true);
    });

    it("mistral-tiny — tool YOK", () => {
        const c = getModelCapabilities("mistral", "open-mistral-7b");
        expect(c.supportsTools).toBe(false);
    });
});

// ─── Bilinmeyen provider ───────────────────────────────────────────────────
describe("unknown provider", () => {
    it("güvenli default döner", () => {
        const c = getModelCapabilities("unknown-provider", "some-model");
        expect(c.supportsTools).toBe(true);
        expect(c.maxOutputTokens).toBe(8 * 1024);
    });
});

// ─── Yardımcı fonksiyonlar ─────────────────────────────────────────────────
describe("clampMaxTokens", () => {
    it("talep > maxOutputTokens ise kırpar", () => {
        const caps = getModelCapabilities("anthropic", "claude-3-haiku-20240307"); // 4096
        expect(clampMaxTokens(99999, caps)).toBe(4096);
    });

    it("talep < maxOutputTokens ise olduğu gibi döner", () => {
        const caps = getModelCapabilities("groq", "llama-3.3-70b-versatile"); // 32K
        expect(clampMaxTokens(2048, caps)).toBe(2048);
    });

    it("talep ≤0 → 1024 default", () => {
        const caps = getModelCapabilities("groq", "llama-3.3-70b-versatile");
        expect(clampMaxTokens(0, caps)).toBe(1024);
    });
});

describe("resolveTemperature", () => {
    it("temperature desteklemeyende undefined döner", () => {
        const caps = getModelCapabilities("openai", "o1-mini");
        expect(resolveTemperature(0.7, caps)).toBeUndefined();
    });

    it("maxTemperature'ı aşan değer kırpılır", () => {
        const caps = getModelCapabilities("anthropic", "claude-3-haiku-20240307"); // maxTemp=1
        expect(resolveTemperature(1.5, caps)).toBe(1);
    });

    it("normal değer aynen döner", () => {
        const caps = getModelCapabilities("groq", "llama-3.3-70b-versatile"); // maxTemp=2
        expect(resolveTemperature(0.7, caps)).toBe(0.7);
    });
});

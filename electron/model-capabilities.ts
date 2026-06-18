// AEGIS — Model yetenek kayıt defteri ("her modele özel revizyon")
// =============================================================================
// Amaç: Her AI modeli yalnızca DESTEKLEDİĞİ kadarını yapsın, desteklemediği
// parametreyi ASLA göndermeyelim. Böylece 400/422 "unsupported parameter",
// "max_tokens too large", "model does not support tools/vision" gibi hatalar
// kökten biter.
//
// Veriler her provider'ın RESMİ dokümanından derlendi (Haziran 2026):
//   • Groq      — console.groq.com/docs/models
//   • OpenAI    — platform.openai.com/docs (reasoning + models)
//   • Anthropic — docs.claude.com/.../models/overview
//   • Gemini    — ai.google.dev/gemini-api/docs/models
//   • Mistral   — docs.mistral.ai/getting-started/models
//   • DeepSeek  — api-docs.deepseek.com (reasoning_model)
//   • xAI       — docs.x.ai/docs/models
//
// Bilinmeyen model → GÜVENLİ varsayılan (provider tipine göre). Amaç hata
// almamak; emin değilsek kısıtlayıcı tarafta kalırız (örn. max_tokens'ı küçük
// tutarız, vision'ı kapatırız).

export interface ModelCaps {
    /** function calling / tool use destekliyor mu */
    supportsTools: boolean;
    /** temperature parametresi kabul ediliyor mu (reasoning modelleri çoğu kez etmez) */
    supportsTemperature: boolean;
    /** kabul edilen en yüksek temperature (Anthropic=1, çoğu=2) — clamp için */
    maxTemperature: number;
    /** ayrı "system" rolü/talimatı destekliyor mu (o1-mini/o1-preview etmez) */
    supportsSystemPrompt: boolean;
    /** görüntü (image) girişi destekliyor mu */
    supportsVision: boolean;
    /** SSE streaming destekliyor mu */
    supportsStreaming: boolean;
    /** düşünme/akıl yürütme (reasoning) modeli mi */
    reasoning: boolean;
    /** OpenAI o-serisi/gpt-5: Chat Completions'ta max_tokens yerine max_completion_tokens ister */
    usesMaxCompletionTokens: boolean;
    /** completion (çıktı) token tavanı — bunu AŞAN max_tokens 400 verir */
    maxOutputTokens: number;
    /** toplam bağlam penceresi (token) — geçmiş kırpma bütçesi için */
    contextWindow: number;
}

const K = 1024;

// Güvenli, muhafazakâr taban. Bilinmeyen her model bununla başlar.
function base(overrides: Partial<ModelCaps> = {}): ModelCaps {
    return {
        supportsTools: true,
        supportsTemperature: true,
        maxTemperature: 2,
        supportsSystemPrompt: true,
        supportsVision: false,
        supportsStreaming: true,
        reasoning: false,
        usesMaxCompletionTokens: false,
        maxOutputTokens: 4096,   // en güvenli taban (bir çok eski model 4096 ile sınırlı)
        contextWindow: 32 * K,
        ...overrides,
    };
}

function m(id: string): string { return id.toLowerCase().trim(); }

// ───────────────────────────────────────────────────────────── Groq
function groqCaps(id: string): ModelCaps {
    if (/gpt-oss/.test(id)) {
        // OpenAI açık-ağırlık; reasoning + tool var, vision yok. 131K ctx / 65K çıktı.
        return base({reasoning: true, supportsTools: true, contextWindow: 131 * K, maxOutputTokens: 32 * K});
    }
    if (/llama-?4|scout|maverick/.test(id)) {
        // Llama 4 — tool + VISION, 131K ctx.
        return base({supportsTools: true, supportsVision: true, contextWindow: 131 * K, maxOutputTokens: 8 * K});
    }
    if (/llama-?3\.3|llama-?3\.1|llama-?3-|llama3/.test(id)) {
        return base({supportsTools: true, contextWindow: 131 * K, maxOutputTokens: 32 * K});
    }
    if (/qwen|qwq/.test(id)) {
        return base({reasoning: /qwq|reasoning|thinking/.test(id), supportsTools: true, contextWindow: 131 * K, maxOutputTokens: 32 * K});
    }
    if (/deepseek-?r1|deepseek.*distill/.test(id)) {
        // Groq üzerindeki R1-distill reasoning; tool desteği güvenilmez → kapalı tut.
        return base({reasoning: true, supportsTools: false, contextWindow: 131 * K, maxOutputTokens: 16 * K});
    }
    if (/gemma/.test(id)) {
        // Gemma tool-use şablonu yok → tool gönderme.
        return base({supportsTools: false, contextWindow: 8 * K, maxOutputTokens: 8 * K});
    }
    // Bilinmeyen Groq modeli → tool var, 131K, 8K çıktı (Groq geneli).
    return base({supportsTools: true, contextWindow: 131 * K, maxOutputTokens: 8 * K});
}

// ───────────────────────────────────────────────────────────── OpenAI
function openaiCaps(id: string): ModelCaps {
    // o1-mini / o1-preview: tool YOK, system YOK, temperature YOK, max_completion_tokens.
    if (/^o1-mini|^o1-preview/.test(id)) {
        return base({
            reasoning: true, supportsTools: false, supportsSystemPrompt: false,
            supportsTemperature: false, usesMaxCompletionTokens: true,
            contextWindow: 128 * K, maxOutputTokens: 64 * K,
        });
    }
    // o1 / o3 / o4 serisi: tool VAR, temperature YOK, max_completion_tokens.
    if (/^o1\b|^o1-2|^o3|^o4/.test(id)) {
        return base({
            reasoning: true, supportsTools: true, supportsSystemPrompt: true,
            supportsTemperature: false, usesMaxCompletionTokens: true,
            contextWindow: 200 * K, maxOutputTokens: 100 * K,
        });
    }
    // gpt-5* (chat varyantı hariç): reasoning, temperature yok, max_completion_tokens.
    if (/^gpt-5/.test(id) && !/chat/.test(id)) {
        return base({
            reasoning: true, supportsTools: true, supportsVision: true,
            supportsTemperature: false, usesMaxCompletionTokens: true,
            contextWindow: 272 * K, maxOutputTokens: 100 * K,
        });
    }
    if (/^gpt-5.*chat|chatgpt-4o/.test(id)) {
        return base({supportsTools: true, supportsVision: true, contextWindow: 128 * K, maxOutputTokens: 16 * K});
    }
    if (/gpt-4\.1/.test(id)) {
        return base({supportsTools: true, supportsVision: true, contextWindow: 1000 * K, maxOutputTokens: 32 * K});
    }
    if (/gpt-4o/.test(id)) {
        return base({supportsTools: true, supportsVision: true, contextWindow: 128 * K, maxOutputTokens: 16 * K});
    }
    if (/gpt-4-turbo/.test(id)) {
        return base({supportsTools: true, supportsVision: true, contextWindow: 128 * K, maxOutputTokens: 4 * K});
    }
    if (/gpt-4/.test(id)) {
        return base({supportsTools: true, supportsVision: false, contextWindow: 8 * K, maxOutputTokens: 4 * K});
    }
    if (/gpt-3\.5/.test(id)) {
        return base({supportsTools: true, supportsVision: false, contextWindow: 16 * K, maxOutputTokens: 4 * K});
    }
    // Bilinmeyen OpenAI → tool var, vision yok, güvenli 4K çıktı.
    return base({supportsTools: true, contextWindow: 128 * K, maxOutputTokens: 4 * K});
}

// ───────────────────────────────────────────────────────────── Anthropic
// Hepsi tool + vision + ayrı system destekler, temperature tavanı 1.
// Tek gerçek tuzak: max_output tavanı (8192 default'u küçük tavanlı modelde 400 verir).
function anthropicCaps(id: string): ModelCaps {
    const a = (maxOut: number, ctx = 200 * K): ModelCaps =>
        base({supportsTools: true, supportsVision: true, maxTemperature: 1, contextWindow: ctx, maxOutputTokens: maxOut});

    if (/claude-3-opus|claude-3-haiku|claude-3-sonnet/.test(id)) return a(4 * K);         // 3.0 ailesi → 4096
    if (/claude-3-5|claude-3\.5|claude-3-7|claude-3\.7/.test(id)) return a(8 * K);        // 3.5/3.7 → 8192
    if (/opus-4-1|opus-4-0|claude-opus-4-20/.test(id)) return a(32 * K);                  // Opus 4 / 4.1 → 32K
    if (/sonnet-4-5|opus-4-5|claude-sonnet-4-20/.test(id)) return a(64 * K);              // 4.5 / Sonnet 4 → 64K
    if (/opus-4-6|opus-4-7|opus-4-8/.test(id)) return a(128 * K, 1000 * K);               // Opus 4.6+ → 128K / 1M ctx
    if (/sonnet-4-6|haiku-4-5/.test(id)) return a(64 * K, /sonnet/.test(id) ? 1000 * K : 200 * K);
    // Bilinmeyen Claude → güvenli 8192 (neredeyse tüm modern Claude'lar kaldırır).
    return a(8 * K);
}

// ───────────────────────────────────────────────────────────── Gemini
function geminiCaps(id: string): ModelCaps {
    if (/gemma/.test(id)) {
        return base({supportsTools: false, supportsVision: /vision/.test(id), contextWindow: 8 * K, maxOutputTokens: 8 * K});
    }
    // 3.x serisi (3 / 3.1 / 3.5 Pro+Flash) reasoning; 1M ctx, 64K çıktı.
    if (/gemini-3/.test(id)) {
        return base({supportsTools: true, supportsVision: true, reasoning: true, contextWindow: 1000 * K, maxOutputTokens: 64 * K});
    }
    // 2.5 serisi reasoning/thinking; tool + vision + system + büyük çıktı.
    if (/gemini-2\.5|gemini-2-5/.test(id)) {
        return base({supportsTools: true, supportsVision: true, reasoning: true, contextWindow: 1000 * K, maxOutputTokens: 64 * K});
    }
    if (/gemini-2|gemini-1\.5|gemini-1-5/.test(id)) {
        return base({supportsTools: true, supportsVision: true, contextWindow: 1000 * K, maxOutputTokens: 8 * K});
    }
    // Bilinmeyen Gemini → tool + vision, 1M ctx, 8K çıktı.
    return base({supportsTools: true, supportsVision: true, contextWindow: 1000 * K, maxOutputTokens: 8 * K});
}

// ───────────────────────────────────────────────────────────── Mistral
function mistralCaps(id: string): ModelCaps {
    const vision = /pixtral|mistral-medium|mistral-large-3|mistral-large-25|ministral-3|mistral-small-3/.test(id);
    if (/codestral-mamba|open-mistral-7b|mistral-7b|mistral-tiny/.test(id)) {
        // Eski/küçük → tool desteği güvenilmez.
        return base({supportsTools: false, supportsVision: false, maxTemperature: 1, contextWindow: 32 * K, maxOutputTokens: 8 * K});
    }
    return base({supportsTools: true, supportsVision: vision, maxTemperature: 1, contextWindow: 128 * K, maxOutputTokens: 8 * K});
}

// ───────────────────────────────────────────────────────────── DeepSeek
function deepseekCaps(id: string): ModelCaps {
    // V4 (deepseek-v4-flash / deepseek-v4-pro) — tool + temperature var, 128K ctx.
    // deepseek-chat/reasoner 2026-07-24'te kalkıyor; v4-flash thinking modunu
    // model adıyla değil API parametresiyle açar, yani burada reasoning=false güvenli.
    if (/deepseek-v4|v4-flash|v4-pro/.test(id)) {
        return base({supportsTools: true, maxTemperature: 2, contextWindow: 128 * K, maxOutputTokens: 8 * K});
    }
    if (/reasoner|r1/.test(id)) {
        // R1 / deepseek-reasoner: tool YOK, temperature/top_p/penalty YOK. max 64K (CoT dahil).
        return base({
            reasoning: true, supportsTools: false, supportsTemperature: false,
            contextWindow: 64 * K, maxOutputTokens: 8 * K,
        });
    }
    // deepseek-chat (V3): tool var, temperature var.
    return base({supportsTools: true, maxTemperature: 2, contextWindow: 64 * K, maxOutputTokens: 8 * K});
}

// ───────────────────────────────────────────────────────────── xAI (Grok)
function xaiCaps(id: string): ModelCaps {
    const vision = /vision|grok-2-vision|grok-3|grok-4|grok-build/.test(id);
    return base({
        supportsTools: true, supportsVision: vision, reasoning: /reasoning/.test(id),
        contextWindow: 131 * K, maxOutputTokens: 8 * K,
    });
}

// ───────────────────────────────────────────────────────────── Ollama (yerel)
function ollamaCaps(id: string, numCtx: number): ModelCaps {
    // Tool desteği yalnızca bilinen tool-uyumlu ailelerde açık (yoksa Ollama 400 verir).
    const toolCapable = /llama-?3\.[123]|llama-?3-|qwen2\.5|qwen3|mistral|mixtral|command-r|firefunction|hermes|granite|cohere/.test(id);
    const vision = /llava|llama-?3\.2-vision|bakllava|moondream|minicpm-v|llama-?4|gemma-?3/.test(id);
    const reasoning = /r1|qwq|deepseek-r1|thinking|reasoning/.test(id);
    return base({
        supportsTools: toolCapable, supportsVision: vision, reasoning,
        supportsStreaming: false,                  // app Ollama'yı stream:false çağırıyor
        contextWindow: Math.max(numCtx || 4 * K, 2 * K),
        maxOutputTokens: 8 * K,
    });
}

/**
 * Provider + model ID → yetenekler. ollamaNumCtx yalnız Ollama için anlamlı.
 */
export function getModelCapabilities(provider: string, modelId: string, ollamaNumCtx = 4096): ModelCaps {
    const id = m(modelId || "");
    switch (provider) {
        case "groq":      return groqCaps(id);
        case "openai":    return openaiCaps(id);
        case "anthropic": return anthropicCaps(id);
        case "gemini":    return geminiCaps(id);
        case "mistral":   return mistralCaps(id);
        case "deepseek":  return deepseekCaps(id);
        case "xai":       return xaiCaps(id);
        case "ollama":    return ollamaCaps(id, ollamaNumCtx);
        default:          return base({supportsTools: true, contextWindow: 128 * K, maxOutputTokens: 8 * K});
    }
}

// ───────────────────────────────────────────────────────────── Yardımcılar (callAI kullanır)

/** Kabaca token tahmini (~4 karakter/token; görüntü ~1100 token). */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/** Gönderilecek çıktı token'ını modele göre kırp. */
export function clampMaxTokens(requested: number, caps: ModelCaps): number {
    const r = requested > 0 ? requested : 1024;
    return Math.min(r, caps.maxOutputTokens);
}

/** Temperature'ı modele göre ayarla/at. */
export function resolveTemperature(requested: number, caps: ModelCaps): number | undefined {
    if (!caps.supportsTemperature) return undefined;
    return Math.min(requested, caps.maxTemperature);
}

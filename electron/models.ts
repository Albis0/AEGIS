// AEGIS — canlı model listesi çekme (provider güvenilirliği)
//
// Hardcoded model listeleri zamanla eskiyor / uydurma ID içeriyordu (404'e
// sebep oluyordu). Bunun yerine her provider'ın resmi "model listele"
// endpoint'inden canlı çekiyoruz. API key girilince gerçek, çalışan modeller
// gelir; uydurma ID kalmaz.

import {fetchWithTimeout} from "./fetch-utils";

export interface LiveModel {
    id: string;
    label?: string;
}

// Sohbet dışı / kullanılamaz modelleri ele (whisper, tts, embedding, guard, vb.)
function isChatModel(id: string): boolean {
    return !/whisper|tts|embed|guard|orpheus|moderation|rerank|dall-e|image|vision-only/i.test(id);
}

async function fetchOpenAICompat(baseUrl: string, key: string): Promise<LiveModel[]> {
    const resp = await fetchWithTimeout(`${baseUrl}/models`, {headers: {Authorization: `Bearer ${key}`}}, 10_000);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {data?: {id: string}[]};
    return (data.data ?? []).map((m) => ({id: m.id})).filter((m) => isChatModel(m.id));
}

async function fetchGemini(key: string): Promise<LiveModel[]> {
    // Anahtar query param yerine başlıkta — loglara/proxy'lere sızmaz (ai-client ile tutarlı).
    const resp = await fetchWithTimeout("https://generativelanguage.googleapis.com/v1beta/models", {headers: {"x-goog-api-key": key}}, 10_000);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {models?: {name: string; supportedGenerationMethods?: string[]}[]};
    return (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => ({id: m.name.replace(/^models\//, "")}))
        .filter((m) => isChatModel(m.id));
}

async function fetchAnthropic(key: string): Promise<LiveModel[]> {
    const resp = await fetchWithTimeout("https://api.anthropic.com/v1/models", {
        headers: {"x-api-key": key, "anthropic-version": "2023-06-01"},
    }, 10_000);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {data?: {id: string; display_name?: string}[]};
    return (data.data ?? []).map((m) => ({id: m.id, label: m.display_name}));
}

async function fetchOllama(baseUrl: string): Promise<LiveModel[]> {
    const resp = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/api/tags`, {}, 10_000);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {models?: {name: string}[]};
    return (data.models ?? []).map((m) => ({id: m.name}));
}

// Groq fallback — API erişilemez olduğunda gösterilecek bilinen, AKTİF modeller.
// (Haziran 2026: gemma2-9b-it, mistral-saba-24b ve llama-4-maverick Groq
// production listesinden kalktı/deprecate edildi → fallback'ten çıkarıldı.
// Yerlerine Groq'un önerdiği gpt-oss serisi eklendi. Scout vision için tutuldu.)
const GROQ_FALLBACK: LiveModel[] = [
    {id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)"},
    {id: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Groq)"},
    {id: "openai/gpt-oss-120b", label: "GPT-OSS 120B (Groq)"},
    {id: "openai/gpt-oss-20b", label: "GPT-OSS 20B (Groq)"},
    {id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout · Vizyon (Groq)"},
];

// provider + key (+ ollama url) → canlı model listesi. Hata olursa fallback döner.
export async function fetchModels(provider: string, key: string, ollamaUrl?: string): Promise<LiveModel[]> {
    try {
        switch (provider) {
            case "openai":   return await fetchOpenAICompat("https://api.openai.com/v1", key);
            case "groq":     return await fetchOpenAICompat("https://api.groq.com/openai/v1", key);
            case "xai":      return await fetchOpenAICompat("https://api.x.ai/v1", key);
            case "deepseek": return await fetchOpenAICompat("https://api.deepseek.com/v1", key);
            case "mistral":  return await fetchOpenAICompat("https://api.mistral.ai/v1", key);
            case "gemini":   return await fetchGemini(key);
            case "anthropic":return await fetchAnthropic(key);
            case "ollama":   return await fetchOllama(ollamaUrl ?? "http://localhost:11434");
            default:         return [];
        }
    } catch (e) {
        console.error(`[models] ${provider} model listesi çekilemedi:`, (e as Error).message);
        if (provider === "groq") return GROQ_FALLBACK;
        return [];
    }
}

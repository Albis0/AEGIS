// AEGIS — fetching the live model list (provider reliability)
//
// Hardcoded model lists go stale over time / contained made-up IDs (which
// caused 404s). Instead we fetch live from each provider's official "list
// models" endpoint. Once an API key is entered, real, working models are
// returned; no more made-up IDs.

import {fetchWithTimeout} from "./fetch-utils";

export interface LiveModel {
    id: string;
    label?: string;
}

// Filter out non-chat / unusable models (whisper, tts, embedding, guard, etc.)
function isChatModel(id: string): boolean {
    return !/whisper|tts|embed|guard|orpheus|moderation|rerank|dall-e|image|vision-only/i.test(id);
}

async function fetchOpenAICompat(baseUrl: string, key: string): Promise<LiveModel[]> {
    const resp = await fetchWithTimeout(`${baseUrl}/models`, {headers: {Authorization: `Bearer ${key}`}}, 10_000);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {data?: {id: string}[]};
    return (data.data ?? []).map((m) => ({id: m.id})).filter((m) => isChatModel(m.id));
}

// Gemini's ListModels returns dozens of stale/preview/experimental variants
// (1.0/1.5 legacy, dated -preview- snapshots, -exp-, -tuning, -8b, -thinking-exp…).
// Showing all of them made the picker unusable (user couldn't tell which id works).
// Keep only current, general-use chat models and drop the noise.
function isUsefulGeminiModel(id: string): boolean {
    // Legacy generations + non-chat helpers — gone.
    if (/gemini-1\.0|gemini-1\.5|gemini-pro-vision|aqa|embedding|imagen|learnlm/i.test(id)) return false;
    // Dated experimental/preview snapshots (e.g. -preview-04-17, -exp-1206, -thinking-exp).
    if (/-(exp|preview|thinking|tuning)\b|-(exp|preview)-?\d/i.test(id)) return false;
    // Keep the stable 2.x line (2.0 / 2.5 flash & pro, and any future 3.x).
    return /gemini-(2|3)\./i.test(id);
}

async function fetchGemini(key: string): Promise<LiveModel[]> {
    // Key in the header instead of a query param — won't leak to logs/proxies (consistent with ai-client).
    const resp = await fetchWithTimeout("https://generativelanguage.googleapis.com/v1beta/models", {headers: {"x-goog-api-key": key}}, 10_000);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {models?: {name: string; displayName?: string; supportedGenerationMethods?: string[]}[]};
    const models = (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => ({id: m.name.replace(/^models\//, ""), label: m.displayName}))
        .filter((m) => isChatModel(m.id) && isUsefulGeminiModel(m.id));
    // If the filter ever nukes everything (Google renames the line), fall back to
    // the unfiltered chat list rather than showing an empty picker.
    if (models.length === 0) {
        return (data.models ?? [])
            .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
            .map((m) => ({id: m.name.replace(/^models\//, ""), label: m.displayName}))
            .filter((m) => isChatModel(m.id));
    }
    // Newest first: 2.5 above 2.0, pro above flash.
    return models.sort((a, b) => b.id.localeCompare(a.id));
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

// Groq fallback — known, ACTIVE models to show when the API is unreachable.
// (July 2026: llama-3.3-70b-versatile deprecated by Groq — decommission Aug
// 2026 — dropped from the fallback. gpt-oss series + Scout remain production.)
const GROQ_FALLBACK: LiveModel[] = [
    {id: "openai/gpt-oss-120b", label: "GPT-OSS 120B (Groq)"},
    {id: "openai/gpt-oss-20b", label: "GPT-OSS 20B (Groq)"},
    {id: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Groq)"},
    {id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout · Vision (Groq)"},
];

// provider + key (+ ollama url) → live model list. Returns the fallback on error.
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
        console.error(`[models] failed to fetch ${provider} model list:`, (e as Error).message);
        if (provider === "groq") return GROQ_FALLBACK;
        return [];
    }
}

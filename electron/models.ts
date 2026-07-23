// AEGIS — fetching the live model list (provider reliability)
//
// Hardcoded model lists go stale over time / contained made-up IDs (which
// caused 404s). Instead we fetch live from each provider's official "list
// models" endpoint. Once an API key is entered, real, working models are
// returned; no more made-up IDs.
//
// Each provider's raw list is also full of NOISE — legacy generations, dated
// snapshots, preview/experimental variants, non-chat helpers. Showing all of
// them makes the picker unusable ("which id actually works?"). So every provider
// gets a "useful model" filter. Each filter degrades safely: if it ever empties
// the list (provider renamed its line), we fall back to the unfiltered chat list
// rather than showing an empty picker.

import {fetchWithTimeout} from "./fetch-utils";

export interface LiveModel {
    id: string;
    label?: string;
}

// Filter out non-chat / unusable models (whisper, tts, embedding, guard, etc.)
function isChatModel(id: string): boolean {
    return !/whisper|tts|embed|guard|orpheus|moderation|rerank|dall-e|image|vision-only|ocr/i.test(id);
}

/** Apply a "keep" filter but fall back to the full list if it removes everything. */
function withFallback(all: LiveModel[], keep: (id: string) => boolean): LiveModel[] {
    const filtered = all.filter((m) => keep(m.id));
    return filtered.length > 0 ? filtered : all;
}

// ── Per-provider "useful model" filters ─────────────────────────────────────

// OpenAI /models is huge: base davinci/babbage, gpt-3.5, dated -YYYY-MM-DD
// snapshots, realtime/audio/transcribe/search variants. Keep the current chat
// + reasoning lines, prefer the clean alias over a dated snapshot.
function isUsefulOpenAIModel(id: string): boolean {
    if (/gpt-3\.5|gpt-4-32k|davinci|babbage|instruct|realtime|-audio|transcribe|search-preview|computer-use/i.test(id)) return false;
    if (/-\d{4}-\d{2}-\d{2}$/.test(id)) return false; // dated snapshot → prefer the alias
    return /^(gpt-4o|gpt-4\.1|gpt-5|chatgpt-4o|o1|o3|o4)/i.test(id);
}

// xAI: drop the retired grok-2 / beta lines and dated snapshots; keep grok-3/4+.
function isUsefulXaiModel(id: string): boolean {
    if (/grok-2|grok-beta|grok-vision-beta/i.test(id)) return false;
    if (/-\d{4}(-\d{2}-\d{2})?$/.test(id)) return false; // dated snapshot
    return /grok/i.test(id);
}

// Mistral: drop embed/ocr helpers, the legacy tiny/medium lines, and dated
// snapshots (…-2402, …-2411). Keeps the *-latest aliases + current families.
function isUsefulMistralModel(id: string): boolean {
    if (/-\d{4}$/.test(id)) return false; // dated snapshot (2402, 2411, 2405…)
    if (/mistral-tiny|mistral-small-24|mistral-medium-23|mistral-large-24/i.test(id)) return false;
    return true;
}

// Anthropic ids are always dated, so we don't drop dated — we just drop the
// superseded claude-1/2 and the pre-3.5 claude-3 lines.
function isUsefulAnthropicModel(id: string): boolean {
    if (/claude-(1|2|instant)/i.test(id)) return false;
    if (/claude-3-(haiku|opus|sonnet)/i.test(id)) return false; // superseded by 3.5/3.7
    return /claude/i.test(id);
}

// Gemini's ListModels returns dozens of stale/preview/experimental variants
// (1.0/1.5 legacy, dated -preview- snapshots, -exp-, -tuning, -thinking-exp…).
// Keep only current, general-use chat models.
function isUsefulGeminiModel(id: string): boolean {
    if (/gemini-1\.0|gemini-1\.5|gemini-pro-vision|aqa|embedding|imagen|learnlm/i.test(id)) return false;
    if (/-(exp|preview|thinking|tuning)\b|-(exp|preview)-?\d/i.test(id)) return false;
    return /gemini-(2|3)\./i.test(id);
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchOpenAICompat(baseUrl: string, key: string, keep?: (id: string) => boolean): Promise<LiveModel[]> {
    const resp = await fetchWithTimeout(`${baseUrl}/models`, {headers: {Authorization: `Bearer ${key}`}}, 10_000);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {data?: {id: string}[]};
    const chat = (data.data ?? []).map((m) => ({id: m.id})).filter((m) => isChatModel(m.id));
    return keep ? withFallback(chat, keep) : chat;
}

async function fetchGemini(key: string): Promise<LiveModel[]> {
    // Key in the header instead of a query param — won't leak to logs/proxies (consistent with ai-client).
    const resp = await fetchWithTimeout("https://generativelanguage.googleapis.com/v1beta/models", {headers: {"x-goog-api-key": key}}, 10_000);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {models?: {name: string; displayName?: string; supportedGenerationMethods?: string[]}[]};
    const chat = (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => ({id: m.name.replace(/^models\//, ""), label: m.displayName}))
        .filter((m) => isChatModel(m.id));
    // Newest first: 2.5 above 2.0, pro above flash.
    return withFallback(chat, isUsefulGeminiModel).sort((a, b) => b.id.localeCompare(a.id));
}

async function fetchAnthropic(key: string): Promise<LiveModel[]> {
    const resp = await fetchWithTimeout("https://api.anthropic.com/v1/models", {
        headers: {"x-api-key": key, "anthropic-version": "2023-06-01"},
    }, 10_000);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {data?: {id: string; display_name?: string}[]};
    const all = (data.data ?? []).map((m) => ({id: m.id, label: m.display_name}));
    // Newest first (ids are dated, so lexical desc ≈ newest).
    return withFallback(all, isUsefulAnthropicModel).sort((a, b) => b.id.localeCompare(a.id));
}

async function fetchOllama(baseUrl: string): Promise<LiveModel[]> {
    // Local models the user installed themselves — no filtering, show them all.
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
            // Groq's live list is already curated by Groq — no extra filter (fallback on error).
            case "groq":     return await fetchOpenAICompat("https://api.groq.com/openai/v1", key);
            case "openai":   return await fetchOpenAICompat("https://api.openai.com/v1", key, isUsefulOpenAIModel);
            case "xai":      return await fetchOpenAICompat("https://api.x.ai/v1", key, isUsefulXaiModel);
            case "mistral":  return await fetchOpenAICompat("https://api.mistral.ai/v1", key, isUsefulMistralModel);
            // DeepSeek only exposes deepseek-chat / deepseek-reasoner — already clean.
            case "deepseek": return await fetchOpenAICompat("https://api.deepseek.com/v1", key);
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

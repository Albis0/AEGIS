// AEGIS — canlı model listesi çekme (provider güvenilirliği)
//
// Hardcoded model listeleri zamanla eskiyor / uydurma ID içeriyordu (404'e
// sebep oluyordu). Bunun yerine her provider'ın resmi "model listele"
// endpoint'inden canlı çekiyoruz. API key girilince gerçek, çalışan modeller
// gelir; uydurma ID kalmaz.

export interface LiveModel {
    id: string;
    label?: string;
}

// Sohbet dışı / kullanılamaz modelleri ele (whisper, tts, embedding, guard, vb.)
function isChatModel(id: string): boolean {
    return !/whisper|tts|embed|guard|orpheus|moderation|rerank|dall-e|image|vision-only/i.test(id);
}

async function fetchOpenAICompat(baseUrl: string, key: string): Promise<LiveModel[]> {
    const resp = await fetch(`${baseUrl}/models`, {headers: {Authorization: `Bearer ${key}`}});
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {data?: {id: string}[]};
    return (data.data ?? []).map((m) => ({id: m.id})).filter((m) => isChatModel(m.id));
}

async function fetchGemini(key: string): Promise<LiveModel[]> {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {models?: {name: string; supportedGenerationMethods?: string[]}[]};
    return (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => ({id: m.name.replace(/^models\//, "")}))
        .filter((m) => isChatModel(m.id));
}

async function fetchAnthropic(key: string): Promise<LiveModel[]> {
    const resp = await fetch("https://api.anthropic.com/v1/models", {
        headers: {"x-api-key": key, "anthropic-version": "2023-06-01"},
    });
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {data?: {id: string; display_name?: string}[]};
    return (data.data ?? []).map((m) => ({id: m.id, label: m.display_name}));
}

async function fetchOllama(baseUrl: string): Promise<LiveModel[]> {
    const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json() as {models?: {name: string}[]};
    return (data.models ?? []).map((m) => ({id: m.name}));
}

// provider + key (+ ollama url) → canlı model listesi. Hata olursa boş döner;
// çağıran taraf hardcoded fallback'e düşebilir.
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
    } catch {
        return [];
    }
}

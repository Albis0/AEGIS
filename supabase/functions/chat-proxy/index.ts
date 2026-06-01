// AEGIS — chat-proxy Edge Function (Faz 30.2)
//
// Deneme modunun beyni. Akış:
//   1. Kullanıcının JWT'sini doğrula (kim bu?)
//   2. usage tablosundan bugünkü kotayı oku → limit aşıldıysa 429
//   3. Senin Groq key'inle (Edge secret) Groq'a streaming istek
//   4. Yanıtı kullanıcıya stream et
//   5. usage sayacını arttır (+1 istek, +kullanılan token)
//
// Sırlar Edge secret olarak verilir (supabase secrets set):
//   GROQ_API_KEY              — senin Groq anahtarın (client'ta ASLA yok)
//   SUPABASE_URL              — otomatik enjekte edilir
//   SUPABASE_SERVICE_ROLE_KEY — otomatik enjekte edilir (usage yazımı için)
//
// Deploy:  supabase functions deploy chat-proxy

import {createClient} from "jsr:@supabase/supabase-js@2";

// ── Rate limit sabitleri (deneme modu) ────────────────────────────────────
const DAILY_REQUEST_LIMIT = 50;       // gün başına istek
const DAILY_TOKEN_LIMIT = 100_000;    // gün başına toplam token
const MAX_TOKENS_PER_REQUEST = 8192;  // tek istekte üst sınır

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {...CORS, "Content-Type": "application/json"},
    });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", {headers: CORS});
    if (req.method !== "POST") return json({error: "POST gerekli"}, 405);

    // ── 1. JWT doğrula ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({error: "Yetkilendirme yok. Giriş yapın."}, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) return json({error: "Sunucu yapılandırması eksik (GROQ_API_KEY)."}, 500);

    // service_role client — RLS'i bypass eder, usage yazabilir
    const admin = createClient(supabaseUrl, serviceKey);

    const {data: userData, error: userErr} = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({error: "Geçersiz oturum. Tekrar giriş yapın."}, 401);
    const userId = userData.user.id;

    // ── 2. Kota kontrolü ────────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const {data: usageRow} = await admin
        .from("usage")
        .select("request_count, token_count")
        .eq("user_id", userId)
        .eq("day", today)
        .maybeSingle();

    const usedReq = usageRow?.request_count ?? 0;
    const usedTok = usageRow?.token_count ?? 0;

    if (usedReq >= DAILY_REQUEST_LIMIT || usedTok >= DAILY_TOKEN_LIMIT) {
        return json({
            error: "limit",
            message: "Günlük deneme limitin doldu. Kendi Groq API anahtarını ekleyebilir veya yarın tekrar deneyebilirsin.",
            used: {requests: usedReq, tokens: usedTok},
            limit: {requests: DAILY_REQUEST_LIMIT, tokens: DAILY_TOKEN_LIMIT},
        }, 429);
    }

    // ── 3. İstek gövdesini al ve Groq'a gönder ──────────────────────────────
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return json({error: "Geçersiz JSON gövdesi."}, 400);
    }

    // Token tavanını zorla — client'tan gelen değeri sınırla
    const reqMaxTok = typeof body.max_tokens === "number" ? body.max_tokens : MAX_TOKENS_PER_REQUEST;
    body.max_tokens = Math.min(reqMaxTok, MAX_TOKENS_PER_REQUEST);
    body.stream = true;
    // Groq stream'inde token kullanımını almak için
    (body as Record<string, unknown>).stream_options = {include_usage: true};

    const groqResp = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!groqResp.ok || !groqResp.body) {
        const errText = await groqResp.text().catch(() => "");
        return json({error: `Groq hatası ${groqResp.status}: ${errText.slice(0, 300)}`}, 502);
    }

    // ── 4 + 5. Yanıtı stream et, bu arada token kullanımını yakala ──────────
    let promptTokens = 0;
    let completionTokens = 0;

    const stream = new ReadableStream({
        async start(controller) {
            const reader = groqResp.body!.getReader();
            const decoder = new TextDecoder();
            const encoder = new TextEncoder();
            try {
                while (true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, {stream: true});
                    // usage bilgisini SSE satırlarından ayıkla (son chunk'ta gelir)
                    for (const line of chunk.split("\n")) {
                        const t = line.trim();
                        if (!t.startsWith("data:")) continue;
                        const payload = t.slice(5).trim();
                        if (payload === "[DONE]") continue;
                        try {
                            const obj = JSON.parse(payload);
                            if (obj.usage) {
                                promptTokens = obj.usage.prompt_tokens ?? 0;
                                completionTokens = obj.usage.completion_tokens ?? 0;
                            }
                        } catch { /* kısmi satır — yoksay */ }
                    }
                    controller.enqueue(encoder.encode(chunk));
                }
            } finally {
                controller.close();
                // ── 6. usage sayacını arttır (upsert) ──────────────────────
                const totalTok = promptTokens + completionTokens;
                try {
                    await admin.rpc("increment_usage", {
                        p_user_id: userId,
                        p_day: today,
                        p_tokens: totalTok,
                    });
                } catch (e) {
                    console.error("usage increment hatası:", e);
                }
            }
        },
    });

    return new Response(stream, {
        headers: {
            ...CORS,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
        },
    });
});

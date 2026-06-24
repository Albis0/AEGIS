// AEGIS — chat-proxy Edge Function (Phase 30.2)
//
// The brain of trial mode. Flow:
//   1. Verify the user's JWT (who is this?)
//   2. Read today's quota from the usage table → 429 if the limit is exceeded
//   3. Streaming request to Groq using your Groq key (Edge secret)
//   4. Stream the response to the user
//   5. Increment the usage counter (+1 request, +tokens used)
//
// Secrets are provided as Edge secrets (supabase secrets set):
//   GROQ_API_KEY              — your Groq key (NEVER present on the client)
//   SUPABASE_URL              — injected automatically
//   SUPABASE_SERVICE_ROLE_KEY — injected automatically (for writing usage)
//
// Deploy:  supabase functions deploy chat-proxy

import {createClient} from "jsr:@supabase/supabase-js@2";

// ── Rate limit constants (trial mode) ─────────────────────────────────────
const DAILY_REQUEST_LIMIT = 50;       // requests per day
const DAILY_TOKEN_LIMIT = 100_000;    // total tokens per day
const MAX_TOKENS_PER_REQUEST = 8192;  // upper bound per single request

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
    if (req.method !== "POST") return json({error: "POST required"}, 405);

    // ── 1. Verify JWT ────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({error: "Not authorized. Please sign in."}, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) return json({error: "Server configuration is missing (GROQ_API_KEY)."}, 500);

    // service_role client — bypasses RLS, can write usage
    const admin = createClient(supabaseUrl, serviceKey);

    const {data: userData, error: userErr} = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({error: "Invalid session. Please sign in again."}, 401);
    const userId = userData.user.id;

    // ── 2. Quota check ───────────────────────────────────────────────────────
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
            message: "Your daily trial limit is used up. You can add your own Groq API key or try again tomorrow.",
            used: {requests: usedReq, tokens: usedTok},
            limit: {requests: DAILY_REQUEST_LIMIT, tokens: DAILY_TOKEN_LIMIT},
        }, 429);
    }

    // ── 3. Read the request body and forward it to Groq ─────────────────────
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return json({error: "Invalid JSON body."}, 400);
    }

    // Enforce the token cap — clamp whatever value the client sent
    const reqMaxTok = typeof body.max_tokens === "number" ? body.max_tokens : MAX_TOKENS_PER_REQUEST;
    body.max_tokens = Math.min(reqMaxTok, MAX_TOKENS_PER_REQUEST);
    body.stream = true;
    // So we can read token usage from the Groq stream
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
        return json({error: `Groq error ${groqResp.status}: ${errText.slice(0, 300)}`}, 502);
    }

    // ── 4 + 5. Stream the response while capturing token usage ──────────────
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
                    // Extract usage info from the SSE lines (arrives in the last chunk)
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
                        } catch { /* partial line — ignore */ }
                    }
                    controller.enqueue(encoder.encode(chunk));
                }
            } finally {
                controller.close();
                // ── 6. Increment the usage counter (upsert) ──────────────────
                const totalTok = promptTokens + completionTokens;
                try {
                    await admin.rpc("increment_usage", {
                        p_user_id: userId,
                        p_day: today,
                        p_tokens: totalTok,
                    });
                } catch (e) {
                    console.error("usage increment error:", e);
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

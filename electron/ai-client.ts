import type {ChatCompletionMessageParam} from "groq-sdk/resources/chat/completions";
import type Groq from "groq-sdk";
import {getAllToolSchemas} from "./tools";
import {getModelCapabilities, clampMaxTokens, resolveTemperature, estimateTokens, type ModelCaps} from "./model-capabilities";
import {AEGIS_PROXY_URL} from "./aegis-config";
import {fetchWithTimeout, isTimeoutError, timeoutMsg} from "./fetch-utils";
import {bt} from "./backend-i18n";
import {getAccessToken} from "./auth";
import {withWakeRetry, isWakingError} from "./retry";
import {redactMessages} from "./boundary-guard";
import type {AppSettings} from "./settings";

// ── Types ─────────────────────────────────────────────────────────────────────
export type MsgPart =
    | {type: "text"; text: string}
    | {type: "image_url"; image_url: {url: string}; name?: string}
    | {type: "file"; data: string; name: string; mime: string};

export type OAIMessage = {
    role: string;
    content: string | MsgPart[] | null;
    tool_calls?: unknown[];
    tool_call_id?: string;
};

export type OAICompletion = {
    choices: [{
        message: {
            content: string | null;
            tool_calls?: {id: string; type: "function"; function: {name: string; arguments: string}}[];
        };
    }];
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getProviderKey(provider: string, settings: AppSettings): string {
    if (provider === "groq") return process.env.GROQ_API_KEY ?? "";
    return settings.providerKeys?.[provider] ?? settings.aiApiKey ?? "";
}

export function findToolName(messages: OAIMessage[], callId: string): string {
    for (const m of messages) {
        for (const tc of (m.tool_calls ?? []) as {id: string; function: {name: string}}[]) {
            if (tc.id === callId) return tc.function?.name ?? "result";
        }
    }
    return "result";
}

export function extractTextContent(content: string | MsgPart[] | null): string {
    if (!content) return "";
    if (typeof content === "string") return content;
    return content
        .filter((p): p is {type: "text"; text: string} => p.type === "text")
        .map((p) => p.text)
        .join("\n");
}

export function toAnthropicContent(content: string | MsgPart[] | null): unknown[] {
    if (!content) return [{type: "text", text: ""}];
    if (typeof content === "string") return [{type: "text", text: content}];
    return content.map((p) => {
        if (p.type === "text") return {type: "text", text: p.text};
        if (p.type === "image_url") {
            const url = p.image_url.url;
            if (url.startsWith("data:")) {
                const [header, data] = url.split(",");
                const mime = header.split(":")[1]?.split(";")[0] ?? "image/png";
                return {type: "image", source: {type: "base64", media_type: mime, data}};
            }
            return {type: "image", source: {type: "url", url}};
        }
        if (p.type === "file") return {type: "text", text: `[File: ${p.name}]\n${Buffer.from(p.data, "base64").toString("utf-8")}`};
        return {type: "text", text: ""};
    });
}

export function toGeminiParts(content: string | MsgPart[] | null): object[] {
    if (!content) return [{text: ""}];
    if (typeof content === "string") return [{text: content}];
    return content.map((p) => {
        if (p.type === "text") return {text: p.text};
        if (p.type === "image_url") {
            const url = p.image_url.url;
            if (url.startsWith("data:")) {
                const [header, data] = url.split(",");
                const mime = header.split(":")[1]?.split(";")[0] ?? "image/png";
                return {inline_data: {mime_type: mime, data}};
            }
            return {text: url};
        }
        if (p.type === "file") return {text: `[File: ${p.name}]\n${Buffer.from(p.data, "base64").toString("utf-8")}`};
        return {text: ""};
    });
}

export async function friendlyHttpError(providerLabel: string, resp: Response): Promise<string> {
    let bodyText = "";
    try { bodyText = await resp.text(); } catch { /* ignore */ }
    let detail = "";
    try {
        const j = JSON.parse(bodyText);
        detail = j?.error?.message ?? j?.message ?? j?.error?.code ?? "";
    } catch {
        detail = bodyText.slice(0, 200);
    }
    const s = resp.status;
    const d = detail.toLowerCase();

    const p = {provider: providerLabel};
    if (s === 401) return bt("http401", p);
    if (s === 403) {
        if (/duplicate|already declared|function declaration/i.test(detail)) {
            return bt("httpDupTool", p);
        }
        return bt("http403", p);
    }
    if (s === 400) {
        if (/duplicate.*function|function.*declaration.*found/i.test(detail)) {
            return bt("httpDupTool", p);
        }
        if (/model|not found|does not exist|decommission/i.test(detail)) {
            return bt("http400model", p);
        }
        if (/context.*length|too.*long|max.*token/i.test(d)) {
            return bt("http400ctx", p);
        }
        return bt("http400", {...p, detail: detail ? " — " + detail.slice(0, 140) : ""});
    }
    if (s === 404) return bt("http404", p);
    if (s === 429) {
        if (/quota|billing|insufficient|credit|payment/i.test(d)) {
            return bt("http429quota", p);
        }
        if (/tpm|tokens per minute/i.test(d)) {
            return bt("http429tpm", p);
        }
        return bt("http429", p);
    }
    if (s === 413) return bt("http413", p);
    if (s === 422) return bt("http422", {...p, detail: detail ? " — " + detail.slice(0, 120) : ""});
    if (s >= 500 && s < 600) return bt("http5xx", {...p, status: s});
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(detail)) {
        return bt("httpNet", p);
    }
    return bt("httpGeneric", {...p, status: s, detail: detail ? ": " + detail.slice(0, 160) : ""});
}

export function friendlyGroqError(e: unknown): string {
    const err = e as {status?: number; error?: {message?: string; code?: string}; message?: string};
    const status = err?.status ?? 0;
    const detail = (err?.error?.message ?? err?.message ?? "").toString();
    const low = detail.toLowerCase();
    if (isTimeoutError(e)) return `Groq: ${timeoutMsg()}`;
    if (status === 401 || status === 403) return bt("groqAuth");
    if (status === 404 || /decommission|not found|does not exist/.test(low)) return bt("groqModel");
    if (status === 413 || /too large|reduce your message/.test(low)) return bt("groqTooLarge");
    if (status === 429 || /rate.limit|tpm|tokens per minute/.test(low)) return bt("groqRate");
    if (status >= 500) return bt("groq5xx");
    if (/fetch failed|network|ENOTFOUND|ECONNREFUSED/i.test(detail)) return bt("groqNet");
    if (/failed_generation/.test(low)) return bt("groqFailedGen");
    return bt("groqGeneric", {detail: detail ? ": " + detail.slice(0, 140) : ""});
}

export function stripImagesIfNeeded(messages: OAIMessage[], caps: ModelCaps): OAIMessage[] {
    if (caps.supportsVision) return messages;
    let changed = false;
    const out = messages.map((msg) => {
        if (!Array.isArray(msg.content)) return msg;
        if (!msg.content.some((p) => p.type === "image_url")) return msg;
        changed = true;
        const parts = msg.content.map((p) =>
            p.type === "image_url" ? {type: "text" as const, text: "[image skipped: this model does not support images]"} : p);
        return {...msg, content: parts};
    });
    return changed ? out : messages;
}

export function mergeSystemIfNeeded(messages: OAIMessage[], caps: ModelCaps): OAIMessage[] {
    if (caps.supportsSystemPrompt) return messages;
    const sys = messages.find((mm) => mm.role === "system");
    if (!sys) return messages;
    const sysText = extractTextContent(sys.content);
    const rest = messages.filter((mm) => mm.role !== "system");
    const idx = rest.findIndex((mm) => mm.role === "user");
    if (idx >= 0 && sysText) {
        rest[idx] = {...rest[idx], content: `${sysText}\n\n${extractTextContent(rest[idx].content)}`};
    }
    return rest;
}

export function trimToBudget(messages: OAIMessage[], caps: ModelCaps, maxOut: number): OAIMessage[] {
    const sysMsg = messages[0]?.role === "system" ? messages[0] : null;
    const body = sysMsg ? messages.slice(1) : messages;
    const sysTokens = sysMsg ? estimateTokens(extractTextContent(sysMsg.content)) : 0;
    const budget = caps.contextWindow - maxOut - sysTokens - 512;
    if (budget <= 0) return messages;

    const kept: OAIMessage[] = [];
    let used = 0;
    for (let i = body.length - 1; i >= 0; i--) {
        const msg = body[i];
        let tok = estimateTokens(typeof msg.content === "string" ? msg.content : extractTextContent(msg.content));
        if (Array.isArray(msg.content)) tok += msg.content.filter((p) => p.type === "image_url").length * 1100;
        if (used + tok > budget && kept.length > 0) break;
        kept.unshift(msg);
        used += tok;
    }
    while (kept.length > 0 && (kept[0].role === "tool" || (kept[0].role === "assistant" && kept[0].tool_calls))) {
        kept.shift();
    }
    if (kept.length === 0) {
        const lastUser = [...body].reverse().find((mm) => mm.role === "user");
        if (lastUser) kept.push(lastUser);
    }
    return sysMsg ? [sysMsg, ...kept] : kept;
}

// ── Proxy (trial mode) ────────────────────────────────────────────────────────
export async function callProxy(
    messages: OAIMessage[],
    tools: ReturnType<typeof getAllToolSchemas>,
    opts: {model: string; temperature: number; max_tokens: number},
    onDelta?: (text: string) => void,
): Promise<OAICompletion> {
    const token = await getAccessToken();
    if (!token) throw new Error(bt("proxySignin"));

    let resp: Response;
    try {
        // Waking-server retry: a paused free-tier project fails with DNS/5xx for
        // ~10-30s after the first hit. Retry the connection phase quietly; the
        // stream itself is never retried (no double answers).
        resp = await withWakeRetry(async () => {
            const r = await fetchWithTimeout(AEGIS_PROXY_URL, {
                method: "POST",
                headers: {"Authorization": `Bearer ${token}`, "Content-Type": "application/json"},
                body: JSON.stringify({
                    model: opts.model,
                    messages,
                    ...(tools.length > 0 ? {tools} : {}),
                    temperature: opts.temperature,
                    max_tokens: opts.max_tokens,
                }),
            }, 45_000);
            if ([502, 503, 521, 522, 540].includes(r.status)) {
                const err = new Error(`trial service waking (${r.status})`) as Error & {status?: number};
                err.status = r.status;
                throw err;
            }
            return r;
        }, {attempts: 3, delayMs: 6000});
    } catch (e) {
        if (isTimeoutError(e)) throw new Error(bt("proxyTimeout"), {cause: e});
        if (isWakingError((e as Error).message ?? "", (e as {status?: number}).status)) {
            throw new Error(bt("proxyWaking"), {cause: e});
        }
        throw new Error(bt("proxyUnreachable"), {cause: e});
    }

    if (resp.status === 429) {
        const info = await resp.json().catch(() => ({}) as Record<string, unknown>);
        const raw = JSON.stringify(info).toLowerCase();
        if ((info as {error?: string}).error === "limit") {
            const err = new Error((info as {message?: string}).message ?? bt("proxyLimit"));
            (err as Error & {isLimit?: boolean}).isLimit = true;
            throw err;
        }
        if (/tpm|tokens per minute|rate_limit|too large/.test(raw)) {
            throw new Error(bt("proxyTpm"));
        }
        const err2 = new Error(bt("proxyBusy"));
        (err2 as Error & {isLimit?: boolean}).isLimit = true;
        throw err2;
    }
    if (resp.status === 413) throw new Error(bt("proxy413"));
    if (resp.status === 401) throw new Error(bt("proxy401"));
    if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => "");
        let detail = "";
        try { const j = JSON.parse(errText); detail = j?.error?.message ?? j?.message ?? j?.error ?? ""; } catch { detail = errText.slice(0, 120); }
        if (resp.status >= 500) throw new Error(bt("proxy5xx"));
        throw new Error(bt("proxyGeneric", {detail: detail ? ": " + String(detail).slice(0, 120) : ` (${resp.status})`}));
    }

    let fullContent = "";
    const tcMap = new Map<number, {id: string; name: string; args: string}>();
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "" || payload === "[DONE]") continue;
            let chunk: any;
            try { chunk = JSON.parse(payload); } catch { continue; }
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
                fullContent += delta.content;
                onDelta?.(delta.content);
            }
            for (const tc of delta?.tool_calls ?? []) {
                const ex = tcMap.get(tc.index) ?? {id: "", name: "", args: ""};
                tcMap.set(tc.index, {
                    id: tc.id ?? ex.id,
                    name: tc.function?.name ?? ex.name,
                    args: ex.args + (tc.function?.arguments ?? ""),
                });
            }
        }
    }

    return {choices: [{message: {
        content: fullContent || null,
        tool_calls: tcMap.size > 0
            ? [...tcMap.values()].map((tc) => ({id: tc.id, type: "function" as const, function: {name: tc.name, arguments: tc.args}}))
            : undefined,
    }}]};
}

// ── Main AI call ──────────────────────────────────────────────────────────────
export async function callAI(
    messages: OAIMessage[],
    onDelta: ((text: string) => void) | undefined,
    lockedSchemas: ReturnType<typeof getAllToolSchemas> | undefined,
    settings: AppSettings,
    model: string,
    groq: InstanceType<typeof Groq>,
): Promise<OAICompletion> {
    const provider = settings.aiProvider;
    const key = getProviderKey(provider, settings);
    const temp = settings.temperature ?? 0.7;
    const reqMaxTok = settings.maxTokens ?? 8192;
    const topP = settings.topP ?? 1.0;

    const ownGroqKey = (settings.providerKeys?.groq ?? "").trim();
    const trialMode = settings.aiMode === "trial" && !ownGroqKey;
    const effectiveProvider = trialMode ? "groq" : provider;

    const caps = getModelCapabilities(effectiveProvider, model, settings.ollamaNumCtx ?? 4096);
    const maxTok = clampMaxTokens(reqMaxTok, caps);
    const sendTemp = resolveTemperature(temp, caps);

    // Phase 58 — Boundary Guard: REDACT any secrets (API key/password/token) in
    // outgoing content. Except local Ollama (content never leaves the user's
    // machine); all other providers + trial-mode proxy send content to a 3rd party.
    if (effectiveProvider !== "ollama") {
        messages = redactMessages(messages);
    }
    messages = stripImagesIfNeeded(messages, caps);
    messages = mergeSystemIfNeeded(messages, caps);
    messages = trimToBudget(messages, caps, maxTok);

    const activeSchemas: ReturnType<typeof getAllToolSchemas> = lockedSchemas ?? (() => {
        if (!caps.supportsTools) return [];
        const lastUserMsg = [...messages].reverse().find((mm) => mm.role === "user");
        const toolContext = lastUserMsg ? extractTextContent(lastUserMsg.content) : "";
        return getAllToolSchemas(effectiveProvider, toolContext);
    })();

    if (trialMode) {
        return callProxy(messages, activeSchemas, {model, temperature: sendTemp ?? temp, max_tokens: maxTok}, onDelta);
    }

    // ── Groq ──────────────────────────────────────────────────────────────────
    if (provider === "groq") {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const stream = await groq.chat.completions.create({
                    model,
                    messages: messages as ChatCompletionMessageParam[],
                    ...(activeSchemas.length > 0 ? {tools: activeSchemas} : {}),
                    stream: true,
                    ...(sendTemp !== undefined ? {temperature: sendTemp} : {}),
                    max_tokens: maxTok,
                });
                let fullContent = "";
                let finishReason = "";
                const tcMap = new Map<number, {id: string; name: string; args: string}>();
                for await (const chunk of stream) {
                    const choice = chunk.choices[0];
                    const delta = choice?.delta;
                    finishReason = (choice as any)?.finish_reason ?? finishReason;
                    if (delta?.content) {
                        fullContent += delta.content;
                        onDelta?.(delta.content);
                    }
                    for (const tc of (delta as any)?.tool_calls ?? []) {
                        const ex = tcMap.get(tc.index) ?? {id: "", name: "", args: ""};
                        tcMap.set(tc.index, {
                            id: tc.id ?? ex.id,
                            name: tc.function?.name ?? ex.name,
                            args: ex.args + (tc.function?.arguments ?? ""),
                        });
                    }
                }
                if (finishReason === "failed_generation" && attempt === 0) {
                    await new Promise((r) => setTimeout(r, 800));
                    continue;
                }
                return {choices: [{message: {
                    content: fullContent || null,
                    tool_calls: tcMap.size > 0
                        ? [...tcMap.values()].map((tc) => ({id: tc.id, type: "function" as const, function: {name: tc.name, arguments: tc.args}}))
                        : undefined,
                }}]};
            } catch (e) {
                const errObj = e as {status?: number};
                if (errObj?.status === 429 && attempt === 0) {
                    await new Promise((r) => setTimeout(r, 3000));
                    continue;
                }
                throw new Error(friendlyGroqError(e), {cause: e});
            }
        }
        return {choices: [{message: {content: null, tool_calls: undefined}}]};
    }

    // ── Anthropic ─────────────────────────────────────────────────────────────
    if (provider === "anthropic") {
        const system = messages.find((m) => m.role === "system")?.content ?? "";
        const turns = messages.filter((m) => m.role !== "system");
        const body: Record<string, unknown> = {
            model,
            max_tokens: maxTok,
            system,
            ...(sendTemp !== undefined ? {temperature: sendTemp} : {}),
            messages: turns.map((m) => ({
                role: m.role === "tool" ? "user" : m.role,
                content: m.role === "tool"
                    ? [{type: "tool_result", tool_use_id: m.tool_call_id, content: typeof m.content === "string" ? m.content : extractTextContent(m.content)}]
                    : toAnthropicContent(m.content),
            })),
            ...(activeSchemas.length > 0 ? {tools: activeSchemas.map((t) => ({
                name: t.function?.name,
                description: t.function?.description,
                input_schema: t.function?.parameters,
            }))} : {}),
        };
        const resp = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            body: JSON.stringify(body),
        }, 60_000);
        if (!resp.ok) throw new Error(await friendlyHttpError("Anthropic", resp));
        const data = await resp.json() as {content: {type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown>}[]};
        const textBlock = data.content.find((b) => b.type === "text");
        const toolBlocks = data.content.filter((b) => b.type === "tool_use");
        const text = textBlock?.text ?? null;
        if (text) onDelta?.(text);
        return {choices: [{message: {
            content: text,
            tool_calls: toolBlocks.length > 0
                ? toolBlocks.map((b) => ({id: b.id!, type: "function" as const, function: {name: b.name!, arguments: JSON.stringify(b.input ?? {})}}))
                : undefined,
        }}]};
    }

    // ── Gemini ────────────────────────────────────────────────────────────────
    if (provider === "gemini") {
        if (!key) throw new Error("Gemini API key is missing. Add it in Settings → Model.");
        const sysMsg = messages.find((m) => m.role === "system");
        const turns = messages.filter((m) => m.role !== "system");

        const contents: {role: string; parts: object[]}[] = [];
        for (const m of turns) {
            if (m.role === "user") {
                contents.push({role: "user", parts: toGeminiParts(m.content)});
            } else if (m.role === "assistant") {
                const parts: object[] = [];
                if (m.content) parts.push({text: extractTextContent(m.content)});
                for (const tc of (m.tool_calls ?? []) as {id: string; function: {name: string; arguments: string}}[]) {
                    let args: unknown = {};
                    try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
                    parts.push({functionCall: {name: tc.function.name, args}});
                }
                if (parts.length > 0) contents.push({role: "model", parts});
            } else if (m.role === "tool") {
                const toolName = findToolName(messages, m.tool_call_id ?? "");
                contents.push({role: "user", parts: [{functionResponse: {name: toolName, response: {output: m.content}}}]});
            }
        }

        function stripAdditionalProps(obj: unknown): unknown {
            if (Array.isArray(obj)) return obj.map(stripAdditionalProps);
            if (obj && typeof obj === "object") {
                const out: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
                    if (k === "additionalProperties") continue;
                    out[k] = stripAdditionalProps(v);
                }
                return out;
            }
            return obj;
        }
        const functionDeclarations = activeSchemas.map((s) => ({
            name: s.function?.name,
            description: s.function?.description,
            parameters: stripAdditionalProps(s.function?.parameters),
        }));

        const generationConfig: Record<string, unknown> = {maxOutputTokens: maxTok, topP};
        if (sendTemp !== undefined) generationConfig.temperature = sendTemp;
        const body: Record<string, unknown> = {contents, generationConfig};
        if (sysMsg?.content) body.systemInstruction = {parts: [{text: extractTextContent(sysMsg.content)}]};
        if (functionDeclarations.length > 0) body.tools = [{functionDeclarations}];

        // Send the key in the x-goog-api-key header instead of a query param —
        // Google's current standard; also keeps the key out of error logs/proxies.
        const resp = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {method: "POST", headers: {"Content-Type": "application/json", "x-goog-api-key": key}, body: JSON.stringify(body)},
            60_000,
        );
        if (!resp.ok) throw new Error(await friendlyHttpError("Gemini", resp));

        const data = await resp.json() as {
            candidates?: [{content?: {parts?: ({text?: string; functionCall?: {name: string; args: Record<string, unknown>}})[]; role?: string}}]
        };
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const textParts = parts.filter((p) => p.text).map((p) => p.text!).join("");
        const funcCalls = parts.filter((p) => p.functionCall);

        if (textParts) onDelta?.(textParts);
        return {choices: [{message: {
            content: textParts || null,
            tool_calls: funcCalls.length > 0
                ? funcCalls.map((p, i) => ({
                    id: `gemini-${p.functionCall!.name}-${i}`,
                    type: "function" as const,
                    function: {name: p.functionCall!.name, arguments: JSON.stringify(p.functionCall!.args ?? {})},
                }))
                : undefined,
        }}]};
    }

    // ── Ollama ────────────────────────────────────────────────────────────────
    if (provider === "ollama") {
        const ollamaUrl = (settings.ollamaUrl || "http://localhost:11434") + "/v1/chat/completions";
        let resp: Response;
        try {
            resp = await fetchWithTimeout(ollamaUrl, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    model,
                    messages,
                    ...(activeSchemas.length > 0 ? {tools: activeSchemas} : {}),
                    stream: false,
                    ...(sendTemp !== undefined ? {temperature: sendTemp} : {}),
                    options: {num_ctx: settings.ollamaNumCtx ?? 4096},
                }),
            }, 60_000);
        } catch {
            throw new Error("Cannot reach Ollama. Make sure it is running (ollama serve) or pick a different provider in Settings → Model.");
        }
        if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            throw new Error(`Ollama ${resp.status}: ${txt || "unknown error"}`);
        }
        return await resp.json() as OAICompletion;
    }

    // ── xAI (Grok) ───────────────────────────────────────────────────────────
    if (provider === "xai") {
        if (!key) throw new Error("xAI API key is missing. Add it in Settings → Model.");
        const body: Record<string, unknown> = {model, messages, stream: false, max_tokens: maxTok};
        if (activeSchemas.length > 0) body.tools = activeSchemas;
        if (sendTemp !== undefined) body.temperature = sendTemp;
        const resp = await fetchWithTimeout("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {"Authorization": `Bearer ${key}`, "Content-Type": "application/json"},
            body: JSON.stringify(body),
        }, 60_000);
        if (!resp.ok) throw new Error(await friendlyHttpError("xAI", resp));
        const result = await resp.json() as OAICompletion;
        const text = result.choices[0]?.message?.content;
        if (text) onDelta?.(text);
        return result;
    }

    // ── DeepSeek ─────────────────────────────────────────────────────────────
    if (provider === "deepseek") {
        if (!key) throw new Error("DeepSeek API key is missing. Add it in Settings → Model.");
        const body: Record<string, unknown> = {model, messages, stream: false, max_tokens: maxTok};
        if (activeSchemas.length > 0) body.tools = activeSchemas;
        if (sendTemp !== undefined) body.temperature = sendTemp;
        const resp = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {"Authorization": `Bearer ${key}`, "Content-Type": "application/json"},
            body: JSON.stringify(body),
        }, 60_000);
        if (!resp.ok) throw new Error(await friendlyHttpError("DeepSeek", resp));
        const result = await resp.json() as OAICompletion;
        const text = result.choices[0]?.message?.content;
        if (text) onDelta?.(text);
        return result;
    }

    // ── OpenAI / Mistral ──────────────────────────────────────────────────────
    if (!key) throw new Error(`${provider.toUpperCase()} API key is missing. Add it in Settings → Model.`);
    const endpoints: Record<string, string> = {
        openai:  "https://api.openai.com/v1/chat/completions",
        mistral: "https://api.mistral.ai/v1/chat/completions",
    };
    const url = endpoints[provider] ?? endpoints.openai;
    const body: Record<string, unknown> = {model, messages, stream: false};
    if (activeSchemas.length > 0) body.tools = activeSchemas;
    if (caps.usesMaxCompletionTokens) body.max_completion_tokens = maxTok;
    else body.max_tokens = maxTok;
    if (sendTemp !== undefined) body.temperature = sendTemp;
    if (topP !== 1.0 && caps.supportsTemperature) body.top_p = topP;
    if (provider === "openai" && caps.supportsTemperature && settings.presencePenalty !== 0) body.presence_penalty = settings.presencePenalty;
    if (provider === "openai" && caps.supportsTemperature && settings.frequencyPenalty !== 0) body.frequency_penalty = settings.frequencyPenalty;
    if (provider === "mistral" && settings.mistralSafeMode) body.safe_prompt = true;

    const resp = await fetchWithTimeout(url, {
        method: "POST",
        headers: {"Authorization": `Bearer ${key}`, "Content-Type": "application/json"},
        body: JSON.stringify(body),
    }, 60_000);
    if (!resp.ok) throw new Error(await friendlyHttpError(provider.toUpperCase(), resp));
    const result = await resp.json() as OAICompletion;
    const text = result.choices[0]?.message?.content;
    if (text) onDelta?.(text);
    return result;
}

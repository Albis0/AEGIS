// AEGIS — Context budget (token-aware request fitting)
// =============================================================================
// The root cause of "message too long" (Groq 413): the OLD trimToBudget fit the
// history into (contextWindow − maxOut − sysTokens − 512) but the TOOLS ARRAY —
// up to 64 schemas, ~8-15k tokens — was attached on top, uncounted. On a model
// whose real context window is small (some Groq models resolve to 8k), system +
// 64 tools alone already blows the window, so the request was rejected.
//
// fitRequest() counts EVERYTHING (system + history + tools + images) against a
// conservative window and degrades gracefully instead of erroring:
//   1. drop the least-relevant tools (tools come in relevance order) until the
//      system + last user message + tools fit,
//   2. trim history (oldest-first) into the remaining budget,
//   3. as a last resort keep only the last user message.
// A request that is KNOWN to exceed the window is never sent.

import type {ChatCompletionTool} from "groq-sdk/resources/chat/completions";
import type {OAIMessage, MsgPart} from "./ai-client";
import {estimateTokens, type ModelCaps} from "./model-capabilities";

// A single image costs roughly this many tokens regardless of its base64 length
// (providers tokenize images by tiles, not by string length). Matches the
// heuristic the old trimToBudget used (line ~204).
const IMAGE_TOKENS = 1100;

/** Default safety factor — send at most this fraction of the model's stated window. */
const DEFAULT_SAFETY = 0.9;
/** Head-room left for the model's own bookkeeping / role tokens / small drift. */
const DEFAULT_RESERVE = 512;

export interface FitOptions {
    /** Fraction of the window we're willing to fill (default 0.9). */
    safetyFactor?: number;
    /** Hard per-request token cap if the provider's real limit is below the window. */
    requestHardCap?: number;
    /** Extra reserved tokens (default 512). */
    reserve?: number;
}

export interface FitResult {
    messages: OAIMessage[];
    tools: ChatCompletionTool[];
    /** Diagnostics — how much was cut to make it fit. */
    trimmed: {toolsDropped: number; historyDropped: number};
    /** Estimated input tokens actually being sent (system + history + tools). */
    estTotal: number;
}

/** Tokens for one message's content (text + images + file blobs). */
function contentTokens(content: string | MsgPart[] | null): number {
    if (!content) return 0;
    if (typeof content === "string") return estimateTokens(content);
    let tok = 0;
    for (const p of content) {
        if (p.type === "text") tok += estimateTokens(p.text);
        else if (p.type === "image_url") tok += IMAGE_TOKENS;
        else if (p.type === "file") tok += estimateTokens(p.data ?? "");
    }
    return tok;
}

// Per-schema token cost is stable for the life of a schema object → memoize by
// reference so we don't re-stringify the same 64 schemas on every request.
const _toolTokenCache = new WeakMap<ChatCompletionTool, number>();
function toolTokens(tool: ChatCompletionTool): number {
    let t = _toolTokenCache.get(tool);
    if (t === undefined) {
        t = estimateTokens(JSON.stringify(tool));
        _toolTokenCache.set(tool, t);
    }
    return t;
}

/** Total tokens for a tools array (sum of per-schema costs). */
export function estimateToolTokens(tools: ChatCompletionTool[]): number {
    let sum = 0;
    for (const t of tools) sum += toolTokens(t);
    return sum;
}

/**
 * Fit system + history + tools + images into the model's usable window.
 * `tools` MUST be in relevance order (most useful first) — the tail is dropped
 * first when space is tight (getAllToolSchemas already orders this way).
 */
export function fitRequest(
    messages: OAIMessage[],
    tools: ChatCompletionTool[],
    caps: ModelCaps,
    maxOut: number,
    opts: FitOptions = {},
): FitResult {
    const safety = opts.safetyFactor ?? DEFAULT_SAFETY;
    const reserve = opts.reserve ?? DEFAULT_RESERVE;
    const hardCap = opts.requestHardCap ?? caps.contextWindow;
    const window = Math.floor(Math.min(caps.contextWindow, hardCap) * safety);

    const sysMsg = messages[0]?.role === "system" ? messages[0] : null;
    const body = sysMsg ? messages.slice(1) : messages;
    const sysTokens = sysMsg ? contentTokens(sysMsg.content) : 0;

    // The last user message is the one thing we always keep — it's the request.
    const lastUser = [...body].reverse().find((m) => m.role === "user");
    const lastUserTokens = lastUser ? contentTokens(lastUser.content) : 0;

    // ── 1. Drop least-relevant tools until system + last user + tools fit ──
    const perTool = tools.map(toolTokens);
    let keptToolCount = tools.length;
    let curToolTokens = perTool.reduce((a, b) => a + b, 0);
    const floorNeed = sysTokens + lastUserTokens + reserve + maxOut;
    while (keptToolCount > 0 && floorNeed + curToolTokens > window) {
        keptToolCount--;
        curToolTokens -= perTool[keptToolCount];
    }
    const keptTools = tools.slice(0, keptToolCount);

    // ── 2. Trim history into whatever budget remains ──
    const historyBudget = window - maxOut - sysTokens - curToolTokens - reserve;
    const kept: OAIMessage[] = [];
    let used = 0;
    if (historyBudget > 0) {
        for (let i = body.length - 1; i >= 0; i--) {
            const tok = contentTokens(body[i].content);
            if (used + tok > historyBudget && kept.length > 0) break;
            kept.unshift(body[i]);
            used += tok;
        }
        // Don't start the trimmed history with an orphan tool result or an
        // assistant turn that references a now-dropped tool call.
        while (kept.length > 0 && (kept[0].role === "tool" || (kept[0].role === "assistant" && kept[0].tool_calls))) {
            kept.shift();
        }
    }
    // ── 3. Last resort: at least the request itself ──
    if (kept.length === 0 && lastUser) kept.push(lastUser);

    const fitted = sysMsg ? [sysMsg, ...kept] : kept;
    const estTotal = sysTokens + curToolTokens + kept.reduce((a, m) => a + contentTokens(m.content), 0);
    return {
        messages: fitted,
        tools: keptTools,
        trimmed: {
            toolsDropped: tools.length - keptTools.length,
            historyDropped: body.length - kept.length,
        },
        estTotal,
    };
}

// ── Reactive-retry shrink helpers ───────────────────────────────────────────
// The proactive fit above relies on caps.contextWindow being ACCURATE. When a
// provider still answers "message too long" (its real limit is smaller than the
// registry guess — e.g. an unknown/renamed model defaulting to 131k), the caller
// shrinks with these, truth-driven, and retries. This is what makes overflow
// impossible to surface regardless of registry accuracy.

/** Stage 1 of retry-shrink: keep only the system message + the last user message. */
export function keepEssential(messages: OAIMessage[]): OAIMessage[] {
    const sys = messages[0]?.role === "system" ? [messages[0]] : [];
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    return lastUser ? [...sys, lastUser] : [...sys];
}

/** Stage 2 of retry-shrink: hard-cap each message's text (last-ditch). */
export function truncateContents(messages: OAIMessage[], maxChars: number): OAIMessage[] {
    return messages.map((m) => {
        if (typeof m.content === "string" && m.content.length > maxChars) {
            return {...m, content: m.content.slice(0, maxChars) + "…"};
        }
        if (Array.isArray(m.content)) {
            const parts = m.content.map((p) =>
                p.type === "text" && p.text.length > maxChars ? {...p, text: p.text.slice(0, maxChars) + "…"} : p);
            return {...m, content: parts};
        }
        return m;
    });
}

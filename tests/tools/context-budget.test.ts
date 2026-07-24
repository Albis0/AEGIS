import {describe, it, expect} from "vitest";
import {fitRequest, estimateToolTokens, keepEssential, truncateContents} from "../../electron/context-budget";
import type {ModelCaps} from "../../electron/model-capabilities";
import {estimateTokens} from "../../electron/model-capabilities";
import type {OAIMessage} from "../../electron/ai-client";
import type {ChatCompletionTool} from "groq-sdk/resources/chat/completions";

// A ModelCaps with a given window; other fields don't matter for budgeting.
function caps(contextWindow: number): ModelCaps {
    return {
        supportsTools: true,
        supportsTemperature: true,
        maxTemperature: 2,
        supportsSystemPrompt: true,
        supportsVision: true,
        supportsStreaming: true,
        reasoning: false,
        usesMaxCompletionTokens: false,
        maxOutputTokens: 1024,
        contextWindow,
    };
}

// Build a tool whose JSON serialization is ~ `descChars` long, so its token cost
// is predictable. Names are unique so the relevance order is checkable.
function tool(name: string, descChars: number): ChatCompletionTool {
    return {
        type: "function",
        function: {name, description: "x".repeat(descChars), parameters: {type: "object", properties: {}}},
    } as ChatCompletionTool;
}

const sys = (text: string): OAIMessage => ({role: "system", content: text});
const user = (text: string): OAIMessage => ({role: "user", content: text});
const asst = (text: string): OAIMessage => ({role: "assistant", content: text});

describe("estimateToolTokens", () => {
    it("sums per-schema token cost", () => {
        const tools = [tool("a", 400), tool("b", 400)];
        const total = estimateToolTokens(tools);
        // Each tool's JSON is > 400 chars → > 100 tokens; two of them > 200.
        expect(total).toBeGreaterThan(200);
        expect(total).toBe(estimateTokens(JSON.stringify(tools[0])) + estimateTokens(JSON.stringify(tools[1])));
    });
});

describe("fitRequest — tool dropping", () => {
    it("drops least-relevant (tail) tools when the window is tight, keeps the rest in order", () => {
        // Tiny window: system + last user + a few tools only.
        const tools = [tool("keep1", 400), tool("keep2", 400), tool("drop1", 4000), tool("drop2", 4000)];
        const messages = [sys("system prompt"), user("do the thing")];
        const res = fitRequest(messages, tools, caps(2000), 256);
        expect(res.tools.length).toBeLessThan(tools.length);
        // Whatever survives must be a prefix of the original (relevance order preserved).
        expect(res.tools.map((t) => t.function?.name)).toEqual(
            tools.slice(0, res.tools.length).map((t) => t.function?.name),
        );
    });

    it("drops ALL tools rather than exceed the window", () => {
        const tools = [tool("big", 40_000)];
        const res = fitRequest([sys("s"), user("hi")], tools, caps(1000), 256);
        expect(res.tools.length).toBe(0);
        expect(res.trimmed.toolsDropped).toBe(1);
    });

    it("keeps all tools when the window is large", () => {
        const tools = [tool("a", 200), tool("b", 200), tool("c", 200)];
        const res = fitRequest([sys("s"), user("hi")], tools, caps(200_000), 1024);
        expect(res.tools.length).toBe(3);
    });
});

describe("fitRequest — history trimming", () => {
    it("keeps the last user message even under extreme pressure", () => {
        const messages = [sys("s"), user("old"), asst("reply"), user("LATEST QUESTION")];
        const res = fitRequest(messages, [], caps(200), 64);
        const texts = res.messages.map((m) => m.content);
        expect(texts).toContain("LATEST QUESTION");
    });

    it("trims older messages but preserves system + recent turns", () => {
        const big = "word ".repeat(2000); // ~2500 tokens each
        const messages = [
            sys("system"),
            user(big), asst(big), // old, should be trimmed
            user("recent question"),
        ];
        const res = fitRequest(messages, [], caps(4000), 512);
        expect(res.messages[0].role).toBe("system");
        expect(res.messages.map((m) => m.content)).toContain("recent question");
        expect(res.trimmed.historyDropped).toBeGreaterThan(0);
    });

    it("never starts trimmed history with an orphan tool/assistant-with-tool_calls message", () => {
        const messages: OAIMessage[] = [
            sys("s"),
            {role: "assistant", content: "calling", tool_calls: [{id: "1"}]},
            {role: "tool", content: "result", tool_call_id: "1"},
            user("final"),
        ];
        // Force heavy trimming with a tiny window.
        const res = fitRequest(messages, [], caps(120), 32);
        const first = res.messages[res.messages[0]?.role === "system" ? 1 : 0];
        if (first) {
            expect(first.role).not.toBe("tool");
            expect(!(first.role === "assistant" && (first as OAIMessage).tool_calls)).toBe(true);
        }
    });
});

describe("keepEssential", () => {
    it("keeps system + last user only, drops the middle", () => {
        const msgs = [sys("s"), user("old"), asst("reply"), user("latest")];
        const r = keepEssential(msgs);
        expect(r.map((m) => m.content)).toEqual(["s", "latest"]);
    });
    it("works with no system message", () => {
        const msgs = [user("a"), asst("b"), user("c")];
        expect(keepEssential(msgs).map((m) => m.content)).toEqual(["c"]);
    });
});

describe("truncateContents", () => {
    it("hard-caps long string contents and leaves short ones", () => {
        const msgs = [sys("x".repeat(9000)), user("short")];
        const r = truncateContents(msgs, 4000);
        expect((r[0].content as string).length).toBeLessThanOrEqual(4001 + 1);
        expect(r[1].content).toBe("short");
    });
    it("truncates text parts inside array content", () => {
        const msgs: OAIMessage[] = [{role: "user", content: [{type: "text", text: "y".repeat(9000)}]}];
        const r = truncateContents(msgs, 100);
        const part = (r[0].content as {type: string; text: string}[])[0];
        expect(part.text.length).toBeLessThanOrEqual(102);
    });
});

describe("fitRequest — invariant", () => {
    it("the fitted request's own estimate never exceeds the safety window", () => {
        const tools = Array.from({length: 40}, (_, i) => tool(`t${i}`, 600));
        const messages = [sys("system ".repeat(200)), user("q ".repeat(500)), asst("a ".repeat(500)), user("final question")];
        const window = 8000;
        const maxOut = 1024;
        const res = fitRequest(messages, tools, caps(window), maxOut);

        let total = maxOut + 512; // reserve
        for (const m of res.messages) {
            total += typeof m.content === "string" ? estimateTokens(m.content) : 0;
        }
        total += estimateToolTokens(res.tools);
        expect(total).toBeLessThanOrEqual(Math.floor(window * 0.9));
    });
});

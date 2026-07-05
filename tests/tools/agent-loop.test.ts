import {describe, it, expect, beforeEach} from "vitest";
import {runAgentLoop, MAX_AGENT_STEPS, DESTRUCTIVE_BUDGET_PER_RUN, type AgentDeps} from "../../electron/agent-loop";
import type {OAICompletion, OAIMessage} from "../../electron/ai-client";
import {stmClear} from "../../electron/short-term-memory";
import {clearTaint, recordTaintFromTool} from "../../electron/taint";

// ─────────────────────────────────────────────────────────────────────────────
// Audit B2 — the agent loop was extracted from main.ts precisely so these
// paths (tool feedback, loop guard, approval gate, step cap, taint escalation)
// can be exercised with mocked deps instead of a live Electron process.
// ─────────────────────────────────────────────────────────────────────────────

type Recorded = {
    events: {channel: string; payload: Record<string, unknown>}[];
    executed: {name: string; argsJson: string}[];
    approvals: {tool: string; reason: string}[];
    saved: {role: string; content: string}[];
    modelCalls: OAIMessage[][];
};

function answer(content: string): OAICompletion {
    return {choices: [{message: {content, tool_calls: undefined}}]};
}

function toolCall(name: string, args: Record<string, unknown>, id = "c1"): OAICompletion {
    return {choices: [{message: {content: null, tool_calls: [{id, type: "function", function: {name, arguments: JSON.stringify(args)}}]}}]};
}

function makeDeps(
    completions: (step: number, messages: OAIMessage[]) => OAICompletion,
    opts: Partial<AgentDeps> = {},
): {deps: AgentDeps; rec: Recorded} {
    const rec: Recorded = {events: [], executed: [], approvals: [], saved: [], modelCalls: []};
    let step = 0;
    const deps: AgentDeps = {
        send: (channel, payload) => rec.events.push({channel, payload: payload as Record<string, unknown>}),
        callModel: async (messages) => {
            rec.modelCalls.push([...messages]);
            return completions(step++, messages);
        },
        getToolSchemas: () => [],
        executeTool: async (name, argsJson) => {
            rec.executed.push({name, argsJson});
            return {ok: true, content: `ok: ${name}`};
        },
        askApproval: async (tool, _argsJson, reason) => {
            rec.approvals.push({tool, reason});
            return "deny";
        },
        saveMessage: async (role, content) => { rec.saved.push({role, content}); },
        systemContent: "system prompt",
        explainMode: false,
        isSubAgent: false,
        ...opts,
    };
    return {deps, rec};
}

// A user message that neither the reference resolver nor tool-selection treats specially.
const HISTORY = [{role: "user", content: "please summarize the project notes"}];

beforeEach(() => {
    stmClear();
    clearTaint();
});

describe("happy path", () => {
    it("tool call → result fed back to the model → final answer, chat-done exactly once", async () => {
        const {deps, rec} = makeDeps((step) =>
            step === 0 ? toolCall("spotify_play", {uri: "spotify:track:1"}) : answer("done, playing"),
        );
        await runAgentLoop(HISTORY, deps);

        expect(rec.executed).toEqual([{name: "spotify_play", argsJson: JSON.stringify({uri: "spotify:track:1"})}]);
        // second model call must contain the tool result message
        const second = rec.modelCalls[1];
        const toolMsg = second.find((m) => m.role === "tool");
        expect(toolMsg?.content).toBe("ok: spotify_play");
        expect(rec.saved.some((s) => s.role === "assistant" && s.content === "done, playing")).toBe(true);
        expect(rec.events.filter((e) => e.channel === "chat-done")).toHaveLength(1);
    });

    it("plain answer with no tool calls ends after one model call", async () => {
        const {deps, rec} = makeDeps(() => answer("hello"));
        await runAgentLoop(HISTORY, deps);
        expect(rec.modelCalls).toHaveLength(1);
        expect(rec.executed).toHaveLength(0);
        expect(rec.events.at(-1)?.channel).toBe("chat-done");
    });
});

describe("loop guard", () => {
    it("identical (tool,args) repeated: 3rd call is blocked, recovery turn runs, chat-done sent", async () => {
        const {deps, rec} = makeDeps((step) =>
            step < 3 ? toolCall("spotify_play", {uri: "same"}, `c${step}`) : answer("I seem to be stuck; stopping."),
        );
        await runAgentLoop(HISTORY, deps);

        expect(rec.executed).toHaveLength(2); // 1st and 2nd execute, 3rd blocked
        const blocked = rec.events.find((e) => e.channel === "tool-event" && String(e.payload.result ?? "").startsWith("BLOCKED (loop guard)"));
        expect(blocked).toBeTruthy();
        expect(rec.saved.some((s) => s.role === "assistant" && /stuck/.test(s.content))).toBe(true);
        expect(rec.events.filter((e) => e.channel === "chat-done")).toHaveLength(1);
    });
});

describe("approval gate", () => {
    it("taint escalation: after fetch_url, delete_file requires approval; deny blocks execution", async () => {
        recordTaintFromTool("fetch_url");
        const {deps, rec} = makeDeps((step) =>
            step === 0 ? toolCall("delete_file", {path: "C:\\x.txt"}) : answer("okay, I won't delete it"),
        );
        await runAgentLoop(HISTORY, deps);

        expect(rec.approvals).toEqual([{tool: "delete_file", reason: "taint"}]);
        expect(rec.executed).toHaveLength(0); // never reached executeTool
        const deny = rec.events.find((e) => e.channel === "tool-event" && String(e.payload.result ?? "").startsWith("BLOCKED (user denied approval)"));
        expect(deny).toBeTruthy();
        expect(rec.events.filter((e) => e.channel === "chat-done")).toHaveLength(1);
    });

    it("clean context: safe tool runs without asking for approval", async () => {
        const {deps, rec} = makeDeps((step) =>
            step === 0 ? toolCall("get_time", {}) : answer("it is noon"),
        );
        await runAgentLoop(HISTORY, deps);
        expect(rec.approvals).toHaveLength(0);
        expect(rec.executed).toHaveLength(1);
    });
});

describe("destructive budget (UX review 18.1)", () => {
    it(`after ${DESTRUCTIVE_BUDGET_PER_RUN} destructive executions, further destructive calls require approval even for subagents`, async () => {
        // Subagent mode skips the normal needsApproval gate — exactly the path
        // where 8 different files could previously be deleted with zero prompts.
        const {deps, rec} = makeDeps((step) =>
            step < DESTRUCTIVE_BUDGET_PER_RUN + 1
                ? toolCall("delete_file", {path: `C:\\tmp\\f${step}.txt`}, `c${step}`)
                : answer("stopping"),
            {isSubAgent: true},
        );
        await runAgentLoop(HISTORY, deps);

        expect(rec.executed).toHaveLength(DESTRUCTIVE_BUDGET_PER_RUN); // budget's worth ran free
        expect(rec.approvals).toEqual([{tool: "delete_file", reason: "budget"}]); // the next one asked
        const deny = rec.events.find((e) => e.channel === "tool-event" && String(e.payload.result ?? "").startsWith("BLOCKED (user denied approval)"));
        expect(deny).toBeTruthy();
        expect(rec.events.filter((e) => e.channel === "chat-done")).toHaveLength(1);
    });

    it("non-destructive tools are not counted against the budget", async () => {
        const {deps, rec} = makeDeps((step) =>
            step < 6 ? toolCall("spotify_play", {round: step}, `c${step}`) : answer("done"),
            {isSubAgent: true},
        );
        await runAgentLoop(HISTORY, deps);
        expect(rec.approvals).toHaveLength(0);
        expect(rec.executed).toHaveLength(6);
    });
});

describe("step cap", () => {
    it(`stops after ${MAX_AGENT_STEPS} tool rounds with an explicit limit notice`, async () => {
        // different args each round → loop guard never triggers, only the cap does
        // (non-poll tool name: poll tools like get_* have their own tighter budget)
        const {deps, rec} = makeDeps((step) => toolCall("spotify_play", {round: step}, `c${step}`));
        await runAgentLoop(HISTORY, deps);

        expect(rec.modelCalls).toHaveLength(MAX_AGENT_STEPS);
        const limitNote = rec.events.find((e) => e.channel === "chat-delta" && /Tool loop limit reached/.test(String(e.payload.text ?? "")));
        expect(limitNote).toBeTruthy();
        expect(rec.events.at(-1)?.channel).toBe("chat-done");
    });
});

describe("subagent mode", () => {
    it("skips the reference resolver and still completes", async () => {
        // "tekrar yap" would hit the resolver in main flow; subagents must go straight to the LLM
        const {deps, rec} = makeDeps(() => answer("sub done"), {isSubAgent: true});
        await runAgentLoop([{role: "user", content: "tekrar yap"}], deps);
        expect(rec.modelCalls).toHaveLength(1);
        expect(rec.events.at(-1)?.channel).toBe("chat-done");
    });
});

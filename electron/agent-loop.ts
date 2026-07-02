/**
 * Agent loop (audit B2) — extracted from main.ts so the riskiest code in the app
 * (tool execution pipeline: loop guard → approval gate → taint → error taxonomy →
 * self-healing) is unit-testable with mocked deps instead of living inside an
 * Electron-only 1,800-line module.
 *
 * Everything Electron/state-bound is injected via AgentDeps (built in main.ts);
 * pure/RAM-only modules (loop-guard, taint, stm, permissions, error taxonomy)
 * are imported directly — they are the logic under test, not environment.
 */

import type {ChatCompletionTool} from "groq-sdk/resources/chat/completions";
import type {ToolOutcome} from "./tools";
import {extractTextContent, type MsgPart, type OAIMessage, type OAICompletion} from "./ai-client";
import {resolveReference, explainResolution, CONFIDENCE_THRESHOLD} from "./reference-resolver";
import {LoopGuard} from "./loop-guard";
import {classifyError} from "./goal-executor";
import {diagnose} from "./self-healing";
import {stmGet, stmRecord} from "./short-term-memory";
import {needsApproval, grantAlways} from "./permissions";
import {recordTaintFromTool, taintRequiresApproval} from "./taint";
import {recordToolUsage} from "./memory-plus";
import {captureStep as routineCaptureStep} from "./routines";

/** Hard cap on model↔tool round-trips per request (degenerate loops are cut earlier by LoopGuard). */
export const MAX_AGENT_STEPS = 8;

export interface AgentDeps {
    /** Send an event to the UI (already bound to the request id + feed broadcast). */
    send: (channel: string, payload: object) => void;
    /** One model call — bound to provider/settings/model/client in main.ts. */
    callModel: (messages: OAIMessage[], onDelta: (text: string) => void, tools: ChatCompletionTool[]) => Promise<OAICompletion>;
    /** Tool schemas for this conversation context (provider limits applied). */
    getToolSchemas: (context: string) => ChatCompletionTool[];
    executeTool: (name: string, argsJson: string) => Promise<ToolOutcome>;
    /** Destructive-action dialog. taintGated=true must never auto-allow. */
    askApproval: (tool: string, argsJson: string, taintGated: boolean) => Promise<"allow" | "always" | "deny">;
    saveMessage: (role: "user" | "assistant" | "tool", content: string, toolName?: string) => Promise<void>;
    /** Fully built system prompt (persona + profile + memory + STM + routine note). */
    systemContent: string;
    explainMode: boolean;
    isSubAgent: boolean;
}

export async function runAgentLoop(history: {role: string; content: string | MsgPart[]}[], deps: AgentDeps): Promise<void> {
    const {send, isSubAgent} = deps;

    // History trimming happens INSIDE callAI (ai-client.ts trimToBudget), based on the
    // MODEL's actual context window in tokens. A second, message-count-based trim here
    // was redundant and could disagree with it (e.g. 60 short messages vs 60 huge ones
    // get the same treatment) — token budget is the single source of truth.
    const messages: OAIMessage[] = [{role: "system", content: deps.systemContent}, ...history];

    // Compute the tool list once before the loop starts — the same list is sent at
    // every step in the chain. This prevents Groq's "tool not in request.tools" error.
    const lastUserForTools = [...messages].reverse().find((m) => m.role === "user");
    const toolContextStr = lastUserForTools ? extractTextContent(lastUserForTools.content) : "";

    // ── Deterministic Reference Resolver ─────────────────────────────────────
    // ONLY kicks in for reference expressions ("do it again", "turn it down a bit",
    // "turn it off", "the last one I played"…). Returns null for everything else and
    // the message continues through the normal LLM flow untouched.
    if (!isSubAgent) {
        const resolved = resolveReference(toolContextStr);
        if (resolved) {
            if (deps.explainMode) send("chat-delta", {text: explainResolution(resolved) + "\n\n"});

            if (resolved.kind === "clarify" || resolved.confidence < CONFIDENCE_THRESHOLD) {
                const q = resolved.kind === "clarify" ? resolved.question
                    : "I wasn't quite sure — could you clarify what you'd like me to do?";
                send("chat-delta", {text: q});
                await deps.saveMessage("assistant", q).catch((e) => console.error("[saveMessage]", e.message));
                send("chat-done", {});
                return;
            }

            // confidence ≥ threshold → run the tool deterministically, skip the LLM.
            const argsJson = JSON.stringify(resolved.args);
            send("tool-event", {phase: "start", name: resolved.tool, args: argsJson});
            recordToolUsage(resolved.tool);
            let outcome: ToolOutcome;
            try {
                outcome = await deps.executeTool(resolved.tool, argsJson);
                recordTaintFromTool(resolved.tool, resolved.args); // A3
            } catch (e) {
                outcome = {ok: false, content: `Tool error: ${(e as Error).message ?? String(e)}`};
            }
            const result = outcome.content;
            // C1 — success comes from the outcome envelope, not a local prefix regex.
            stmRecord(resolved.tool, argsJson, result, outcome.ok, "resolver");
            send("tool-event", {phase: "done", name: resolved.tool, result: result.slice(0, 400)});
            await deps.saveMessage("tool", result.slice(0, 1000), resolved.tool).catch((e) => console.error("[saveMessage]", e.message));

            const reply = `${resolved.intent}: ${result}`.slice(0, 600);
            send("chat-delta", {text: reply});
            await deps.saveMessage("assistant", reply).catch((e) => console.error("[saveMessage]", e.message));
            send("chat-done", {});
            return;
        }
    }

    const lockedTools = deps.getToolSchemas(toolContextStr);

    // Phase 53 — Loop Guard: catch degenerate tool-call loops early.
    // Each run opens its own instance (parallel request isolation).
    const guard = new LoopGuard();
    // Phase 59 — Self-Healing: a repeated-error diagnosis is injected at most once.
    let healInjected = false;

    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
        // Groq: tokens stream via onDelta. Other providers: full response returned.
        const completion = await deps.callModel(messages, (text) => send("chat-delta", {text}), lockedTools);

        const msg = completion.choices[0]?.message;
        const content = msg?.content ?? "";
        const toolCalls = (msg?.tool_calls ?? []) as {id: string; type: "function"; function: {name: string; arguments: string}}[];

        // callModel calls onDelta for all providers — don't send again here.

        if (toolCalls.length === 0) {
            if (content) await deps.saveMessage("assistant", content).catch((e) => console.error("[saveMessage]", e.message));
            send("chat-done", {});
            return;
        }

        messages.push({role: "assistant", content: content || null, tool_calls: toolCalls} as OAIMessage);

        // Phase 53 — loop detection: blocked calls NEVER reach executeTool,
        // an explanatory result is returned to the model (so it can recover/stop).
        let blockedCount = 0;
        // Run all tool calls in parallel — allSettled so one failure doesn't abort others
        const settled = await Promise.allSettled(
            toolCalls.map(async (call) => {
                const name = call.function.name;
                const argsJson = call.function.arguments || "{}";
                let parsedArgs: unknown = {};
                try { parsedArgs = JSON.parse(argsJson); } catch { /* continue with raw string */ parsedArgs = argsJson; }
                const verdict = guard.check(name, parsedArgs);
                if (!verdict.ok) {
                    blockedCount++;
                    const blockMsg = `BLOCKED (loop guard): ${verdict.reason}`;
                    send("tool-event", {phase: "done", name, result: blockMsg});
                    stmRecord(name, argsJson, blockMsg, false, "llm");
                    return {id: call.id, content: blockMsg};
                }
                // Phase 54 — Destructive action approval gate: ask the user if risky + no permanent permission.
                // Audit A3 — taint escalation: once the conversation ingested external content
                // (web/RSS/clipboard/foreign files), destructive tools ALWAYS require a click —
                // "always allow" grants, subagent status and Full PC Access don't bypass it,
                // because the model may be executing instructions injected by that content.
                const pArgs = (parsedArgs && typeof parsedArgs === "object") ? parsedArgs as Record<string, unknown> : {};
                const taintGated = taintRequiresApproval(name);
                if (taintGated || (!isSubAgent && needsApproval(name, pArgs))) {
                    const decision = await deps.askApproval(name, argsJson, taintGated);
                    if (decision === "deny") {
                        const denyMsg = `BLOCKED (user denied approval): "${name}" is a destructive action and the user did not allow it.`;
                        send("tool-event", {phase: "done", name, result: denyMsg});
                        stmRecord(name, argsJson, denyMsg, false, "llm");
                        return {id: call.id, content: denyMsg};
                    }
                    // Under taint, "always" only applies to this call — a persistent grant
                    // would let the next injected instruction run without any human in the loop.
                    if (decision === "always" && !taintGated) grantAlways(name);
                }
                send("tool-event", {phase: "start", name, args: argsJson});
                recordToolUsage(name);
                const outcome = await deps.executeTool(name, argsJson);
                recordTaintFromTool(name, pArgs); // A3 — external content entered the context
                // Phase 56 — classify the result into the error taxonomy for the model steer;
                // C1 — the success/failure DECISION comes from the outcome envelope (the
                // taxonomy can still flag semantic errors inside an ok-shaped text).
                const ev = classifyError(outcome.content);
                stmRecord(name, argsJson, outcome.content, outcome.ok && !ev.isError, "llm");
                // Phase 52 — if routine recording is active, capture this action (for deterministic replay)
                try { routineCaptureStep(name, JSON.parse(argsJson || "{}")); } catch { /* parse failed → skip */ }
                send("tool-event", {phase: "done", name, result: outcome.content.slice(0, 400)});
                await deps.saveMessage("tool", outcome.content.slice(0, 1000), name).catch((e) => console.error("[saveMessage]", e.message));
                const forModel = outcome.content;
                let clipped = forModel.length > 6000
                    ? forModel.slice(0, 6000) + `\n\n[...truncated, ${forModel.length} characters total]`
                    : forModel;
                // For non-retriable errors (target not found / argument error / permission),
                // add a clear steer to the model — don't repeat the same call.
                if (ev.isError && !ev.retriable && ev.kind !== "fatal") {
                    clipped += `\n\n[GUIDANCE: ${ev.advice}]`;
                }
                return {id: call.id, content: clipped};
            })
        );
        const toolResults = settled.map((r, i) => {
            if (r.status === "fulfilled") return r.value;
            const errMsg = `Tool error: ${(r.reason as Error).message ?? String(r.reason)}`;
            stmRecord(toolCalls[i].function.name, toolCalls[i].function.arguments || "{}", errMsg, false, "llm");
            return {id: toolCalls[i].id, content: errMsg};
        });
        for (const r of toolResults) {
            messages.push({role: "tool", tool_call_id: r.id, content: r.content});
        }

        // Phase 59 — Self-Healing: if there's a recurring (tool-family, error-class)
        // pattern in STM history (same domain failing 3+ times with the same error type),
        // inject a CLEAR diagnosis + strategy into the model — once. This redirects instead of blind repetition.
        if (!healInjected) {
            const diag = diagnose(stmGet().recentTools.map((e) => ({tool: e.tool, success: e.success, result: e.result})));
            if (diag.detected) {
                healInjected = true;
                messages.push({role: "system", content: `[SELF-HEALING DIAGNOSIS] ${diag.advice}`} as OAIMessage);
            }
        }

        // Phase 53 — if all calls in this turn were blocked by loop guard, the model
        // is in a vicious cycle; we give it one more turn with the LLM to recover and
        // then cut it off (the model sees the block result and writes a proper closing).
        if (blockedCount === toolCalls.length) {
            const recovery = await deps.callModel(messages, (text) => send("chat-delta", {text}), lockedTools);
            const rMsg = recovery.choices[0]?.message;
            if (rMsg?.content && !(rMsg?.tool_calls?.length)) {
                await deps.saveMessage("assistant", rMsg.content).catch((e) => console.error("[saveMessage]", e.message));
            }
            send("chat-done", {});
            return;
        }
    }

    send("chat-delta", {text: "\n\n(Tool loop limit reached.)"});
    send("chat-done", {});
}

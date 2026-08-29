/**
 * Application state.
 *
 * Svelte 5 runes: `$state` makes a plain object reactive, so components
 * read `chat.messages` and re-render when it changes — no subscriptions,
 * no boilerplate.
 *
 * The store owns *interface* state only. Conversation history for the
 * model, keys and settings live in Rust; this mirrors what needs drawing.
 */

import {
    api,
    on,
    type ApprovalEvent,
    type AutomationEvent,
    type DeltaEvent,
    type DoneEvent,
    type ErrorEvent,
    type Status,
    type ToolDoneEvent,
    type ToolStartEvent,
    type VoiceEvent,
} from "./api";

export type Speaker =
    | "user"
    | "assistant"
    | "system"
    | "error"
    | "tool"
    /**
   * A permission request, asked inline.
   *
   * It is a message rather than a modal on purpose: a modal steals focus the
   * moment it appears, which is intolerable when the thing it interrupts is
   * the sentence you were typing. Inline, the agent still waits — it just
   * waits where the rest of the conversation is.
   */
    | "approval";

export interface Message {
    id: number;
    speaker: Speaker;
    text: string;
    /** Tool messages carry their outcome, for the ✓ / ✗ marker. */
    ok?: boolean;
    /** True while a reply is still streaming in. */
    streaming?: boolean;
    /** Tool messages: what it was called with, shown when expanded. */
    args?: string;
    /** Tool messages: the fuller output, shown when expanded. */
    detail?: string;
    /** Approval messages: why permission is being asked. */
    reason?: "risk" | "budget";
    /** Approval messages: what the user chose, once they have chosen. */
    decision?: "allow" | "always" | "deny";
    at: number;
}

export interface PendingApproval {
    tool: string;
    args: string;
    reason: "risk" | "budget";
    /** The feed message showing this request, so the answer can land on it. */
    messageId: number;
}

/**
 * Which interface is on screen.
 *
 * Chat is the default; the others are modes reached from it rather than
 * separate windows, so the conversation is never left behind.
 */
export type Interface = "chat" | "code" | "canvas" | "council";

/** What the assistant is doing — drives the core animation. */
export type CoreState =
    | "idle"
    | "listening"
    | "thinking"
    | "speaking"
    | "working";

let nextId = 1;

class ChatStore {
    messages = $state<Message[]>([]);
    input = $state("");
    status = $state<Status | null>(null);
    approval = $state<PendingApproval | null>(null);
    runningTool = $state<string | null>(null);
    /** Arguments of the running tool, held until its result arrives. */
    runningArgs = $state("");
    /** Microphone level, 0.0–1.0. Polled faster than the rest of the status. */
    micLevel = $state(0);
    /** Panel currently open in the right rail, if any. */
    panel = $state<"none" | "settings" | "memory" | "automations" | "tools">(
        "none",
    );
    /** Which interface is showing. */
    view = $state<Interface>("chat");

    private unlisteners: (() => void)[] = [];

    /** The state the core visual should show. */
    get coreState(): CoreState {
        if (this.status?.speaking) return "speaking";
        if (this.runningTool) return "working";
        if (this.status?.busy) return "thinking";
        if (this.status && this.status.voiceMode !== "off") return "listening";
        return "idle";
    }

    add(speaker: Speaker, text: string, extra: Partial<Message> = {}): Message {
        const message: Message = {
            id: nextId++,
            speaker,
            text,
            at: Date.now(),
            ...extra,
        };
        this.messages.push(message);
        return message;
    }

    /**
   * Appends a chunk to the streaming reply, starting one if needed.
   *
   * Deltas arrive many times a second; creating a message per chunk would
   * fill the feed with fragments.
   */
    appendDelta(text: string) {
        const last = this.messages[this.messages.length - 1];
        if (last?.speaker === "assistant" && last.streaming) {
            last.text += text;
        } else {
            this.add("assistant", text, { streaming: true });
        }
    }

    finishStreaming() {
        const last = this.messages[this.messages.length - 1];
        if (last?.streaming) {
            last.streaming = false;
            // A reply that produced only tool calls has no text of its own;
            // an empty bubble would just be noise.
            if (!last.text.trim()) {
                this.messages.pop();
            }
        }
    }

    async refresh() {
        try {
            this.status = await api.status();
        } catch (e) {
            console.error("status failed", e);
        }
    }

    async send(text: string) {
        const trimmed = text.trim();
        if (!trimmed || this.status?.busy) return;

        this.add("user", trimmed);
        this.input = "";

        try {
            await api.send(trimmed);
            await this.refresh();
        } catch (e) {
            this.add("error", String(e));
        }
    }

    async clear() {
        await api.clear();
        this.messages = [];
        this.add("system", "Conversation cleared. Remembered facts are kept.");
        await this.refresh();
    }

    async answerApproval(decision: "allow" | "always" | "deny") {
        const pending = this.approval;
        // Cleared first: the agent thread unblocks the moment the command lands,
        // and a second click while it is in flight would answer twice.
        this.approval = null;
        if (!pending) return;

        // The request stays in the feed, marked with what was decided. Removing
        // it would leave no record that a destructive action was ever offered.
        const message = this.messages.find((m) => m.id === pending.messageId);
        if (message) message.decision = decision;

        await api.answerApproval(decision);
    }

    async cycleVoice() {
        try {
            const mode = await api.cycleVoice();
            this.add("system", `Voice: ${mode}`);
            await this.refresh();
        } catch (e) {
            this.add("error", String(e));
        }
    }

    async stopSpeaking() {
        await api.stopSpeaking();
        await this.refresh();
    }

    /** Wires up backend events and the status poll. */
    async start() {
        const restored = await api.loadHistory();
        for (const line of restored) {
            this.add(line.role === "user" ? "user" : "assistant", line.content);
        }
        if (restored.length > 0) {
            this.add("system", `${restored.length} messages restored`);
        }

        await this.refresh();

        if (!this.status?.keys.length) {
            this.add(
                "system",
                "No API key yet. Open settings, or type /key groq <your-key>.",
            );
        }

        this.unlisteners = await Promise.all([
            on<DeltaEvent>("chat:delta", (p) => this.appendDelta(p.text)),

            on<DoneEvent>("chat:done", () => {
                this.finishStreaming();
                this.runningTool = null;
                void this.refresh();
            }),

            on<ErrorEvent>("chat:error", (p) => {
                this.finishStreaming();
                this.runningTool = null;
                this.add("error", p.message);
                void this.refresh();
            }),

            on<ToolStartEvent>("chat:tool-start", (p) => {
                // Close the streaming bubble: the tool line belongs between the
                // model's text and whatever it says next.
                this.finishStreaming();
                this.runningTool = p.tool;
                this.runningArgs = p.args;
            }),

            on<ToolDoneEvent>("chat:tool-done", (p) => {
                this.add("tool", `${p.tool} — ${p.summary}`, {
                    ok: p.ok,
                    // Kept on the message so the line can be opened later, not only
                    // while it is the most recent thing that happened.
                    args: this.runningArgs,
                    detail: p.detail,
                });
                this.runningTool = null;
                this.runningArgs = "";
            }),

            on<ApprovalEvent>("chat:approval", (p) => {
                this.finishStreaming();
                const message = this.add("approval", p.tool, {
                    args: p.args,
                    reason: p.reason,
                });
                this.approval = { ...p, messageId: message.id };
            }),

            on<VoiceEvent>("voice", (event) => {
                switch (event.kind) {
                    case "heard":
                        void this.send(event.text);
                        break;
                    case "woke":
                        this.add("system", "Listening…");
                        break;
                    case "notice":
                        this.add("system", event.text);
                        break;
                    case "speaking":
                        void this.refresh();
                        break;
                }
            }),

            on<AutomationEvent>("automation", (p) => {
                this.add("system", `Automation fired — ${p.trigger}`);
                void this.send(p.prompt);
            }),

            // The Spotify consent round trip finishes on a worker thread, long
            // after the command that started it returned.
            on<{ ok: boolean; message: string }>("spotify:auth", (p) => {
                this.add("system", p.message);
            }),
        ]);

        // Poll for telemetry. One second is enough for CPU and battery, and
        // the core animation runs on CSS, not on this.
        const timer = setInterval(() => void this.refresh(), 1000);
        this.unlisteners.push(() => clearInterval(timer));

        // The level meter needs to move with the voice, not once a second — but
        // only while something is listening. `get_status` is far too heavy to ask
        // ten times a second, so this reads the level alone.
        const levelTimer = setInterval(() => {
            if (!this.status || this.status.voiceMode === "off") {
                this.micLevel = 0;
                return;
            }
            void api
                .micLevel()
                .then((level) => (this.micLevel = level))
                .catch(() => (this.micLevel = 0));
        }, 100);
        this.unlisteners.push(() => clearInterval(levelTimer));
    }

    stop() {
        for (const off of this.unlisteners) off();
        this.unlisteners = [];
    }
}

export const chat = new ChatStore();

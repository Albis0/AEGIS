/**
 * The bridge to Rust.
 *
 * Every call the interface can make lives here, typed. Components never
 * touch `invoke` directly — that keeps the contract in one place, so a
 * rename on the Rust side breaks in exactly one file.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface ProviderInfo {
  id: string;
  needsKey: boolean;
  hasKey: boolean;
  defaultModel: string;
}

export interface Status {
  version: string;
  assistantName: string;
  language: string;
  provider: string;
  model: string;
  providers: ProviderInfo[];
  keys: string[];
  toolCount: number;
  historyLen: number;
  factCount: number;
  automationCount: number;
  messageCount: number;
  voiceMode: "off" | "continuous" | "wake";
  busy: boolean;
  speaking: boolean;
  cpu: number | null;
  battery: number | null;
  uptimeSecs: number;
  dataDir: string;
  windowMode: string;
  fontSize: number;
}

export interface StoredLine {
  role: string;
  content: string;
}

export interface Fact {
  id: number;
  text: string;
}

export interface Automation {
  id: number;
  prompt: string;
  trigger: string;
  enabled: boolean;
}

export interface Tool {
  name: string;
  description: string;
  domain: string;
  risk: "safe" | "moderate" | "destructive";
}

// ── Commands ─────────────────────────────────────────────────────────

export const api = {
  status: () => invoke<Status>("get_status"),
  loadHistory: () => invoke<StoredLine[]>("load_history"),

  send: (text: string) => invoke<void>("send_message", { text }),
  answerApproval: (decision: "allow" | "always" | "deny") =>
    invoke<void>("answer_approval", { decision }),
  clear: () => invoke<void>("clear_conversation"),

  setKey: (provider: string, key: string) =>
    invoke<void>("set_key", { provider, key }),
  setProvider: (provider: string) =>
    invoke<string>("set_provider", { provider }),
  setModel: (model: string) => invoke<void>("set_model", { model }),
  listModels: () => invoke<string[]>("list_models"),
  setSetting: (field: string, value: string) =>
    invoke<void>("set_setting", { field, value }),

  cycleVoice: () => invoke<string>("cycle_voice"),
  stopSpeaking: () => invoke<void>("stop_speaking"),

  listFacts: () => invoke<Fact[]>("list_facts"),
  forgetFact: (id: number) => invoke<boolean>("forget_fact", { id }),

  listAutomations: () => invoke<Automation[]>("list_automations"),
  deleteAutomation: (id: number) =>
    invoke<boolean>("delete_automation", { id }),
  toggleAutomation: (id: number, enabled: boolean) =>
    invoke<boolean>("toggle_automation", { id, enabled }),

  listTools: () => invoke<Tool[]>("list_tools"),
};

// ── Events ───────────────────────────────────────────────────────────

export interface DeltaEvent {
  text: string;
}
export interface DoneEvent {
  text: string;
}
export interface ErrorEvent {
  message: string;
}
export interface ToolStartEvent {
  tool: string;
}
export interface ToolDoneEvent {
  tool: string;
  ok: boolean;
  summary: string;
}
export interface ApprovalEvent {
  tool: string;
  args: string;
  reason: "risk" | "budget";
}
export interface AutomationEvent {
  id: number;
  prompt: string;
  trigger: string;
}

export type VoiceEvent =
  | { kind: "heard"; text: string }
  | { kind: "woke" }
  | { kind: "notice"; text: string }
  | { kind: "speaking"; active: boolean };

/**
 * Subscribes to a backend event.
 *
 * Returns the unsubscribe function; callers must keep it and call it on
 * teardown, or handlers accumulate across component remounts.
 */
export function on<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<UnlistenFn> {
  return listen<T>(event, (e) => handler(e.payload));
}

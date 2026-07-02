/**
 * Data/config IPC (audit B3) — weather, widget tool calls, sessions, model
 * catalog, config get/set, local API server toggle. Extracted from main.ts.
 */

import {ipcMain} from "electron";
import type {AppSettings} from "../settings";
import {loadConfig, saveConfig, applyConfig, maskedConfig, sanitizeConfigPatch, type AegisConfig} from "../config";
import {executeTool, isWidgetSafeTool} from "../tools";
import {getSessions, getSessionMessages} from "../db";
import {fetchModels} from "../models";
import {getModelCapabilities} from "../model-capabilities";
import {getProviderKey} from "../ai-client";
import {startApiServer, stopApiServer, getApiInfo} from "../api-server";

export interface DataIpcDeps {
    getSettings: () => AppSettings;
    getWeather: () => Promise<object>;
    /** Called after config-set persisted+applied a new config (main rebuilds the Groq client). */
    onConfigApplied: (updated: AegisConfig) => void;
    /** new-chat: summarize + reset session history/STM/taint (owned by main). */
    resetSession: () => Promise<void>;
}

export function registerDataIpc(deps: DataIpcDeps): void {
    const {getSettings, getWeather, onConfigApplied, resetSession} = deps;

    ipcMain.handle("weather", () => getWeather());

    // Phase 63 — Generic tool call (for UI widgets/modals). Domain widgets pull
    // live data from here. Security (audit A1): this channel bypasses the agent
    // loop's approval gate, so it is restricted to an explicit allowlist — a
    // compromised renderer must not reach run_command/delete_file through here.
    ipcMain.handle("run-tool", async (_e, {name, args}: {name: string; args?: Record<string, unknown>}) => {
        if (!isWidgetSafeTool(name)) {
            console.warn(`[run-tool] blocked non-allowlisted tool from renderer: "${name}"`);
            return `BLOCKED: tool "${name}" is not allowed from UI widgets.`;
        }
        try {
            return await executeTool(name, JSON.stringify(args ?? {}));
        } catch (e) {
            return `ERROR: ${(e as Error).message ?? String(e)}`;
        }
    });

    // Live model list — from the provider's official endpoint (fixes the made-up-ID problem).
    ipcMain.handle("models-list", async (_e, {provider, key}: {provider: string; key?: string}) => {
        const s = getSettings();
        const useKey = (key ?? "").trim() || getProviderKey(provider, s);
        return fetchModels(provider, useKey, s.ollamaUrl);
    });

    // Capabilities of the selected model (tool/vision/reasoning/limit) — shown as
    // badges in the Model tab. The user sees clearly what the model can and can't do.
    ipcMain.handle("caps-get", (_e, {provider, model}: {provider: string; model: string}) => {
        return getModelCapabilities(provider, model, getSettings().ollamaNumCtx ?? 4096);
    });

    // Security (audit A2): the renderer only ever receives MASKED key values —
    // it renders LLM output + user CSS, so raw keys over IPC = one XSS away from
    // full credential exfiltration. Full config (all fields, not just the 5 env
    // ones) is loaded so optional keys display their set-state too.
    ipcMain.handle("config-get", () => {
        const full: AegisConfig = {
            groqApiKey: process.env.GROQ_API_KEY ?? "",
            supabaseUrl: process.env.SUPABASE_URL ?? "",
            supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? "",
            tavilyApiKey: process.env.TAVILY_API_KEY ?? "",
            serperApiKey: process.env.SERPER_API_KEY ?? "",
            ...(loadConfig() ?? {}),
        };
        return maskedConfig(full);
    });
    ipcMain.handle("config-set", (_e, rawPatch: Partial<AegisConfig>) => {
        // Drop masked values echoed back by the UI — only genuinely new input lands.
        const patch = sanitizeConfigPatch(rawPatch);
        const existing = loadConfig() ?? {
            groqApiKey: process.env.GROQ_API_KEY ?? "",
            supabaseUrl: process.env.SUPABASE_URL ?? "",
            supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? "",
        };
        const updated: AegisConfig = {...existing, ...patch};
        saveConfig(updated);
        applyConfig(updated);
        onConfigApplied(updated);
    });

    ipcMain.handle("sessions-list", async () => getSessions(25).catch(() => []));
    ipcMain.handle("session-messages", async (_e, {sessionId}: {sessionId: string}) =>
        getSessionMessages(sessionId).catch(() => []),
    );
    ipcMain.handle("new-chat", () => resetSession());

    ipcMain.handle("api-info", () => getApiInfo());
    ipcMain.handle("api-server-toggle", (_e, enable: boolean) => {
        if (enable) return startApiServer();
        stopApiServer(); return "API server stopped.";
    });
}

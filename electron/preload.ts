import {contextBridge, ipcRenderer} from "electron";

contextBridge.exposeInMainWorld("jarvis", {
    // Fire a streaming chat request; replies arrive via on('chat-delta'|'tool-event'|'chat-done')
    sendChat: (messages: unknown[], reqId: string) => ipcRenderer.send("chat-stream", {messages, reqId}),

    on: (channel: string, cb: (payload: any) => void) => {
        const listener = (_e: unknown, payload: any) => cb(payload);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    },

    weather: () => ipcRenderer.invoke("weather"),

    // Transcribe audio buffer via Groq Whisper; returns { text: string } or { error: string }
    transcribe: (audioBuffer: ArrayBuffer) => ipcRenderer.invoke("transcribe", audioBuffer),
    tts: (text: string) => ipcRenderer.invoke("tts", text),

    settingsGet: () => ipcRenderer.invoke("settings-get"),
    settingsSet: (patch: Record<string, unknown>) => ipcRenderer.invoke("settings-set", patch),
    configGet: () => ipcRenderer.invoke("config-get"),
    configSet: (patch: Record<string, unknown>) => ipcRenderer.invoke("config-set", patch),
    setupSave: (config: Record<string, string>) => ipcRenderer.invoke("setup-save", config),

    // Auth (Faz 30)
    authSignUp: (email: string, password: string) => ipcRenderer.invoke("auth-sign-up", {email, password}),
    authSignIn: (email: string, password: string) => ipcRenderer.invoke("auth-sign-in", {email, password}),
    authSignOut: () => ipcRenderer.invoke("auth-sign-out"),
    authCurrentUser: () => ipcRenderer.invoke("auth-current-user"),
    onboardingComplete: (mode: string) => ipcRenderer.invoke("onboarding-complete", mode),

    screenshot: () => ipcRenderer.invoke("screenshot"),

    sessionsList: () => ipcRenderer.invoke("sessions-list"),
    sessionMessages: (sessionId: string) => ipcRenderer.invoke("session-messages", {sessionId}),

    minimize: () => ipcRenderer.send("win-minimize"),
    maximize: () => ipcRenderer.send("win-maximize"),
    fullscreen: () => ipcRenderer.send("win-fullscreen"),
    close: () => ipcRenderer.send("win-close"),

    apiInfo: () => ipcRenderer.invoke("api-info"),
    apiServerToggle: (enable: boolean) => ipcRenderer.invoke("api-server-toggle", enable),
});

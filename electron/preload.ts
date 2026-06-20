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
    ttsKokoroInstalled: (): Promise<boolean> => ipcRenderer.invoke("tts-kokoro-installed"),
    kokoroInstall: () => ipcRenderer.invoke("kokoro-install"),
    kokoroUninstall: (): Promise<{deleted: boolean; freedMB: number; installed: boolean}> => ipcRenderer.invoke("kokoro-uninstall"),

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
    usageGet: () => ipcRenderer.invoke("usage-get"),
    modelsList: (provider: string, key?: string) => ipcRenderer.invoke("models-list", {provider, key}),
    capsGet: (provider: string, model: string) => ipcRenderer.invoke("caps-get", {provider, model}),
    onboardingComplete: (mode: string) => ipcRenderer.invoke("onboarding-complete", mode),
    restartOnboarding: () => ipcRenderer.invoke("restart-onboarding"),
    spotifyAuthorize: () => ipcRenderer.invoke("spotify-authorize"),
    spotifyNowPlaying: () => ipcRenderer.invoke("spotify-now-playing"),
    spotifyControl: (action: string, value?: number) => ipcRenderer.invoke("spotify-control", {action, value}),
    // Faz 63 — genel tool çağrısı (domain widget/modal'ları için)
    runTool: (name: string, args?: Record<string, unknown>) => ipcRenderer.invoke("run-tool", {name, args}),

    screenshot: () => ipcRenderer.invoke("screenshot"),

    sessionsList: () => ipcRenderer.invoke("sessions-list"),
    sessionMessages: (sessionId: string) => ipcRenderer.invoke("session-messages", {sessionId}),
    newChat: () => ipcRenderer.invoke("new-chat"),

    minimize: () => ipcRenderer.send("win-minimize"),
    maximize: () => ipcRenderer.send("win-maximize"),
    fullscreen: () => ipcRenderer.send("win-fullscreen"),
    close: () => ipcRenderer.send("win-close"),

    apiInfo: () => ipcRenderer.invoke("api-info"),
    apiServerToggle: (enable: boolean) => ipcRenderer.invoke("api-server-toggle", enable),
    updateInstall: () => ipcRenderer.invoke("update-install"),
    updateDownload: () => ipcRenderer.invoke("update-download"),
    checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
    getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});

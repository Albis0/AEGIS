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

    minimize: () => ipcRenderer.send("win-minimize"),
    maximize: () => ipcRenderer.send("win-maximize"),
    fullscreen: () => ipcRenderer.send("win-fullscreen"),
    close: () => ipcRenderer.send("win-close"),
});

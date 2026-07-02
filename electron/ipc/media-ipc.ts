/**
 * Media IPC (audit B3) — transcription, TTS, Kokoro install/uninstall, Spotify
 * widget controls. Extracted from main.ts; environment comes in through deps.
 */

import {ipcMain} from "electron";
import * as path from "path";
import * as os from "os";
import type Groq from "groq-sdk";
import type {AppSettings} from "../settings";
import {loadConfig} from "../config";
import {generateTts, isKokoroInstalled, loadKokoro, deleteKokoroModel} from "../tts";
import {spotifyGetState, spotifyPlay, spotifyPause, spotifyNext, spotifyPrev, spotifySetVolume} from "../spotify";

export interface MediaIpcDeps {
    getSettings: () => AppSettings;
    getGroq: () => Groq;
    sendToRenderer: (channel: string, payload: object) => void;
}

export function registerMediaIpc(deps: MediaIpcDeps): void {
    const {getSettings, getGroq, sendToRenderer} = deps;

    ipcMain.handle("spotify-now-playing", () => spotifyGetState());
    ipcMain.handle("spotify-control", (_e, {action, value}: {action: string; value?: number}) => {
        if (action === "play")   return spotifyPlay();
        if (action === "pause")  return spotifyPause();
        if (action === "next")   return spotifyNext();
        if (action === "prev")   return spotifyPrev();
        if (action === "volume") return spotifySetVolume(Number(value ?? 50));
        return "Unknown action";
    });

    ipcMain.handle("transcribe", async (_e, audioBuffer: ArrayBuffer) => {
        try {
            const buffer = Buffer.from(audioBuffer);
            const tmpPath = path.join(os.tmpdir(), `jarvis-audio-${Date.now()}.webm`);
            const fs = await import("fs");
            fs.writeFileSync(tmpPath, buffer);
            const whisperLang = getSettings().language ?? "tr";
            const whisperPrompts: Record<string, string> = {
                tr: "Türkçe konuşma. Steam, Discord, YouTube, PowerShell gibi teknik kelimeler içerebilir.",
                en: "English speech. May contain technical terms like Steam, Discord, YouTube, PowerShell.",
                de: "Deutsche Sprache. Kann technische Begriffe wie Steam, Discord, YouTube, PowerShell enthalten.",
                fr: "Discours français. Peut contenir des termes techniques comme Steam, Discord, YouTube, PowerShell.",
                es: "Habla en español. Puede contener términos técnicos como Steam, Discord, YouTube, PowerShell.",
            };
            const result = await getGroq().audio.transcriptions.create({
                file: Object.assign(fs.createReadStream(tmpPath), {name: "audio.webm"}),
                model: "whisper-large-v3-turbo",
                language: whisperLang,
                prompt: whisperPrompts[whisperLang] ?? whisperPrompts.tr,
                response_format: "json",
            });
            fs.unlinkSync(tmpPath);
            return {text: result.text};
        } catch (e) {
            return {error: (e as Error).message ?? String(e)};
        }
    });

    ipcMain.handle("tts", async (_e, text: string) => {
        try {
            const cfg = loadConfig();
            const s = getSettings();
            const buffer = await generateTts(text, {
                provider: s.ttsProvider,
                voice: s.ttsVoice,
                rate: s.ttsRate ?? 1.0,
                elevenlabsKey: cfg?.elevenlabsApiKey ?? process.env.ELEVENLABS_API_KEY ?? "",
            });
            return {buffer};
        } catch (e) {
            return {error: (e as Error).message ?? String(e)};
        }
    });

    ipcMain.handle("tts-kokoro-installed", () => isKokoroInstalled());

    let _kokoroInstalling = false;
    ipcMain.handle("kokoro-install", async () => {
        if (_kokoroInstalling) return;
        _kokoroInstalling = true;
        sendToRenderer("kokoro-install-progress", {phase: "model", percent: 0, label: "Downloading model…"});
        try {
            // Single stage: download the ONNX model weights via from_pretrained (into a writable cacheDir).
            await loadKokoro((info) => {
                if (info.status === "progress") {
                    sendToRenderer("kokoro-install-progress", {
                        phase: "model",
                        file: info.file ?? "",
                        percent: Math.round(info.progress ?? 0),
                        loaded: info.loaded ?? 0,
                        total: info.total ?? 0,
                        label: info.file ?? "",
                    });
                } else if (info.status === "done") {
                    sendToRenderer("kokoro-install-progress", {phase: "model", file: info.file ?? "", percent: 100, label: info.file ?? ""});
                }
            });
            // Did it actually download? Verify on disk — don't send a fake "ready".
            if (!isKokoroInstalled()) throw new Error("Model files could not be downloaded (disk verification failed).");
            sendToRenderer("kokoro-install-progress", {phase: "ready"});
        } catch (e) {
            const msg = (e as Error)?.message === "KOKORO_NOT_INSTALLED"
                ? "The kokoro-js library is not included in this version. Please update the app."
                : String((e as Error)?.message ?? e);
            sendToRenderer("kokoro-install-progress", {phase: "error", label: msg});
        } finally {
            _kokoroInstalling = false;
        }
    });

    // Delete the model — actual deletion + disk verification; NO fake UI change.
    ipcMain.handle("kokoro-uninstall", async () => {
        const {deleted, freedBytes} = deleteKokoroModel();
        const stillInstalled = isKokoroInstalled();
        return {deleted, freedMB: Math.round(freedBytes / 1048576), installed: stillInstalled};
    });
}

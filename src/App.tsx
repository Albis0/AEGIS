import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {CoreState} from "./components/ArcReactor";
import SettingsPanel from "./components/SettingsPanel";
import ChatHistorySidebar from "./components/ChatHistorySidebar";
import CommandPalette from "./components/CommandPalette";
import {useVoice, type VoiceMode} from "./hooks/useVoice";
import type {Telemetry, Weather, AppSettings, TelemetryWidget} from "./electron.d";
import {getSkinComp} from "./components/skins/registry";
import {UI, type Lang} from "./i18n";
import {getFamily} from "./themes";
import {applyAccent} from "./utils/color";
import type {FeedItem, Attachment} from "./types/feed";
import {updateReducer, type UpdateState, type UpdateEvent} from "./update-state";

type MsgPart = {type: "text"; text: string} | {type: "image_url"; image_url: {url: string}; name?: string} | {type: "file"; data: string; name: string; mime: string};
type LLMMsg = {role: "user" | "assistant"; content: string | MsgPart[]};

const FONT_FAMILIES: Record<string, string> = {
    jetbrains:    "'JetBrains Mono', monospace",
    sharetech:    "'Share Tech Mono', monospace",
    orbitron:     "Orbitron, sans-serif",
    oxanium:      "Oxanium, sans-serif",
    syne:         "Syne, sans-serif",
    rajdhani:     "Rajdhani, sans-serif",
    poppins:      "Poppins, sans-serif",
    inter:        "Inter, sans-serif",
    spacegrotesk: "'Space Grotesk', sans-serif",
};

function applyFont(font: string) {
    document.documentElement.style.setProperty("--ui-font", FONT_FAMILIES[font] ?? FONT_FAMILIES.jetbrains);
}

function applyCustomCss(css: string) {
    let el = document.getElementById("aegis-custom-css") as HTMLStyleElement | null;
    if (!el) {
        el = document.createElement("style");
        el.id = "aegis-custom-css";
        document.head.appendChild(el);
    }
    el.textContent = css;
}

// UI family → background variables (accent/font applied separately)
function applyFamilyBg(familyId: string) {
    const f = getFamily(familyId);
    document.documentElement.style.setProperty("--bg", f.bg);
    document.documentElement.style.setProperty("--bg-deep", f.bgDeep);
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function App() {
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [input, setInput] = useState("");
    const [state, setState] = useState<CoreState>("idle");
    const [streaming, setStreaming] = useState(false);
    const [tel, setTel] = useState<Telemetry | null>(null);
    const [weather, setWeather] = useState<Weather | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [ttsRate, setTtsRate] = useState(1.0);
    const [updateInfo, setUpdateInfo] = useState<UpdateState | null>(null);
    const [skin, setSkin] = useState<AppSettings["skin"]>("hologram");
    const [reactorStyle, setReactorStyle] = useState<AppSettings["reactorStyle"]>("rings");
    const [layout, setLayout] = useState<AppSettings["layout"]>("normal");
    const [lang, setLang] = useState<Lang>("tr");
    const [telemetryWidgets, setTelemetryWidgets] = useState<TelemetryWidget[]>([
        "cpu", "ram", "disk", "battery", "network", "gpu", "fans", "processes", "system", "activeWindow",
    ]);

    useEffect(() => {
        window.jarvis.settingsGet().then((s) => {
            setTtsRate(s.ttsRate);
            applyFamilyBg(s.uiFamily ?? "cyber");
            applyAccent(s.accentColor);
            setSkin(s.skin ?? "hologram");
            setLayout(s.layout ?? "normal");
            applyFont(s.font ?? "jetbrains");
            applyCustomCss(s.customCss ?? "");
            setLang((s.language ?? "tr") as Lang);
            if (s.telemetryWidgets) setTelemetryWidgets(s.telemetryWidgets);
            if (s.reactorStyle) setReactorStyle(s.reactorStyle);
        });
    }, []);

    const historyRef = useRef<LLMMsg[]>([]);
    const accRef = useRef("");
    const activeIdRef = useRef<string | null>(null);
    const reqIdRef = useRef<string | null>(null);
    const feedRef = useRef<HTMLDivElement>(null);

    // Sentence-level streaming TTS state
    const sentBufRef = useRef("");            // partial sentence accumulator
    const ttsQueueRef = useRef<string[]>([]); // sentences waiting to be spoken
    const ttsPlayingRef = useRef(false);      // true while a sentence is being TTS'd
    const ttsOnAllEndRef = useRef<(() => void) | null>(null); // called when queue fully drains
    const SENT_END = /(?<=[.!?])\s+|(?<=\n)\s*\n/;


    const drainTtsQueue = useCallback(() => {
        if (ttsPlayingRef.current) return;
        if (ttsQueueRef.current.length === 0) {
            const onEnd = ttsOnAllEndRef.current;
            ttsOnAllEndRef.current = null;
            onEnd?.();
            return;
        }
        const sentence = ttsQueueRef.current.shift()!;
        ttsPlayingRef.current = true;
        setState("speaking");
        speakRef.current(sentence, () => {
            ttsPlayingRef.current = false;
            drainTtsQueue();
        });
    }, []);

    // Terminal-style input history — navigate with ArrowUp/Down
    const inputHistoryRef = useRef<string[]>([]);
    const inputHistoryIdxRef = useRef(-1);
    const inputDraftRef = useRef(""); // preserve original draft while navigating
    const navigateInputHistory = useCallback((dir: "up" | "down") => {
        const hist = inputHistoryRef.current;
        if (hist.length === 0) return;
        const cur = inputHistoryIdxRef.current;
        if (dir === "up") {
            if (cur === -1) inputDraftRef.current = input; // save draft
            const next = cur === -1 ? hist.length - 1 : Math.max(0, cur - 1);
            inputHistoryIdxRef.current = next;
            setInput(hist[next]);
        } else {
            if (cur === -1) return;
            const next = cur + 1;
            if (next >= hist.length) {
                inputHistoryIdxRef.current = -1;
                setInput(inputDraftRef.current);
            } else {
                inputHistoryIdxRef.current = next;
                setInput(hist[next]);
            }
        }
    }, [input]);
    const isBusyRef = useRef(false);
    const modeRef = useRef<VoiceMode>("off");

    const inputRef = useRef<HTMLInputElement>(null);
    const focusInput = useCallback(() => { inputRef.current?.focus(); }, []);

    const [attachments, setAttachments] = useState<Attachment[]>([]);

    useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            const items = Array.from(e.clipboardData?.items ?? []);
            const imageItems = items.filter((it) => it.kind === "file" && it.type.startsWith("image/"));
            if (imageItems.length === 0) return;
            e.preventDefault();
            Promise.all(imageItems.map((it) => new Promise<Attachment>((res) => {
                const file = it.getAsFile();
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    const url = reader.result as string;
                    const name = file.name && file.name !== "image.png" ? file.name : `screenshot-${Date.now()}.png`;
                    res({name, url, mime: file.type, data: url.split(",")[1] ?? ""});
                };
                reader.readAsDataURL(file);
            }))).then((atts) => setAttachments((prev) => [...prev, ...atts]));
        };
        window.addEventListener("paste", onPaste);
        return () => window.removeEventListener("paste", onPaste);
    }, []);

    const sendText = useCallback((text: string) => {
        if (!text.trim() || isBusyRef.current) return;
        stopSpeakingRef.current();
        const reqId = uid();
        const aId = uid();
        reqIdRef.current = reqId;
        activeIdRef.current = aId;
        accRef.current = "";
        sentBufRef.current = "";
        ttsQueueRef.current = [];
        ttsPlayingRef.current = false;
        ttsOnAllEndRef.current = null;
        historyRef.current = [...historyRef.current, {role: "user", content: text.trim()}];
        setFeed((prev) => [...prev, {id: uid(), kind: "user", text: text.trim()}, {id: aId, kind: "assistant", text: "", tools: []}]);
        setStreaming(true);
        setState("thinking");
        window.jarvis.sendChat(historyRef.current, reqId);
    }, []);

    const sendWithAttachments = useCallback((text: string, atts: Attachment[]) => {
        if (!text.trim() && atts.length === 0) return;
        if (isBusyRef.current) return;
        stopSpeakingRef.current();
        const reqId = uid();
        const aId = uid();
        reqIdRef.current = reqId;
        activeIdRef.current = aId;
        accRef.current = "";
        sentBufRef.current = "";
        ttsQueueRef.current = [];
        ttsPlayingRef.current = false;
        ttsOnAllEndRef.current = null;
        const parts: MsgPart[] = [];
        for (const att of atts) {
            if (att.mime.startsWith("image/")) {
                parts.push({type: "image_url", image_url: {url: att.url}, name: att.name});
            } else {
                parts.push({type: "file", data: att.data, name: att.name, mime: att.mime});
            }
        }
        if (text.trim()) parts.push({type: "text", text: text.trim()});
        const content: string | MsgPart[] = parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts;
        historyRef.current = [...historyRef.current, {role: "user", content}];
        setFeed((prev) => [...prev,
            {id: uid(), kind: "user", text: text.trim(), attachments: atts},
            {id: aId, kind: "assistant", text: "", tools: []},
        ]);
        setStreaming(true);
        setState("thinking");
        window.jarvis.sendChat(historyRef.current, reqId);
    }, []);

    const send = useCallback(() => {
        if (!input.trim() && attachments.length === 0) return;
        if (streaming) return;
        if (input.trim()) {
            inputHistoryRef.current = [...inputHistoryRef.current, input.trim()].slice(-100);
            inputHistoryIdxRef.current = -1;
        }
        sendWithAttachments(input, attachments);
        setInput("");
        setAttachments([]);
    }, [input, attachments, streaming, sendWithAttachments]);

    const {mode, setMode, listening, activated, capturing, speak, stopSpeaking} = useVoice({
        onTranscript: sendText,
        isBusyRef,
        ttsRate,
    });
    const speakRef = useRef(speak);
    const stopSpeakingRef = useRef(stopSpeaking);
    useEffect(() => { speakRef.current = speak; }, [speak]);
    useEffect(() => { stopSpeakingRef.current = stopSpeaking; }, [stopSpeaking]);

    useEffect(() => { isBusyRef.current = streaming; }, [streaming]);
    useEffect(() => { modeRef.current = mode; }, [mode]);

    useEffect(() => {
        if (listening && state === "idle") setState("listening");
        else if (!listening && state === "listening") setState("idle");
    }, [listening, state]);

    useEffect(() => {
        const load = () => window.jarvis.weather().then(setWeather).catch(() => {});
        load();
        const t = setInterval(load, 600000);
        const unsub = window.jarvis.on("weather-update", (w) => setWeather(w as Weather));
        return () => { clearInterval(t); unsub(); };
    }, []);

    useEffect(() => {
        // Single state machine (update-state.ts) — toast lives at App level, doesn't
        // unmount on tab/setting changes; download state is therefore PRESERVED.
        const dispatch = (ev: UpdateEvent) => setUpdateInfo((prev) => updateReducer(prev, ev));
        const unsubAvail = window.jarvis.on("update-available", (info: {version: string}) => dispatch({type: "available", version: info.version}));
        const unsubProg  = window.jarvis.on("update-progress", (p: {percent: number}) => dispatch({type: "progress", percent: p?.percent ?? 0}));
        const unsubDone  = window.jarvis.on("update-downloaded", (info: {version?: string}) => dispatch({type: "downloaded", version: info?.version}));
        const unsubErr   = window.jarvis.on("update-error", (e: {message: string}) => dispatch({type: "error", message: e?.message ?? "Güncelleme hatası"}));
        return () => { unsubAvail(); unsubProg(); unsubDone(); unsubErr(); };
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "F11") { e.preventDefault(); window.jarvis.fullscreen(); }
            if (e.key === "Escape") { stopSpeaking(); setState(modeRef.current !== "off" ? "listening" : "idle"); }
            if (e.ctrlKey && e.key === "l") { e.preventDefault(); focusInput(); return; }
            if (e.ctrlKey && e.key === " ") { e.preventDefault(); if (!isBusyRef.current) setPaletteOpen(true); return; }
            if (e.key === "m" || e.key === "M") {
                if (document.activeElement?.tagName === "INPUT") return;
                const next: VoiceMode = modeRef.current === "off" ? "always-on" : modeRef.current === "always-on" ? "wake-word" : "off";
                setMode(next);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [stopSpeaking, setMode, focusInput]);

    useEffect(() => {
        feedRef.current?.scrollTo({top: feedRef.current.scrollHeight, behavior: "smooth"});
    }, [feed]);

    useEffect(() => {
        const offs = [
            window.jarvis.on("telemetry", (d: Telemetry) => setTel(d)),

            window.jarvis.on("chat-delta", ({reqId, text}: any) => {
                if (reqId !== reqIdRef.current) return;
                accRef.current += text;
                setState((s) => (s === "error" ? s : "thinking"));
                const aId = activeIdRef.current;
                setFeed((prev) => prev.map((it) => (it.id === aId && it.kind === "assistant" ? {...it, text: accRef.current} : it)));

                // Sentence-level TTS: buffer tokens and queue complete sentences immediately
                sentBufRef.current += text;
                let match: RegExpExecArray | null;
                while ((match = SENT_END.exec(sentBufRef.current)) !== null) {
                    const sentence = sentBufRef.current.slice(0, match.index + 1).trim();
                    sentBufRef.current = sentBufRef.current.slice(match.index + match[0].length);
                    if (sentence) {
                        ttsQueueRef.current.push(sentence);
                        drainTtsQueue();
                    }
                    SENT_END.lastIndex = 0;
                }
            }),

            window.jarvis.on("tool-event", ({reqId, phase, name, result}: any) => {
                if (reqId !== reqIdRef.current) return;
                setState((s) => (s === "error" ? s : "thinking"));
                const aId = activeIdRef.current;
                setFeed((prev) =>
                    prev.map((it) => {
                        if (it.id !== aId || it.kind !== "assistant") return it;
                        const tools = [...it.tools];
                        if (phase === "start") tools.push({name, status: "running"});
                        else {
                            for (let i = tools.length - 1; i >= 0; i--)
                                if (tools[i].name === name && tools[i].status === "running") {
                                    tools[i] = {name, status: "done", detail: result};
                                    break;
                                }
                        }
                        return {...it, tools};
                    }),
                );
            }),

            window.jarvis.on("chat-error", ({reqId, message}: any) => {
                if (reqId !== reqIdRef.current) return;
                setState("error");
                const aId = activeIdRef.current;
                setFeed((prev) => {
                    // Remove the now-empty assistant bubble, replace with a distinct error item.
                    const cleaned = prev.filter((it) => !(it.id === aId && it.kind === "assistant" && !it.text));
                    return [...cleaned, {id: uid(), kind: "error", text: message || "Bir hata oluştu."}];
                });
            }),

            window.jarvis.on("system-notice", ({message}: {message: string}) => {
                setFeed((prev) => [...prev, {id: uid(), kind: "error", text: message}]);
            }),

            window.jarvis.on("reminder-fired", ({message}: {message: string}) => {
                const id = uid();
                const reminderText = `Hatırlatıcı: ${message}`;
                setFeed((prev) => [...prev, {id, kind: "assistant", text: reminderText, tools: []}]);
                historyRef.current = [...historyRef.current, {role: "assistant", content: reminderText}];
                if (modeRef.current !== "off") {
                    speakRef.current(reminderText, () => setState(modeRef.current !== "off" ? "listening" : "idle"));
                    setState("speaking");
                }
            }),

            window.jarvis.on("chat-done", ({reqId}: any) => {
                if (reqId !== reqIdRef.current) return;
                const responseText = accRef.current;
                historyRef.current = [...historyRef.current, {role: "assistant", content: responseText}];
                setStreaming(false);
                setState((s) => {
                    if (s === "error") { setTimeout(() => setState("idle"), 2500); return s; }
                    return "idle";
                });

                // Flush remaining partial sentence (e.g. reply ending without punctuation)
                const tail = sentBufRef.current.trim();
                sentBufRef.current = "";
                if (tail) ttsQueueRef.current.push(tail);

                // Fallback: nothing was queued (very short reply with no sentence boundary)
                if (ttsQueueRef.current.length === 0 && !ttsPlayingRef.current && responseText) {
                    ttsQueueRef.current.push(responseText);
                }

                ttsOnAllEndRef.current = () => {
                    setState(modeRef.current !== "off" ? "listening" : "idle");
                    setTimeout(() => inputRef.current?.focus(), 50);
                };
                drainTtsQueue();
            }),
        ];
        return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const t = UI[lang] ?? UI.tr;
    const placeholder =
        streaming ? t.processing
        : activated ? t.listening
        : listening ? t.waitingVoice
        : t.idle;

    useEffect(() => {
        return window.jarvis.on("language-changed", ({language}: {language: Lang}) => {
            setLang(language);
        });
    }, []);

    useEffect(() => {
        return window.jarvis.on("tray-mic-toggle", () => {
            setMode(modeRef.current === "off" ? "always-on" : "off");
        });
    }, [setMode]);

    useEffect(() => {
        return window.jarvis.on("chat-stream-inject", ({command}: {command: string}) => {
            if (command?.trim()) sendText(command.trim());
        });
    }, [sendText]);

    const handleHistoryOpen = useCallback(() => setHistoryOpen(true), []);

    const handleNewChat = useCallback(() => {
        window.jarvis.newChat().catch(() => {});
        historyRef.current = [];
        setFeed([]);
        setHistoryOpen(false);
    }, []);

    const handleLoadSession = useCallback((messages: {role: string; content: string}[]) => {
        historyRef.current = messages as LLMMsg[];
        const newFeed: FeedItem[] = messages.map((m) => {
            if (m.role === "user") return {id: uid(), kind: "user" as const, text: m.content};
            return {id: uid(), kind: "assistant" as const, text: m.content, tools: []};
        });
        setFeed(newFeed);
    }, []);

    const handlePaletteSelect = useCallback((text: string, direct: boolean) => {
        if (direct) { sendText(text); } else { setInput(text); }
    }, [sendText]);

    const handleSettingsClose = () => {
        setSettingsOpen(false);
        window.jarvis.settingsGet().then((s) => {
            setTtsRate(s.ttsRate);
            applyFamilyBg(s.uiFamily ?? "cyber");
            setSkin(s.skin ?? "hologram");
            setLayout(s.layout ?? "normal");
            applyFont(s.font ?? "jetbrains");
            applyCustomCss(s.customCss ?? "");
            setLang((s.language ?? "tr") as Lang);
            if (s.telemetryWidgets) setTelemetryWidgets(s.telemetryWidgets);
        });
    };

    const handleStop = useCallback(() => {
        stopSpeaking();
        setState(modeRef.current !== "off" ? "listening" : "idle");
    }, [stopSpeaking]);

    const handleSettingsOpen = useCallback(() => setSettingsOpen(true), []);

    const skinProps = useMemo(() => ({
        feed, input, setInput, state, streaming, tel, weather,
        mode, setMode, listening, activated, capturing, placeholder,
        attachments, setAttachments,
        onSend: send, onStop: handleStop, onSettingsOpen: handleSettingsOpen,
        onHistoryOpen: handleHistoryOpen,
        onNavigateHistory: navigateInputHistory,
        feedRef, inputRef, layout, telemetryWidgets, t, reactorStyle,
    }), [feed, input, attachments, state, streaming, tel, weather,
        mode, listening, activated, capturing, placeholder,
        send, handleStop, handleSettingsOpen, handleHistoryOpen, navigateInputHistory, layout, telemetryWidgets, t, reactorStyle]);

    return (
        <>
            <SettingsPanel
                open={settingsOpen}
                onClose={handleSettingsClose}
                onAccentChange={applyAccent}
                onFamilyChange={applyFamilyBg}
                onSkinChange={setSkin}
                onFontChange={(f) => { applyFont(f); }}
                onLayoutChange={setLayout}
                onCustomCssChange={applyCustomCss}
                onTelemetryWidgetsChange={setTelemetryWidgets}
                onReactorStyleChange={setReactorStyle}
                lang={lang}
            />
            <ChatHistorySidebar
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                onLoadSession={handleLoadSession}
                onNewChat={handleNewChat}
                lang={lang}
            />
            <CommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                onSelect={handlePaletteSelect}
                lang={lang}
            />
            {(() => { const SkinComp = getSkinComp(skin); return <SkinComp {...skinProps} />; })()}
            {updateInfo && (
                <div
                    className="fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 flex flex-col gap-2 text-[11px] tracking-wide shadow-lg min-w-[260px] max-w-[340px]"
                    style={{
                        background: "rgba(4,7,13,0.97)",
                        border: `1px solid ${updateInfo.error ? "rgba(239,68,68,0.5)" : "rgba(var(--hud),0.4)"}`,
                        color: updateInfo.error ? "rgb(239,120,120)" : "rgb(var(--hud))",
                    }}
                >
                    <div className="flex items-center gap-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                            {updateInfo.error
                                ? <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
                                : <path d="M12 2v10m0 0-3-3m3 3 3-3M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/>}
                        </svg>
                        <div className="flex-1">
                            {updateInfo.error ? (
                                <span>İndirme başarısız: {updateInfo.error.slice(0, 80)} —{" "}
                                    <button className="underline hover:brightness-125"
                                        onClick={() => { setUpdateInfo((prev) => updateReducer(prev, {type: "retry"})); window.jarvis.updateDownload(); }}
                                    >tekrar dene</button>
                                </span>
                            ) : updateInfo.ready ? (
                                <span>v{updateInfo.version} indirildi —{" "}
                                    <button className="underline hover:brightness-125" onClick={() => window.jarvis.updateInstall()}>yeniden başlat</button>
                                </span>
                            ) : updateInfo.downloading ? (
                                <span>v{updateInfo.version} indiriliyor… {updateInfo.percent != null ? `%${updateInfo.percent}` : ""}</span>
                            ) : (
                                <span>Yeni sürüm var: v{updateInfo.version} —{" "}
                                    <button className="underline hover:brightness-125"
                                        onClick={() => { setUpdateInfo((prev) => updateReducer(prev, {type: "start-download"})); window.jarvis.updateDownload(); }}
                                    >indir</button>
                                </span>
                            )}
                        </div>
                        <button className="opacity-40 hover:opacity-100" onClick={() => setUpdateInfo(null)}>✕</button>
                    </div>
                    {updateInfo.downloading && !updateInfo.error && (
                        <div className="w-full h-1 rounded-full overflow-hidden" style={{background: "rgba(var(--hud),0.15)"}}>
                            <div className="h-full rounded-full transition-all duration-300"
                                style={{width: `${updateInfo.percent ?? 0}%`, background: "rgb(var(--hud))"}} />
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

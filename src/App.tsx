import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {CoreState} from "./components/ArcReactor";
import SettingsPanel from "./components/SettingsPanel";
import ChatHistorySidebar from "./components/ChatHistorySidebar";
import CommandPalette from "./components/CommandPalette";
import {useVoice, type VoiceMode} from "./hooks/useVoice";
import type {Telemetry, Weather, AppSettings, TelemetryWidget} from "./electron.d";
import HologramSkin from "./components/skins/HologramSkin";
import MinimalSkin from "./components/skins/MinimalSkin";
import TerminalSkin from "./components/skins/TerminalSkin";
import DashboardSkin from "./components/skins/DashboardSkin";
import {UI, type Lang} from "./i18n";

type LLMMsg = {role: "user" | "assistant"; content: string};
type ToolLine = {name: string; status: "running" | "done"; detail?: string};
type FeedItem = {id: string; kind: "user"; text: string} | {id: string; kind: "assistant"; text: string; tools: ToolLine[]};

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

function applyAccent(rgb: string) {
    const [r, g, b] = rgb.split(",").map((x) => parseInt(x.trim(), 10));
    const deep = `${Math.round(r * 0.35)}, ${Math.round(g * 0.35)}, ${Math.round(b * 0.35)}`;
    const soft = `${Math.min(255, Math.round(r * 1.2))}, ${Math.min(255, Math.round(g * 1.1))}, ${Math.min(255, Math.round(b * 1.05))}`;
    const ok = hslToRgbStr(140, 70, 55);
    const warn = hslToRgbStr(45, 90, 60);
    const danger = hslToRgbStr(0, 85, 60);
    document.documentElement.style.setProperty("--hud", rgb);
    document.documentElement.style.setProperty("--hud-deep", deep);
    document.documentElement.style.setProperty("--hud-soft", soft);
    document.documentElement.style.setProperty("--status-ok", ok);
    document.documentElement.style.setProperty("--status-warn", warn);
    document.documentElement.style.setProperty("--status-danger", danger);
    document.documentElement.style.setProperty("--status-pending", rgb);
}


function hslToRgbStr(h: number, s: number, l: number): string {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
    return `${f(0)}, ${f(8)}, ${f(4)}`;
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
    const [skin, setSkin] = useState<AppSettings["skin"]>("hologram");
    const [layout, setLayout] = useState<AppSettings["layout"]>("normal");
    const [lang, setLang] = useState<Lang>("tr");
    const [telemetryWidgets, setTelemetryWidgets] = useState<TelemetryWidget[]>([
        "cpu", "ram", "disk", "battery", "network", "gpu", "fans", "processes", "system", "activeWindow",
    ]);

    useEffect(() => {
        window.jarvis.settingsGet().then((s) => {
            setTtsRate(s.ttsRate);
            applyAccent(s.accentColor);
            setSkin(s.skin ?? "hologram");
            setLayout(s.layout ?? "normal");
            applyFont(s.font ?? "jetbrains");
            applyCustomCss(s.customCss ?? "");
            setLang((s.language ?? "tr") as Lang);
            if (s.telemetryWidgets) setTelemetryWidgets(s.telemetryWidgets);
        });
    }, []);

    const historyRef = useRef<LLMMsg[]>([]);
    const accRef = useRef("");
    const activeIdRef = useRef<string | null>(null);
    const reqIdRef = useRef<string | null>(null);
    const feedRef = useRef<HTMLDivElement>(null);
    const isBusyRef = useRef(false);
    const modeRef = useRef<VoiceMode>("off");

    const sendText = useCallback((text: string) => {
        if (!text.trim() || isBusyRef.current) return;
        const reqId = uid();
        const aId = uid();
        reqIdRef.current = reqId;
        activeIdRef.current = aId;
        accRef.current = "";
        historyRef.current = [...historyRef.current, {role: "user", content: text.trim()}];
        setFeed((prev) => [...prev, {id: uid(), kind: "user", text: text.trim()}, {id: aId, kind: "assistant", text: "", tools: []}]);
        setStreaming(true);
        setState("thinking");
        window.jarvis.sendChat(historyRef.current, reqId);
    }, []);

    const send = () => {
        if (!input.trim() || streaming) return;
        sendText(input);
        setInput("");
    };

    const {mode, setMode, listening, activated, capturing, speak, stopSpeaking} = useVoice({
        onTranscript: sendText,
        isBusyRef,
        ttsRate,
    });

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
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "F11") { e.preventDefault(); window.jarvis.fullscreen(); }
            if (e.key === "Escape") { stopSpeaking(); setState(modeRef.current !== "off" ? "listening" : "idle"); }
            if (e.ctrlKey && e.key === " ") { e.preventDefault(); if (!isBusyRef.current) setPaletteOpen(true); return; }
            if (e.key === "m" || e.key === "M") {
                if (document.activeElement?.tagName === "INPUT") return;
                const next: VoiceMode = modeRef.current === "off" ? "always-on" : modeRef.current === "always-on" ? "wake-word" : "off";
                setMode(next);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [stopSpeaking, setMode]);

    useEffect(() => {
        feedRef.current?.scrollTo({top: feedRef.current.scrollHeight, behavior: "smooth"});
    }, [feed]);

    useEffect(() => {
        const offs = [
            window.jarvis.on("telemetry", (d: Telemetry) => setTel(d)),

            window.jarvis.on("chat-delta", ({reqId, text}: any) => {
                if (reqId !== reqIdRef.current) return;
                accRef.current += text;
                setState((s) => (s === "error" ? s : "speaking"));
                const aId = activeIdRef.current;
                setFeed((prev) => prev.map((it) => (it.id === aId && it.kind === "assistant" ? {...it, text: accRef.current} : it)));
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

            window.jarvis.on("chat-error", ({reqId}: any) => {
                if (reqId !== reqIdRef.current) return;
                setState("error");
            }),

            window.jarvis.on("reminder-fired", ({message}: {message: string}) => {
                const id = uid();
                const reminderText = `Hatırlatıcı: ${message}`;
                setFeed((prev) => [...prev, {id, kind: "assistant", text: reminderText, tools: []}]);
                historyRef.current = [...historyRef.current, {role: "assistant", content: reminderText}];
                if (modeRef.current !== "off") {
                    speak(reminderText, () => setState(modeRef.current !== "off" ? "listening" : "idle"));
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
                if (responseText && modeRef.current !== "off") {
                    stopSpeaking();
                    setState("speaking");
                    speak(responseText, () => setState(modeRef.current !== "off" ? "listening" : "idle"));
                }
            }),
        ];
        return () => offs.forEach((off) => off());
    }, [speak, stopSpeaking]);

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

    const handleHistoryOpen = useCallback(() => setHistoryOpen(true), []);

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
        onSend: send, onStop: handleStop, onSettingsOpen: handleSettingsOpen,
        onHistoryOpen: handleHistoryOpen,
        feedRef, layout, telemetryWidgets,
    }), [feed, input, state, streaming, tel, weather,
        mode, listening, activated, capturing, placeholder,
        send, handleStop, handleSettingsOpen, handleHistoryOpen, layout, telemetryWidgets]);

    return (
        <>
            <SettingsPanel
                open={settingsOpen}
                onClose={handleSettingsClose}
                onAccentChange={applyAccent}
                onSkinChange={setSkin}
                onFontChange={(f) => { applyFont(f); }}
                onLayoutChange={setLayout}
                onCustomCssChange={applyCustomCss}
                onTelemetryWidgetsChange={setTelemetryWidgets}
            />
            <ChatHistorySidebar
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                onLoadSession={handleLoadSession}
            />
            <CommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                onSelect={handlePaletteSelect}
            />
            {skin === "minimal"   ? <MinimalSkin   {...skinProps} /> :
             skin === "terminal"  ? <TerminalSkin  {...skinProps} /> :
             skin === "dashboard" ? <DashboardSkin {...skinProps} /> :
                                    <HologramSkin  {...skinProps} />}
        </>
    );
}

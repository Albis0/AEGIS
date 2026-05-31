import {useCallback, useEffect, useRef, useState} from "react";
import type {CoreState} from "./components/ArcReactor";
import SettingsPanel from "./components/SettingsPanel";
import {useVoice, type VoiceMode} from "./hooks/useVoice";
import type {Telemetry, Weather, AppSettings} from "./electron.d";
import HologramSkin from "./components/skins/HologramSkin";
import MinimalSkin from "./components/skins/MinimalSkin";
import TerminalSkin from "./components/skins/TerminalSkin";
import DashboardSkin from "./components/skins/DashboardSkin";

type LLMMsg = {role: "user" | "assistant"; content: string};
type ToolLine = {name: string; status: "running" | "done"; detail?: string};
type FeedItem = {id: string; kind: "user"; text: string} | {id: string; kind: "assistant"; text: string; tools: ToolLine[]};

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
    const [clock, setClock] = useState(new Date());
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [ttsRate, setTtsRate] = useState(1.0);
    const [skin, setSkin] = useState<AppSettings["skin"]>("hologram");

    useEffect(() => {
        window.jarvis.settingsGet().then((s) => {
            setTtsRate(s.ttsRate);
            applyAccent(s.accentColor);
            setSkin(s.skin ?? "hologram");
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
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

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

    const placeholder =
        streaming ? "JARVIS işliyor…"
        : activated ? "Dinliyorum, efendim…"
        : listening ? "Sesli komut bekleniyor…"
        : "Komutunuzu verin, efendim…";

    const handleSettingsClose = () => {
        setSettingsOpen(false);
        window.jarvis.settingsGet().then((s) => {
            setTtsRate(s.ttsRate);
            setSkin(s.skin ?? "hologram");
        });
    };

    const handleStop = () => {
        stopSpeaking();
        setState(modeRef.current !== "off" ? "listening" : "idle");
    };

    const skinProps = {
        feed, input, setInput, state, streaming, tel, weather, clock,
        mode, setMode, listening, activated, capturing, placeholder,
        onSend: send, onStop: handleStop, onSettingsOpen: () => setSettingsOpen(true),
        feedRef,
    };

    return (
        <>
            <SettingsPanel
                open={settingsOpen}
                onClose={handleSettingsClose}
                onAccentChange={applyAccent}
                onSkinChange={setSkin}
            />
            {skin === "minimal"   ? <MinimalSkin   {...skinProps} /> :
             skin === "terminal"  ? <TerminalSkin  {...skinProps} /> :
             skin === "dashboard" ? <DashboardSkin {...skinProps} /> :
                                    <HologramSkin  {...skinProps} />}
        </>
    );
}

import {useCallback, useEffect, useRef, useState, type ReactNode} from "react";
import ArcReactor, {type CoreState} from "./components/ArcReactor";
import VoiceModeToggle from "./components/VoiceModeToggle";
import {useVoice, type VoiceMode} from "./hooks/useVoice";
import type {Telemetry, Weather} from "./electron.d";

type LLMMsg = {role: "user" | "assistant"; content: string};
type ToolLine = {name: string; status: "running" | "done"; detail?: string};
type FeedItem = {id: string; kind: "user"; text: string} | {id: string; kind: "assistant"; text: string; tools: ToolLine[]};

const TOOL_VERB: Record<string, string> = {
    run_command: "KOMUT YÜRÜTÜLÜYOR",
    read_file: "DOSYA OKUNUYOR",
    write_file: "DOSYA YAZILIYOR",
    list_directory: "DİZİN TARANIYOR",
    web_search: "AĞ TARANIYOR",
};

const HOSTNAME = "AEGIS-OS";
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const active = (s: CoreState) => s !== "idle";
const fmtUptime = (s: number) => `${Math.floor(s / 3600)}s ${Math.floor((s % 3600) / 60)}d`;
const fmtRate = (bps?: number) => {
    if (bps == null) return "0 KB/s";
    if (bps > 1048576) return `${(bps / 1048576).toFixed(1)} MB/s`;
    return `${Math.round(bps / 1024)} KB/s`;
};

export default function App() {
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [input, setInput] = useState("");
    const [state, setState] = useState<CoreState>("idle");
    const [streaming, setStreaming] = useState(false);
    const [tel, setTel] = useState<Telemetry | null>(null);
    const [weather, setWeather] = useState<Weather | null>(null);
    const [clock, setClock] = useState(new Date());

    const historyRef = useRef<LLMMsg[]>([]);
    const accRef = useRef("");
    const activeIdRef = useRef<string | null>(null);
    const reqIdRef = useRef<string | null>(null);
    const feedRef = useRef<HTMLDivElement>(null);
    const isBusyRef = useRef(false);
    const modeRef = useRef<VoiceMode>("off");

    // sendText defined early so useVoice can reference it
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

    const {mode, setMode, listening, activated, speak, stopSpeaking} = useVoice({
        onTranscript: sendText,
        isBusyRef,
    });

    // Keep refs in sync so IPC closures always read current values
    useEffect(() => {
        isBusyRef.current = streaming;
    }, [streaming]);
    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

    // Sync listening state → CoreState
    useEffect(() => {
        if (listening && state === "idle") setState("listening");
        else if (!listening && state === "listening") setState("idle");
    }, [listening, state]);

    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const load = () =>
            window.jarvis
                .weather()
                .then(setWeather)
                .catch(() => {});
        load();
        const t = setInterval(load, 600000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "F11") {
                e.preventDefault();
                window.jarvis.fullscreen();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

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
                    if (s === "error") {
                        setTimeout(() => setState("idle"), 2500);
                        return s;
                    }
                    return "idle";
                });
                if (responseText && modeRef.current !== "off") {
                    stopSpeaking();
                    speak(responseText);
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

    return (
        <div className={`hud backdrop state-${state} relative h-screen w-screen overflow-hidden flex flex-col`}>
            <div className="absolute inset-0 grid-overlay pointer-events-none" />

            {/* Title bar */}
            <div className="drag shrink-0 h-10 flex items-center justify-between px-5 z-30">
                <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full glow-text flick" style={{background: "rgb(var(--hud))", boxShadow: "0 0 8px rgb(var(--hud))"}} />
                    <span className="text-[11px] tracking-[0.45em] glow-text" style={{fontFamily: "Orbitron, sans-serif"}}>
                        J.A.R.V.I.S.
                    </span>
                </div>
                <div className="no-drag flex gap-1">
                    <button
                        onClick={() => window.jarvis.minimize()}
                        title="Küçült"
                        className="w-8 h-8 grid place-items-center opacity-50 hover:opacity-100 transition"
                        style={{color: "rgb(var(--hud))"}}
                    >
                        ─
                    </button>
                    <button
                        onClick={() => window.jarvis.maximize()}
                        title="Büyüt"
                        className="w-8 h-8 grid place-items-center opacity-50 hover:opacity-100 transition text-xs"
                        style={{color: "rgb(var(--hud))"}}
                    >
                        ▢
                    </button>
                    <button
                        onClick={() => window.jarvis.fullscreen()}
                        title="Tam ekran (F11)"
                        className="w-8 h-8 grid place-items-center opacity-50 hover:opacity-100 transition text-xs"
                        style={{color: "rgb(var(--hud))"}}
                    >
                        ⛶
                    </button>
                    <button
                        onClick={() => window.jarvis.close()}
                        title="Kapat"
                        className="w-8 h-8 grid place-items-center opacity-50 hover:opacity-100 hover:text-red-400 transition"
                        style={{color: "rgb(var(--hud))"}}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Main: LEFT panels | CENTER globe | RIGHT conversation */}
            <div className="flex-1 flex min-h-0 z-10 gap-4 px-5 pb-2">
                {/* LEFT — clock + weather + system */}
                <div className="shrink-0 w-[clamp(190px,17vw,230px)] flex flex-col gap-4 overflow-y-auto py-2 hud" style={{color: "rgb(var(--hud))"}}>
                    <Section title="TIME">
                        <div className="text-3xl tabular-nums glow-text leading-none" style={{fontFamily: "Orbitron, sans-serif"}}>
                            {clock.toLocaleTimeString("tr-TR", {hour: "2-digit", minute: "2-digit"})}
                            <span className="text-base opacity-60">:{clock.toLocaleTimeString("tr-TR", {second: "2-digit"}).slice(-2)}</span>
                        </div>
                        <div className="text-[11px] tracking-[0.2em] mt-1.5 glow-text">{clock.toLocaleDateString("tr-TR", {day: "2-digit", month: "short", year: "numeric"}).toUpperCase()}</div>
                        <div className="text-[10px] tracking-widest opacity-60">{clock.toLocaleDateString("tr-TR", {weekday: "long"}).toUpperCase()}</div>
                    </Section>

                    <Section title={weather?.city ? `HAVA · ${weather.city.toUpperCase()}` : "HAVA DURUMU"}>
                        {weather && !weather.error ?
                            <>
                                <div className="text-3xl glow-text" style={{fontFamily: "Orbitron, sans-serif"}}>
                                    {weather.temp}°C
                                </div>
                                <ul className="text-[11px] mt-1.5 space-y-0.5 opacity-80">
                                    <li>• {weather.desc}</li>
                                    <li>• hissedilen {weather.feels}°</li>
                                    <li>• nem %{weather.humidity}</li>
                                </ul>
                            </>
                        :   <div className="text-[11px] opacity-50">{weather?.error ? "bağlanılamadı" : "yükleniyor…"}</div>}
                    </Section>

                    <Section title="SİSTEM DURUMU">
                        <div className="text-[9px] tracking-widest opacity-60 mb-1.5">UPTIME · {tel ? fmtUptime(tel.uptime) : "—"}</div>
                        <div className="space-y-1.5 text-[10px] tracking-widest">
                            <TelRow label="CPU" value={`${tel?.cpu ?? 0}%`} bar={tel?.cpu ?? 0} warn={70} danger={90} />
                            <TelRow label="RAM" value={`${tel?.ram ?? 0}%`} bar={tel?.ram ?? 0} warn={75} danger={88} />
                            <TelRow label="DISK" value={`${tel?.disk ?? 0}%`} bar={tel?.disk ?? 0} warn={70} danger={90} />
                            <TelRow label="BAT" value={tel?.battery != null ? `${tel.battery}%` : "N/A"} bar={tel?.battery ?? 0} />
                        </div>
                        <div className="flex justify-between gap-2 pt-2 text-[10px] opacity-70">
                            <span>▲ {fmtRate(tel?.netUp)}</span>
                            <span>▼ {fmtRate(tel?.netDown)}</span>
                        </div>
                        <div className="flex justify-between gap-2 pt-1 text-[10px] opacity-60">
                            <span>HOST</span>
                            <span>{HOSTNAME}</span>
                        </div>
                    </Section>
                </div>

                {/* CENTER — globe */}
                <div className="flex-1 min-w-0 grid place-items-center relative">
                    <div className="aspect-square h-full max-h-[72vh] max-w-full">
                        <ArcReactor state={state} />
                    </div>
                </div>

                {/* RIGHT — conversation */}
                <div
                    className="shrink-0 w-[clamp(260px,28vw,400px)] flex flex-col rounded-lg border overflow-hidden"
                    style={{borderColor: "rgba(var(--hud),0.2)", background: "rgba(var(--hud),0.02)"}}
                >
                    <div className="flex items-center justify-between px-3 py-2 border-b text-[10px] tracking-[0.25em]" style={{borderColor: "rgba(var(--hud),0.15)", color: "rgb(var(--hud))"}}>
                        <span className="glow-text">KONUŞMA</span>
                        <span className="opacity-70" style={{color: state === "error" ? "rgb(248,80,80)" : "rgb(var(--hud))"}}>
                            {state.toUpperCase()}
                        </span>
                    </div>
                    <div ref={feedRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                        {feed.length === 0 && (
                            <div className="text-[12px] opacity-50 space-y-1 hud" style={{color: "rgb(var(--hud))"}}>
                                <div>SYS: JARVIS çevrimiçi.</div>
                                <div>SYS: Sistemler nominal.</div>
                                <div>SYS: Emrinizi bekliyorum, efendim…</div>
                            </div>
                        )}
                        {feed.map((item) =>
                            item.kind === "user" ?
                                <div key={item.id} className="flex justify-end rise">
                                    <div
                                        className="max-w-[88%] px-3 py-1.5 rounded-lg rounded-br-sm text-[12.5px] leading-relaxed border break-words"
                                        style={{borderColor: "rgba(var(--hud),0.35)", background: "rgba(var(--hud),0.08)", color: "rgb(var(--hud-soft))"}}
                                    >
                                        {item.text}
                                    </div>
                                </div>
                            :   <div key={item.id} className="rise">
                                    {item.tools.map((t, i) => (
                                        <div key={i} className="flex items-center gap-2 text-[10.5px] tracking-wider mb-0.5">
                                            <span className={t.status === "running" ? "flick" : ""} style={{color: t.status === "running" ? "rgb(var(--hud))" : "rgb(110,231,160)"}}>
                                                {t.status === "running" ? "▸" : "✓"}
                                            </span>
                                            <span style={{color: t.status === "running" ? "rgb(var(--hud))" : "rgba(110,231,160,0.7)"}}>
                                                {TOOL_VERB[t.name] || t.name.toUpperCase()}
                                                {t.status === "running" ? "…" : ""}
                                            </span>
                                        </div>
                                    ))}
                                    {item.text && (
                                        <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-words text-cyan-50/90">
                                            {item.text}
                                            {streaming && item.id === feed[feed.length - 1].id && (
                                                <span className="inline-block w-1.5 h-4 ml-0.5 align-middle flick" style={{background: "rgb(var(--hud))"}} />
                                            )}
                                        </p>
                                    )}
                                </div>,
                        )}
                    </div>
                </div>
            </div>

            {/* Control bar */}
            <div className="shrink-0 flex items-center justify-center gap-6 pb-1 z-20 text-[11px] tracking-[0.2em]">
                <span className="flex items-center gap-1.5" style={{color: active(state) ? "rgb(110,231,160)" : "rgba(110,231,160,0.5)"}}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{background: "rgb(110,231,160)", boxShadow: "0 0 6px rgb(110,231,160)"}} /> CANLI
                </span>
                <span className="opacity-40">·</span>
                <span style={{color: "rgb(var(--hud))"}}>
                    {state === "thinking" ?
                        "İŞLENİYOR"
                    : state === "speaking" ?
                        "YANIT VERİYOR"
                    : state === "listening" ?
                        "DİNLİYOR"
                    : state === "error" ?
                        "HATA"
                    :   "HAZIR"}
                </span>
                <span className="opacity-40">·</span>
                <VoiceModeToggle
                    mode={mode}
                    listening={listening}
                    activated={activated}
                    onToggle={() => {
                        const next: VoiceMode =
                            mode === "off" ? "always-on"
                            : mode === "always-on" ? "wake-word"
                            : "off";
                        setMode(next);
                    }}
                />
                <span className="opacity-40">·</span>
                <button onClick={() => window.jarvis.close()} className="flex items-center gap-1.5 hover:brightness-125 transition" style={{color: "rgb(248,120,120)"}}>
                    ⏻ KAPAT
                </button>
            </div>

            {/* Command input — full width */}
            <div className="shrink-0 px-5 pb-4 z-30">
                <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm transition-colors"
                    style={{borderColor: "rgba(var(--hud),0.3)", background: "rgba(var(--hud),0.04)", boxShadow: "0 0 24px rgba(var(--hud),0.12)"}}
                >
                    <span className="text-sm" style={{color: "rgba(var(--hud),0.6)"}}>
                        ›
                    </span>
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && send()}
                        placeholder={placeholder}
                        disabled={streaming}
                        autoFocus
                        className="flex-1 bg-transparent outline-none text-sm font-mono disabled:opacity-50"
                        style={{color: "rgb(var(--hud-soft))"}}
                    />
                    <button
                        onClick={send}
                        disabled={streaming || !input.trim()}
                        className="px-4 py-1.5 rounded-lg text-[11px] tracking-widest border disabled:opacity-30 transition hover:brightness-125"
                        style={{fontFamily: "Orbitron, sans-serif", color: "rgb(var(--hud))", borderColor: "rgba(var(--hud),0.3)"}}
                    >
                        GÖNDER
                    </button>
                </div>
            </div>
        </div>
    );
}

function Section({title, children}: {title: string; children: ReactNode}) {
    return (
        <div className="relative px-3 py-3 hud" style={{color: "rgb(var(--hud))"}}>
            <span className="absolute top-0 left-0 w-3 h-3 border-t border-l" style={{borderColor: "rgba(var(--hud),0.5)"}} />
            <span className="absolute top-0 right-0 w-3 h-3 border-t border-r" style={{borderColor: "rgba(var(--hud),0.5)"}} />
            <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l" style={{borderColor: "rgba(var(--hud),0.5)"}} />
            <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r" style={{borderColor: "rgba(var(--hud),0.5)"}} />
            <div className="text-[9px] tracking-[0.3em] opacity-60 mb-2 glow-text">{title}</div>
            {children}
        </div>
    );
}

function TelRow({label, value, bar, danger, warn}: {label: string; value: string; bar: number; danger?: number; warn?: number}) {
    const color =
        danger != null && bar >= danger ? "248,80,80"
        : warn != null && bar >= warn ? "245,150,40"
        : "var(--hud)";
    const fill = color === "var(--hud)" ? "rgb(var(--hud))" : `rgb(${color})`;
    return (
        <div className="flex items-center gap-2">
            <span className="w-9">{label}</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{background: "rgba(var(--hud),0.15)"}}>
                <div className="h-full rounded-full transition-all duration-700" style={{width: `${bar}%`, background: fill, boxShadow: `0 0 6px ${fill}`}} />
            </div>
            <span className="tabular-nums w-12 text-right" style={{color: fill}}>
                {value}
            </span>
        </div>
    );
}

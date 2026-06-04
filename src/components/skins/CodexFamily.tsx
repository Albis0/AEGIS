// AEGIS — "Codex" skin ailesi (4 ferdi: Doc / Split / Grid / Log)
// =============================================================================
// Tasarım dili: DÜZ / editöryel / brutalist mono. Glow yok, yuvarlaklık yok;
// keskin dikdörtgenler, görünür çerçeveler, BÜYÜK HARF mini etiketler, monospace,
// yüksek kontrast — bir kod editörü / teknik döküman havası. HUD (neon) ve Nebula
// (yumuşak bubble) ailelerinden bilinçli olarak tamamen farklı.

import React, {useState, useEffect} from "react";
import type {SkinProps} from "./HologramSkin";
import type {VoiceMode} from "../../hooks/useVoice";
import VoiceModeToggle from "../VoiceModeToggle";

import {toolLabel as TOOL_VERB_fn} from "./toolLabels";
const TOOL_VERB = (name: string, t: SkinProps["t"]) => TOOL_VERB_fn(name, t);

const codexBg: React.CSSProperties = {
    background: "var(--bg)",
    color: "rgb(var(--hud))",
    fontFamily: "var(--ui-font)",
    WebkitFontSmoothing: "antialiased",
};
const line = "rgba(var(--hud),0.28)";
const lineSoft = "rgba(var(--hud),0.14)";

const stWord = (state: string, t: SkinProps["t"]) =>
    state === "thinking" ? t.stProc : state === "speaking" ? t.stResp : state === "listening" ? t.stListen : state === "error" ? t.stErr : t.stReady;

// ───────── Ortak: düz/bordürlü feed ─────────
function CdxFeed({feed, streaming, t, feedRef}: Pick<SkinProps, "feed" | "streaming" | "t" | "feedRef">) {
    return (
        <div ref={feedRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5 text-[13px]">
            {feed.map((item, idx) => {
                if (item.kind === "error") {
                    return (
                        <div key={item.id} className="rise" style={{borderLeft: "2px solid rgb(248,113,113)", paddingLeft: 10}}>
                            <div className="text-[9px] tracking-[0.3em] mb-0.5" style={{color: "rgb(248,113,113)"}}>{t.errLabel}</div>
                            <div className="leading-relaxed whitespace-pre-wrap break-words" style={{color: "rgb(252,180,180)"}}>{item.text}</div>
                        </div>
                    );
                }
                if (item.kind === "user") {
                    return (
                        <div key={item.id} className="rise" style={{borderLeft: `2px solid ${line}`, paddingLeft: 10}}>
                            <div className="text-[9px] tracking-[0.3em] mb-0.5 opacity-50">» USR</div>
                            <div className="leading-relaxed break-words" style={{color: "rgb(var(--hud-soft))"}}>{item.text}</div>
                        </div>
                    );
                }
                return (
                    <div key={item.id} className="rise" style={{borderLeft: "2px solid rgb(var(--hud))", paddingLeft: 10}}>
                        <div className="text-[9px] tracking-[0.3em] mb-0.5" style={{color: "rgb(var(--hud))"}}>AEGIS »</div>
                        {item.tools.map((tool, i) => (
                            <div key={i} className="text-[10px] mb-0.5 opacity-60">
                                [{tool.status === "running" ? "··" : "ok"}] {TOOL_VERB(tool.name, t)}
                            </div>
                        ))}
                        {item.text && (
                            <div className="leading-relaxed whitespace-pre-wrap break-words" style={{color: "rgba(235,245,250,0.9)"}}>
                                {item.text}
                                {streaming && idx === feed.length - 1 && <span className="inline-block w-[0.5em] h-[1em] ml-0.5 align-middle flick" style={{background: "rgb(var(--hud))"}} />}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ───────── Ortak: düz bordürlü input ─────────
function CdxInput({input, setInput, attachments, setAttachments, state, streaming, placeholder, onSend, onStop, onNavigateHistory, mode, setMode, listening, activated, t}: Pick<SkinProps,
    "input" | "setInput" | "attachments" | "setAttachments" | "state" | "streaming" | "placeholder" | "onSend" | "onStop" | "onNavigateHistory" | "mode" | "setMode" | "listening" | "activated" | "t">) {
    return (
        <div className="shrink-0" style={{borderTop: `1px solid ${line}`}}>
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                    {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1 px-2 py-0.5 text-[10px]" style={{border: `1px solid ${lineSoft}`, color: "rgba(var(--hud-soft),0.85)"}}>
                            <span className="max-w-[90px] truncate">{att.name}</span>
                            <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100">✕</button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2.5">
                <span className="text-[11px] opacity-50 shrink-0">{stWord(state, t)}</span>
                <span className="opacity-30">|</span>
                <input
                    value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { onSend(); return; } if (e.key === "ArrowUp") { e.preventDefault(); onNavigateHistory?.("up"); } if (e.key === "ArrowDown") { e.preventDefault(); onNavigateHistory?.("down"); } }}
                    placeholder={placeholder} disabled={streaming} autoFocus
                    className="flex-1 bg-transparent outline-none text-[13px] disabled:opacity-40"
                    style={{color: "rgb(var(--hud-soft))", caretColor: "rgb(var(--hud))"}}
                />
                <label className="cursor-pointer opacity-50 hover:opacity-100 text-[12px]" title={t.attachFile} style={{color: "rgb(var(--hud))"}}>
                    [+]
                    <input type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py" className="hidden"
                        onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            Promise.all(files.map((f) => new Promise<{name: string; url: string; mime: string; data: string}>((res) => {
                                const reader = new FileReader();
                                reader.onload = () => { const r = reader.result as string; res({name: f.name, url: r, mime: f.type || "application/octet-stream", data: r.split(",")[1] ?? ""}); };
                                reader.readAsDataURL(f);
                            }))).then((atts) => setAttachments([...attachments, ...atts]));
                            e.target.value = "";
                        }} />
                </label>
                <VoiceModeToggle mode={mode} listening={listening} activated={activated} t={t} onToggle={() => {
                    const next: VoiceMode = mode === "off" ? "always-on" : mode === "always-on" ? "wake-word" : "off";
                    setMode(next);
                }} />
                {state === "speaking" && (
                    <button onClick={onStop} className="text-[10px] px-2 py-0.5" style={{border: "1px solid rgba(248,113,113,0.4)", color: "rgb(var(--status-danger))"}}>{t.stop}</button>
                )}
                <button onClick={onSend} disabled={streaming || (!input.trim() && attachments.length === 0)}
                    className="text-[11px] px-3 py-0.5 disabled:opacity-30 transition hover:brightness-125"
                    style={{border: `1px solid ${line}`, color: "rgb(var(--hud))"}}>{t.send}</button>
            </div>
        </div>
    );
}

function CdxBar({label, t, state, onSettingsOpen, onHistoryOpen}: {label: string; t: SkinProps["t"]; state: string; onSettingsOpen: () => void; onHistoryOpen?: () => void}) {
    return (
        <div className="drag shrink-0 h-9 flex items-center justify-between px-4" style={{borderBottom: `1px solid ${line}`}}>
            <span className="text-[11px] tracking-[0.35em] font-semibold">{label}</span>
            <div className="flex items-center gap-3">
                <span className="text-[9px] tracking-[0.3em] opacity-50">{stWord(state, t)}</span>
                <div className="no-drag flex gap-3 text-[12px]">
                    {onHistoryOpen && <button onClick={onHistoryOpen} title={t.tipHistory} className="opacity-50 hover:opacity-100" style={{color: "rgb(var(--hud))"}}>◷</button>}
                    <button onClick={onSettingsOpen} title={t.tipSettings} className="opacity-50 hover:opacity-100" style={{color: "rgb(var(--hud))"}}>⚙</button>
                    <button onClick={() => window.jarvis.minimize()} title={t.tipMinimize} className="opacity-50 hover:opacity-100" style={{color: "rgb(var(--hud))"}}>─</button>
                    <button onClick={() => window.jarvis.close()} title={t.tipClose} className="opacity-50 hover:opacity-100" style={{color: "rgb(var(--hud))"}}>✕</button>
                </div>
            </div>
        </div>
    );
}

// ───────────────────────────── 1) Codex · Doc ───────────────────────────────
export function CodexDoc(p: SkinProps) {
    return (
        <div className="h-screen w-screen flex flex-col" style={codexBg as React.CSSProperties}>
            <CdxBar label="AEGIS // DOC" t={p.t} state={p.state} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} />
            {p.feed.length === 0
                ? <div className="flex-1 px-4 py-3 text-[12px] opacity-40 leading-relaxed">{p.t.empty1}<br />{p.t.empty3}</div>
                : <CdxFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />}
            <CdxInput {...p} />
        </div>
    );
}

// ───────────────────────────── 2) Codex · Split ─────────────────────────────
export function CodexSplit(p: SkinProps) {
    const {tel} = p;
    const [clock, setClock] = useState(new Date());
    useEffect(() => { const i = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(i); }, []);
    const Row = ({k, v}: {k: string; v: string}) => (
        <div className="flex justify-between text-[10px] py-0.5"><span className="opacity-45 tracking-wider">{k}</span><span className="tabular-nums" style={{color: "rgb(var(--hud-soft))"}}>{v}</span></div>
    );
    return (
        <div className="h-screen w-screen flex flex-col" style={codexBg as React.CSSProperties}>
            <CdxBar label="AEGIS // SPLIT" t={p.t} state={p.state} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} />
            <div className="flex-1 min-h-0 flex">
                <aside className="shrink-0 w-44 px-3 py-3 overflow-y-auto" style={{borderRight: `1px solid ${line}`}}>
                    <div className="text-[9px] tracking-[0.3em] opacity-40 mb-2">{p.t.secSystem}</div>
                    <Row k="TIME" v={clock.toLocaleTimeString(p.t.locale, {hour: "2-digit", minute: "2-digit"})} />
                    <Row k="CPU" v={`${tel?.cpu ?? 0}%`} />
                    <Row k="RAM" v={`${tel?.ram ?? 0}%`} />
                    {(tel?.gpu ?? []).length > 0 && <Row k="GPU" v={`${tel!.gpu[0].load}%`} />}
                    <Row k="DISK" v={`${tel?.disk ?? 0}%`} />
                    {tel?.cpuTemp != null && <Row k="TEMP" v={`${tel.cpuTemp}°C`} />}
                    {p.weather && !p.weather.error && <Row k={p.t.secWeather} v={`${p.weather.temp}°`} />}
                </aside>
                <div className="flex-1 min-w-0 flex flex-col">
                    {p.feed.length === 0
                        ? <div className="flex-1 px-4 py-3 text-[12px] opacity-40">{p.t.empty3}</div>
                        : <CdxFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />}
                </div>
            </div>
            <CdxInput {...p} />
        </div>
    );
}

// ───────────────────────────── 3) Codex · Grid ──────────────────────────────
export function CodexGrid(p: SkinProps) {
    const {tel, weather} = p;
    const Cell = ({k, v}: {k: string; v: React.ReactNode}) => (
        <div className="px-3 py-2" style={{border: `1px solid ${lineSoft}`}}>
            <div className="text-[9px] tracking-[0.25em] opacity-45">{k}</div>
            <div className="text-[16px] tabular-nums mt-0.5" style={{color: "rgb(var(--hud))"}}>{v}</div>
        </div>
    );
    return (
        <div className="h-screen w-screen flex flex-col" style={codexBg as React.CSSProperties}>
            <CdxBar label="AEGIS // GRID" t={p.t} state={p.state} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} />
            <div className="shrink-0 grid grid-cols-5 gap-0" style={{borderBottom: `1px solid ${line}`}}>
                <Cell k="CPU" v={`${tel?.cpu ?? 0}%`} />
                <Cell k="RAM" v={`${tel?.ram ?? 0}%`} />
                <Cell k={(tel?.gpu ?? []).length > 0 ? "GPU" : "DISK"} v={`${(tel?.gpu ?? []).length > 0 ? tel!.gpu[0].load : (tel?.disk ?? 0)}%`} />
                <Cell k="TEMP" v={tel?.cpuTemp != null ? `${tel.cpuTemp}°` : "—"} />
                <Cell k={p.t.secWeather} v={weather && !weather.error ? `${weather.temp}°` : "—"} />
            </div>
            {p.feed.length === 0
                ? <div className="flex-1 px-4 py-3 text-[12px] opacity-40">{p.t.emptyDash}</div>
                : <CdxFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />}
            <CdxInput {...p} />
        </div>
    );
}

// ───────────────────────────── 4) Codex · Log ───────────────────────────────
export function CodexLog(p: SkinProps) {
    return (
        <div className="h-screen w-screen flex flex-col" style={codexBg as React.CSSProperties}>
            <CdxBar label="AEGIS // LOG" t={p.t} state={p.state} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} />
            <div className="px-4 py-1.5 text-[10px] opacity-40 tracking-wider" style={{borderBottom: `1px solid ${lineSoft}`}}>
                — {p.t.conversation} —
            </div>
            {p.feed.length === 0
                ? <div className="flex-1 px-4 py-3 text-[12px] opacity-40">{p.t.empty2}<br />{p.t.empty3}</div>
                : <CdxFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />}
            <CdxInput {...p} />
        </div>
    );
}

// AEGIS — "Retro" skin ailesi (4 ferdi: CRT / Boot / Panel / Wave)
// =============================================================================
// Tasarım dili: vintage bilgisayar / CRT. Çentikli (beveled) kutular, scanline
// kaplama, blok BÜYÜK HARF mono, sıcak fosfor hissi. Diğer üç aileden (neon HUD,
// yumuşak Nebula, düz Codex) bilinçli olarak tamamen farklı.

import React, {useState, useEffect} from "react";
import type {SkinProps} from "./HologramSkin";
import type {VoiceMode} from "../../hooks/useVoice";
import VoiceModeToggle from "../VoiceModeToggle";

import {toolLabel as TOOL_VERB_fn} from "./toolLabels";
const TOOL_VERB = (name: string, t: SkinProps["t"]) => TOOL_VERB_fn(name, t);

const retroBg: React.CSSProperties = {
    background: "var(--bg)",
    color: "rgb(var(--hud))",
    fontFamily: "var(--ui-font)",
    WebkitFontSmoothing: "antialiased",
    textShadow: "0 0 3px rgba(var(--hud),0.4)", // fosfor parıltısı
};
// Çentikli (beveled) kutu stili
const bevel: React.CSSProperties = {
    border: "1px solid rgba(var(--hud),0.4)",
    boxShadow: "inset 1px 1px 0 rgba(var(--hud-soft),0.25), inset -1px -1px 0 rgba(0,0,0,0.5)",
    background: "rgba(var(--hud),0.04)",
};

const stWord = (state: string, t: SkinProps["t"]) =>
    state === "thinking" ? t.stProc : state === "speaking" ? t.stResp : state === "listening" ? t.stListen : state === "error" ? t.stErr : t.stReady;

// Scanline + vignette kaplama (tüm ailenin imzası)
function Scanlines() {
    return (
        <div className="absolute inset-0 pointer-events-none z-50" style={{
            backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)",
            mixBlendMode: "multiply",
        }} />
    );
}

function RtFeed({feed, streaming, t, feedRef}: Pick<SkinProps, "feed" | "streaming" | "t" | "feedRef">) {
    return (
        <div ref={feedRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2 text-[13px] leading-relaxed">
            {feed.map((item, idx) => {
                if (item.kind === "error") {
                    return <div key={item.id} className="rise whitespace-pre-wrap break-words" style={{color: "rgb(248,113,113)"}}>!! {t.errLabel}: {item.text}</div>;
                }
                if (item.kind === "user") {
                    return <div key={item.id} className="rise whitespace-pre-wrap break-words" style={{color: "rgb(var(--hud-soft))"}}>&gt; {item.text}</div>;
                }
                return (
                    <div key={item.id} className="rise">
                        {item.tools.map((tool, i) => (
                            <div key={i} className="text-[10px] opacity-60">  [{tool.status === "running" ? "··" : "ok"}] {TOOL_VERB(tool.name, t)}</div>
                        ))}
                        {item.text && (
                            <div className="whitespace-pre-wrap break-words" style={{color: "rgb(var(--hud))"}}>
                                {item.text}
                                {streaming && idx === feed.length - 1 && <span className="inline-block w-[0.6em] h-[1.05em] ml-0.5 align-middle flick" style={{background: "rgb(var(--hud))"}} />}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function RtInput({input, setInput, attachments, setAttachments, state, streaming, placeholder, onSend, onStop, mode, setMode, listening, activated, t}: Pick<SkinProps,
    "input" | "setInput" | "attachments" | "setAttachments" | "state" | "streaming" | "placeholder" | "onSend" | "onStop" | "mode" | "setMode" | "listening" | "activated" | "t">) {
    return (
        <div className="shrink-0 m-3 mt-1" style={bevel}>
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                    {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1 px-2 text-[10px]" style={{border: "1px solid rgba(var(--hud),0.3)"}}>
                            <span className="max-w-[90px] truncate">{att.name}</span>
                            <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100">x</button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2">
                <span className="shrink-0 flick" style={{color: "rgb(var(--hud))"}}>█</span>
                <input
                    value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSend()}
                    placeholder={placeholder} disabled={streaming} autoFocus
                    className="flex-1 bg-transparent outline-none text-[13px] uppercase disabled:opacity-40"
                    style={{color: "rgb(var(--hud-soft))", caretColor: "rgb(var(--hud))"}}
                />
                <label className="cursor-pointer opacity-60 hover:opacity-100 text-[12px]" title={t.attachFile} style={{color: "rgb(var(--hud))"}}>
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
                    <button onClick={onStop} className="text-[11px] px-2 uppercase" style={{...bevel, color: "rgb(var(--status-danger))"}}>{t.stop}</button>
                )}
                <button onClick={onSend} disabled={streaming || (!input.trim() && attachments.length === 0)}
                    className="text-[11px] px-3 py-0.5 uppercase disabled:opacity-30" style={{...bevel, color: "rgb(var(--hud))"}}>{t.send}</button>
            </div>
        </div>
    );
}

function RtBar({label, t, state, onSettingsOpen, onHistoryOpen}: {label: string; t: SkinProps["t"]; state: string; onSettingsOpen: () => void; onHistoryOpen?: () => void}) {
    return (
        <div className="drag shrink-0 h-9 m-3 mb-1 flex items-center justify-between px-3" style={bevel}>
            <span className="text-[11px] tracking-[0.3em] font-bold uppercase">{label}</span>
            <div className="flex items-center gap-3">
                <span className="text-[9px] tracking-[0.25em] opacity-60 uppercase">{stWord(state, t)}</span>
                <div className="no-drag flex gap-2.5 text-[12px]">
                    {onHistoryOpen && <button onClick={onHistoryOpen} title={t.tipHistory} className="opacity-60 hover:opacity-100" style={{color: "rgb(var(--hud))"}}>H</button>}
                    <button onClick={onSettingsOpen} title={t.tipSettings} className="opacity-60 hover:opacity-100" style={{color: "rgb(var(--hud))"}}>=</button>
                    <button onClick={() => window.jarvis.minimize()} title={t.tipMinimize} className="opacity-60 hover:opacity-100" style={{color: "rgb(var(--hud))"}}>_</button>
                    <button onClick={() => window.jarvis.close()} title={t.tipClose} className="opacity-60 hover:opacity-100" style={{color: "rgb(var(--hud))"}}>X</button>
                </div>
            </div>
        </div>
    );
}

// ───────────────────────────── 1) Retro · CRT ───────────────────────────────
export function RetroCRT(p: SkinProps) {
    return (
        <div className="h-screen w-screen flex flex-col relative" style={retroBg as React.CSSProperties}>
            <Scanlines />
            <RtBar label="AEGIS-OS // CRT" t={p.t} state={p.state} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} />
            <div className="flex-1 min-h-0 mx-3 flex flex-col" style={bevel}>
                {p.feed.length === 0
                    ? <div className="flex-1 px-4 py-3 text-[12px] opacity-50 uppercase">{p.t.empty1}<br />{p.t.empty3}</div>
                    : <RtFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />}
            </div>
            <RtInput {...p} />
        </div>
    );
}

// ───────────────────────────── 2) Retro · Boot ──────────────────────────────
export function RetroBoot(p: SkinProps) {
    const [clock, setClock] = useState(new Date());
    useEffect(() => { const i = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(i); }, []);
    return (
        <div className="h-screen w-screen flex flex-col relative" style={retroBg as React.CSSProperties}>
            <Scanlines />
            <div className="drag shrink-0 h-7 flex items-center justify-between px-4 text-[10px] uppercase tracking-widest opacity-70">
                <span>AEGIS BIOS v3.3</span>
                <span>{clock.toLocaleTimeString(p.t.locale, {hour: "2-digit", minute: "2-digit", second: "2-digit"})}</span>
                <button onClick={() => window.jarvis.close()} className="no-drag opacity-60 hover:opacity-100">X</button>
            </div>
            <div className="px-4 pt-1 pb-2 text-[10px] opacity-50 uppercase">
                MEM OK · CPU {p.tel?.cpu ?? 0}% · RAM {p.tel?.ram ?? 0}% · {stWord(p.state, p.t)}
                <button onClick={p.onSettingsOpen} className="no-drag ml-3 underline opacity-70 hover:opacity-100">[{p.t.tipSettings}]</button>
            </div>
            {p.feed.length === 0
                ? <div className="flex-1 px-4 text-[12px] opacity-50 uppercase">{p.t.empty2}<br />{p.t.empty3}</div>
                : <RtFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />}
            <RtInput {...p} />
        </div>
    );
}

// ───────────────────────────── 3) Retro · Panel ─────────────────────────────
export function RetroPanel(p: SkinProps) {
    const {tel} = p;
    return (
        <div className="h-screen w-screen flex flex-col relative" style={retroBg as React.CSSProperties}>
            <Scanlines />
            <RtBar label="AEGIS-OS // PANEL" t={p.t} state={p.state} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} />
            <div className="flex-1 min-h-0 mx-3 flex gap-3">
                <aside className="shrink-0 w-40 p-3 text-[10px] uppercase space-y-1" style={bevel}>
                    <div className="opacity-50 tracking-widest mb-1">{p.t.secSystem}</div>
                    <div>CPU {tel?.cpu ?? 0}%</div>
                    <div>RAM {tel?.ram ?? 0}%</div>
                    {(tel?.gpu ?? []).length > 0 && <div>GPU {tel!.gpu[0].load}%</div>}
                    <div>DSK {tel?.disk ?? 0}%</div>
                    {tel?.cpuTemp != null && <div>TMP {tel.cpuTemp}C</div>}
                    {p.weather && !p.weather.error && <div>{p.t.wx} {p.weather.temp}D</div>}
                </aside>
                <div className="flex-1 min-w-0 flex flex-col" style={bevel}>
                    {p.feed.length === 0
                        ? <div className="flex-1 px-4 py-3 text-[12px] opacity-50 uppercase">{p.t.empty3}</div>
                        : <RtFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />}
                </div>
            </div>
            <RtInput {...p} />
        </div>
    );
}

// ───────────────────────────── 4) Retro · Wave ──────────────────────────────
// Synthwave ızgara ufuk + üstünde feed.
export function RetroWave(p: SkinProps) {
    return (
        <div className="h-screen w-screen flex flex-col relative overflow-hidden" style={retroBg as React.CSSProperties}>
            <Scanlines />
            {/* Perspektif ızgara ufuk */}
            <div className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none" style={{
                backgroundImage: "repeating-linear-gradient(90deg, rgba(var(--hud),0.25) 0 1px, transparent 1px 40px), repeating-linear-gradient(0deg, rgba(var(--hud),0.25) 0 1px, transparent 1px 28px)",
                transform: "perspective(220px) rotateX(60deg)", transformOrigin: "bottom", opacity: 0.5,
            }} />
            <RtBar label="AEGIS-OS // WAVE" t={p.t} state={p.state} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} />
            <div className="flex-1 min-h-0 mx-3 flex flex-col z-10" style={{...bevel, background: "rgba(0,0,0,0.45)"}}>
                {p.feed.length === 0
                    ? <div className="flex-1 grid place-items-center text-[13px] opacity-50 uppercase tracking-widest">{p.t.idle}</div>
                    : <RtFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />}
            </div>
            <RtInput {...p} />
        </div>
    );
}

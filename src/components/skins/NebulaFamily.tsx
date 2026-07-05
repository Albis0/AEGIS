// AEGIS — "Nebula" skin family (4 members: Aura / Chat / Board / Zen)
// =============================================================================
// A design language entirely different from the Cyber/HUD family: soft, rounded
// (rounded-3xl), gradient-glow, chat bubbles, no sharp corners. Consumes the same
// SkinProps. All 4 skins share the common NebFeed + NebInput parts, only the
// OUTER layout/chrome differs.

import React from "react";
import type {SkinProps} from "./HologramSkin";
import type {VoiceMode} from "../../hooks/useVoice";
import VoiceModeToggle from "../VoiceModeToggle";

import {toolLabel as TOOL_VERB_fn} from "./toolLabels";
const TOOL_VERB = (name: string, t: SkinProps["t"]) => TOOL_VERB_fn(name, t);

// Soft gradient background — the family's signature.
const nebulaBg: React.CSSProperties = {
    background:
        "radial-gradient(120% 80% at 50% -10%, rgba(var(--hud),0.10), transparent 60%)," +
        "radial-gradient(100% 60% at 100% 110%, rgba(var(--hud-soft),0.08), transparent 55%)," +
        "var(--bg)",
    color: "rgb(var(--hud-soft))",
    fontFamily: "var(--ui-font)",
    WebkitFontSmoothing: "antialiased",
};

// ───────── Shared: bubble feed ─────────
function NebFeed({feed, streaming, t, feedRef, center}: Pick<SkinProps, "feed" | "streaming" | "t" | "feedRef"> & {center?: boolean}) {
    return (
        <div ref={feedRef} className={`flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 ${center ? "max-w-2xl w-full mx-auto" : ""}`}>
            {feed.map((item, idx) => {
                if (item.kind === "error") {
                    return (
                        <div key={item.id} className="rise flex justify-start">
                            <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md text-[13px] leading-relaxed"
                                style={{background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.3)", color: "rgb(252,180,180)"}}>
                                {item.text}
                            </div>
                        </div>
                    );
                }
                if (item.kind === "notice") {
                    return (
                        <div key={item.id} className="rise px-4 py-2 rounded-2xl text-[11.5px] leading-relaxed"
                            style={{background: "rgba(var(--hud),0.05)", border: "1px solid rgba(var(--hud),0.14)", color: "rgba(var(--hud),0.6)"}}>
                            {item.text}
                        </div>
                    );
                }
                if (item.kind === "user") {
                    return (
                        <div key={item.id} className="rise flex justify-end">
                            <div className="max-w-[80%] px-4 py-2.5 rounded-3xl rounded-br-md text-[13px] leading-relaxed shadow-lg"
                                style={{background: "linear-gradient(135deg, rgba(var(--hud),0.22), rgba(var(--hud),0.12))", border: "1px solid rgba(var(--hud),0.3)", color: "rgb(var(--hud-soft))"}}>
                                {item.text}
                            </div>
                        </div>
                    );
                }
                return (
                    <div key={item.id} className="rise flex justify-start">
                        <div className="max-w-[88%] min-w-0">
                            {item.tools.map((tool, i) => (
                                <div key={i} className="flex items-center gap-2 text-[10px] mb-1 pl-1 tracking-wide"
                                    style={{color: tool.status === "running" ? "rgb(var(--hud))" : "rgb(var(--status-ok))"}}>
                                    <span className={tool.status === "running" ? "flick" : ""}>{tool.status === "running" ? "◌" : "●"}</span>
                                    <span>{TOOL_VERB(tool.name, t)}{tool.status === "running" ? "…" : ""}</span>
                                </div>
                            ))}
                            {item.text && (
                                <div className="px-4 py-2.5 rounded-3xl rounded-bl-md text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                                    style={{background: "rgba(255,255,255,0.04)", border: "1px solid rgba(var(--hud),0.14)", color: "rgba(240,250,255,0.92)"}}>
                                    {item.text}
                                    {streaming && idx === feed.length - 1 && (
                                        <span className="inline-block w-1.5 h-[1em] ml-0.5 align-middle flick rounded-full" style={{background: "rgb(var(--hud))"}} />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ───────── Shared: rounded input dock ─────────
function NebInput({input, setInput, attachments, setAttachments, state, streaming, placeholder, onSend, onStop, onNavigateHistory, mode, setMode, listening, activated, t, glass}: Pick<SkinProps,
    "input" | "setInput" | "attachments" | "setAttachments" | "state" | "streaming" | "placeholder" | "onSend" | "onStop" | "onNavigateHistory" | "mode" | "setMode" | "listening" | "activated" | "t"> & {glass?: boolean}) {
    return (
        <div className="shrink-0 px-4 pb-4 pt-1">
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 max-w-2xl mx-auto">
                    {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px]"
                            style={{background: "rgba(var(--hud),0.08)", border: "1px solid rgba(var(--hud),0.2)", color: "rgba(var(--hud-soft),0.9)"}}>
                            {att.mime.startsWith("image/") ? <img src={att.url} alt={att.name} className="w-5 h-5 object-cover rounded-full" /> : <span>•</span>}
                            <span className="max-w-[90px] truncate">{att.name}</span>
                            <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100">✕</button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-center gap-2 rounded-full px-3 py-2 max-w-2xl mx-auto"
                style={{background: glass ? "rgba(255,255,255,0.05)" : "rgba(var(--hud),0.05)", border: "1px solid rgba(var(--hud),0.25)", boxShadow: "0 8px 30px rgba(0,0,0,0.35), 0 0 24px rgba(var(--hud),0.08)"}}>
                <VoiceModeToggle mode={mode} listening={listening} activated={activated} t={t} onToggle={() => {
                    const next: VoiceMode = mode === "off" ? "always-on" : mode === "always-on" ? "wake-word" : "off";
                    setMode(next);
                }} />
                <input
                    value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { onSend(); return; } if (e.key === "ArrowUp") { e.preventDefault(); onNavigateHistory?.("up"); } if (e.key === "ArrowDown") { e.preventDefault(); onNavigateHistory?.("down"); } }}
                    placeholder={placeholder} disabled={streaming} autoFocus
                    className="flex-1 bg-transparent outline-none text-[13px] px-1 disabled:opacity-40"
                    style={{color: "rgb(var(--hud-soft))"}}
                />
                <label className="cursor-pointer opacity-50 hover:opacity-100 transition text-[14px]" title={t.attachFile} style={{color: "rgb(var(--hud))"}}>
                    +
                    <input type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py" className="hidden"
                        onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            void Promise.all(files.map((f) => new Promise<{name: string; url: string; mime: string; data: string}>((res) => {
                                const reader = new FileReader();
                                reader.onload = () => { const r = reader.result as string; res({name: f.name, url: r, mime: f.type || "application/octet-stream", data: r.split(",")[1] ?? ""}); };
                                reader.readAsDataURL(f);
                            }))).then((atts) => setAttachments([...attachments, ...atts]));
                            e.target.value = "";
                        }} />
                </label>
                {state === "speaking" && (
                    <button onClick={onStop} className="px-3 py-1 rounded-full text-[11px] transition hover:brightness-125"
                        style={{color: "rgb(var(--status-danger))", background: "rgba(248,113,113,0.1)"}}>{t.stop}</button>
                )}
                <button onClick={onSend} disabled={streaming || (!input.trim() && attachments.length === 0)}
                    className="w-9 h-9 grid place-items-center rounded-full disabled:opacity-30 transition hover:brightness-125 shrink-0"
                    style={{background: "linear-gradient(135deg, rgb(var(--hud)), rgb(var(--hud-deep)))", color: "var(--bg)"}}>↑</button>
            </div>
        </div>
    );
}

// Top bar (shared)
function NebBar({label, t, onSettingsOpen, onHistoryOpen, status}: {label: string; t: SkinProps["t"]; onSettingsOpen: () => void; onHistoryOpen?: () => void; status?: string}) {
    return (
        <div className="drag shrink-0 h-12 flex items-center justify-between px-5">
            <span className="text-[12px] tracking-[0.35em]" style={{fontFamily: "Orbitron, sans-serif", color: "rgb(var(--hud))", opacity: 0.85}}>{label}</span>
            <div className="flex items-center gap-2">
                {status && <span className="text-[10px] tracking-widest opacity-50 mr-1" style={{color: "rgb(var(--hud))"}}>{status}</span>}
                <div className="no-drag flex gap-1">
                    {onHistoryOpen && <button onClick={onHistoryOpen} title={t.tipHistory} className="w-8 h-8 grid place-items-center rounded-full opacity-50 hover:opacity-100 transition" style={{color: "rgb(var(--hud))"}}>◷</button>}
                    <button onClick={onSettingsOpen} title={t.tipSettings} className="w-8 h-8 grid place-items-center rounded-full opacity-50 hover:opacity-100 transition" style={{color: "rgb(var(--hud))"}}>⚙</button>
                    <button onClick={() => window.jarvis.minimize()} title={t.tipMinimize} className="w-8 h-8 grid place-items-center rounded-full opacity-50 hover:opacity-100 transition" style={{color: "rgb(var(--hud))"}}>─</button>
                    <button onClick={() => window.jarvis.close()} title={t.tipClose} className="w-8 h-8 grid place-items-center rounded-full opacity-50 hover:opacity-100 transition" style={{color: "rgb(var(--hud))"}}>✕</button>
                </div>
            </div>
        </div>
    );
}

const stWord = (state: string, t: SkinProps["t"]) =>
    state === "thinking" ? t.stProc : state === "speaking" ? t.stResp : state === "listening" ? t.stListen : state === "error" ? t.stErr : t.stReady;

// ───────────────────────────── 1) Nebula · Aura ─────────────────────────────
// A breathing gradient orb in the center + a floating chat card below.
export function NebulaAura(p: SkinProps) {
    const pulsing = p.state !== "idle";
    return (
        <div className="h-screen w-screen flex flex-col" style={nebulaBg as React.CSSProperties}>
            <NebBar label="AEGIS" t={p.t} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} status={stWord(p.state, p.t)} />
            <div className="flex-1 min-h-0 flex flex-col items-center">
                <div className="shrink-0 grid place-items-center py-6">
                    <div className={`rounded-full ${pulsing ? "breathe" : ""}`}
                        style={{width: 120, height: 120,
                            background: "radial-gradient(circle at 35% 30%, rgba(var(--hud-soft),0.9), rgba(var(--hud),0.5) 45%, rgba(var(--hud-deep),0.15) 75%, transparent)",
                            boxShadow: "0 0 60px rgba(var(--hud),0.35), inset 0 0 30px rgba(var(--hud-soft),0.4)"}} />
                </div>
                {p.feed.length === 0
                    ? <div className="flex-1 grid place-items-center text-[13px] opacity-40">{p.t.empty3}</div>
                    : <NebFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} center />}
            </div>
            <NebInput {...p} glass />
        </div>
    );
}

// ───────────────────────────── 2) Nebula · Chat ─────────────────────────────
// A full-screen modern messaging view.
export function NebulaChat(p: SkinProps) {
    return (
        <div className="h-screen w-screen flex flex-col" style={nebulaBg as React.CSSProperties}>
            <NebBar label="AEGIS · CHAT" t={p.t} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} status={stWord(p.state, p.t)} />
            {p.feed.length === 0
                ? <div className="flex-1 grid place-items-center text-[13px] opacity-40 text-center px-8"><div className="space-y-1"><div>{p.t.empty1}</div><div>{p.t.empty3}</div></div></div>
                : <NebFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} center />}
            <NebInput {...p} />
        </div>
    );
}

// ───────────────────────────── 3) Nebula · Board ────────────────────────────
// Rounded stat cards on top + chat below.
export function NebulaBoard(p: SkinProps) {
    const {tel, weather} = p;
    const Card = ({label, value, sub}: {label: string; value: React.ReactNode; sub?: string}) => (
        <div className="rounded-2xl px-4 py-3 flex flex-col gap-1" style={{background: "rgba(255,255,255,0.035)", border: "1px solid rgba(var(--hud),0.14)"}}>
            <span className="text-[9px] tracking-[0.25em] opacity-45">{label}</span>
            <span className="text-[20px] leading-none tabular-nums" style={{fontFamily: "Orbitron, sans-serif", color: "rgb(var(--hud))"}}>{value}</span>
            {sub && <span className="text-[9px] opacity-40">{sub}</span>}
        </div>
    );
    return (
        <div className="h-screen w-screen flex flex-col" style={nebulaBg as React.CSSProperties}>
            <NebBar label="AEGIS · BOARD" t={p.t} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} status={stWord(p.state, p.t)} />
            <div className="shrink-0 grid grid-cols-4 gap-3 px-4 pb-2">
                <Card label="CPU" value={<>{tel?.cpu ?? 0}<span className="text-[11px] opacity-50">%</span></>} sub={tel?.cpuTemp != null ? `${tel.cpuTemp}°C` : undefined} />
                <Card label="RAM" value={<>{tel?.ram ?? 0}<span className="text-[11px] opacity-50">%</span></>} />
                <Card label={(tel?.gpu ?? []).length > 0 ? "GPU" : "DISK"} value={<>{(tel?.gpu ?? []).length > 0 ? tel!.gpu[0].load : (tel?.disk ?? 0)}<span className="text-[11px] opacity-50">%</span></>} />
                <Card label={p.t.secWeather} value={weather && !weather.error ? <>{weather.temp}°</> : "—"} sub={weather && !weather.error ? weather.desc : undefined} />
            </div>
            <div className="flex-1 min-h-0 mx-4 mb-1 rounded-3xl overflow-hidden flex flex-col" style={{background: "rgba(255,255,255,0.02)", border: "1px solid rgba(var(--hud),0.1)"}}>
                {p.feed.length === 0
                    ? <div className="flex-1 grid place-items-center text-[13px] opacity-40">{p.t.emptyDash}</div>
                    : <NebFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />}
            </div>
            <NebInput {...p} />
        </div>
    );
}

// ───────────────────────────── 4) Nebula · Zen ──────────────────────────────
// Ultra-minimal: plenty of whitespace, just the latest messages + a large input.
export function NebulaZen(p: SkinProps) {
    return (
        <div className="h-screen w-screen flex flex-col" style={nebulaBg as React.CSSProperties}>
            <div className="drag shrink-0 h-10 flex items-center justify-end px-5 gap-1">
                <button onClick={p.onSettingsOpen} title={p.t.tipSettings} className="no-drag w-8 h-8 grid place-items-center rounded-full opacity-30 hover:opacity-90 transition" style={{color: "rgb(var(--hud))"}}>⚙</button>
                <button onClick={() => window.jarvis.close()} title={p.t.tipClose} className="no-drag w-8 h-8 grid place-items-center rounded-full opacity-30 hover:opacity-90 transition" style={{color: "rgb(var(--hud))"}}>✕</button>
            </div>
            {p.feed.length === 0
                ? <div className="flex-1 grid place-items-center text-[15px] opacity-30 tracking-wide">{p.t.idle}</div>
                : <NebFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} center />}
            <NebInput {...p} glass />
        </div>
    );
}

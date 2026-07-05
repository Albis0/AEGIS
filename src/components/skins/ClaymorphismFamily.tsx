// AEGIS — "Claymorphism" skin family (4 variants: Orb / Pillow / Pebble / Tiles)
// =============================================================================
// Design language: Pastel DARK. Deep purple-navy background (#1a1530), soft pastel
// accent (lilac/mint/peach), very rounded (rounded-3xl/full), double shadow
// (soft outer drop + inner highlight), puffy/cozy surfaces. Poppins font.

import React, {useState, useEffect} from "react";
import {useClock} from "../../hooks/useClock";
import type {SkinProps} from "./HologramSkin";
import type {VoiceMode} from "../../hooks/useVoice";
import VoiceModeToggle from "../VoiceModeToggle";

// ─── Family color constants ──────────────────────────────────────────────────────
const CL = {
    bg:        "#14112a",   // deep purple-navy
    bgPanel:   "#1e1a38",   // panel background
    bgCard:    "#252040",   // card background
    bgInput:   "#1a1630",   // input recess
    lila:      "#c4b5fd",   // soft lilac (main accent)
    mint:      "#86efac",   // mint green (secondary)
    peach:     "#fda4af",   // peach pink (tertiary)
    sky:       "#7dd3fc",   // sky blue
    lilaDark:  "#7c3aed",   // dark lilac
    text:      "#e2ddf7",   // light text
    textDim:   "#8b80b8",   // dim text
    danger:    "#fb7185",   // soft red
    // Puffy "clay" shadow: soft outer drop + inner highlight
    clayShadow: (color: string) =>
        `0 8px 24px ${color}30, 0 2px 8px ${color}20, inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -2px 4px rgba(0,0,0,0.3)`,
    clayShadowSm: (color: string) =>
        `0 4px 12px ${color}25, 0 1px 4px ${color}15, inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 3px rgba(0,0,0,0.25)`,
};

const clRoot: React.CSSProperties = {
    background: CL.bg,
    color: CL.text,
    fontFamily: "Poppins, sans-serif",
    WebkitFontSmoothing: "antialiased",
};

// Puffy card
const clay = (color: string, extra?: React.CSSProperties): React.CSSProperties => ({
    background: CL.bgCard,
    boxShadow: CL.clayShadow(color),
    borderRadius: 20,
    ...extra,
});

const claySm = (color: string, extra?: React.CSSProperties): React.CSSProperties => ({
    background: CL.bgCard,
    boxShadow: CL.clayShadowSm(color),
    borderRadius: 14,
    ...extra,
});

const stWord = (state: string, t: SkinProps["t"]) =>
    state === "thinking" ? t.stProc
    : state === "speaking" ? t.stResp
    : state === "listening" ? t.stListen
    : state === "error" ? t.stErr
    : t.stReady;

// ─── Shared: feed ─────────────────────────────────────────────────────────────
function ClFeed({feed, streaming, t, feedRef, compact}: Pick<SkinProps,"feed"|"streaming"|"t"|"feedRef"> & {compact?: boolean}) {
    const gap = compact ? "gap-2" : "gap-3";
    const py  = compact ? "py-2 px-3" : "py-3 px-4";
    return (
        <div ref={feedRef} className={`flex-1 min-h-0 overflow-y-auto p-3 flex flex-col ${gap}`}>
            {feed.map((item, idx) => {
                if (item.kind === "error") return (
                    <div key={item.id} className={`rise ${py} text-[13px] leading-relaxed`}
                        style={clay(CL.danger, {background: "#2a1520"})}>
                        <span className="text-[9px] font-semibold tracking-widest block mb-1" style={{color: CL.danger}}>{t.errLabel}</span>
                        <span className="break-words" style={{color: CL.danger}}>{item.text}</span>
                    </div>
                );
                if (item.kind === "notice") return (
                    <div key={item.id} className={`rise ${py} text-[12px] leading-relaxed opacity-80`}
                        style={clay(CL.textDim, {background: CL.bgCard})}>
                        <span className="break-words" style={{color: CL.textDim}}>{item.text}</span>
                    </div>
                );
                if (item.kind === "user") return (
                    <div key={item.id} className={`rise ${py} text-[13px] leading-relaxed self-end max-w-[80%]`}
                        style={clay(CL.lila, {background: "#2d2050"})}>
                        <span className="text-[9px] font-semibold tracking-widest block mb-1" style={{color: CL.lila}}>SEN</span>
                        <span className="break-words">{item.text}</span>
                    </div>
                );
                return (
                    <div key={item.id} className={`rise ${py} text-[13px] leading-relaxed`}
                        style={clay(CL.mint, {background: CL.bgCard})}>
                        <span className="text-[9px] font-semibold tracking-widest block mb-1" style={{color: CL.mint}}>AEGIS</span>
                        {item.tools.map((tool, i) => (
                            <div key={i} className="text-[10px] mb-0.5" style={{color: CL.textDim}}>
                                {tool.status === "running" ? "···" : "✓"} {tool.name.replace(/_/g," ")}
                            </div>
                        ))}
                        {item.text && (
                            <div className="whitespace-pre-wrap break-words">
                                {item.text}
                                {streaming && idx === feed.length - 1 && (
                                    <span className="inline-block w-[0.45em] h-[1em] ml-0.5 align-middle rounded-sm flick" style={{background: CL.mint}} />
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Shared: input ─────────────────────────────────────────────────────────────
function ClInput({input, setInput, attachments, setAttachments, state, streaming, placeholder, onSend, onStop, onNavigateHistory, mode, setMode, listening, activated, t}: Pick<SkinProps,
    "input"|"setInput"|"attachments"|"setAttachments"|"state"|"streaming"|"placeholder"|"onSend"|"onStop"|"onNavigateHistory"|"mode"|"setMode"|"listening"|"activated"|"t">) {
    return (
        <div className="shrink-0 px-3 pb-3 pt-1">
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium"
                            style={claySm(CL.peach, {background: "#2a1a22"})}>
                            <span className="max-w-[90px] truncate" style={{color: CL.peach}}>{att.name}</span>
                            <button onClick={() => setAttachments(attachments.filter((_,j) => j !== i))} style={{color: CL.peach}}>✕</button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-2 items-stretch">
                <input
                    value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { onSend(); return; } if (e.key === "ArrowUp") { e.preventDefault(); onNavigateHistory?.("up"); } if (e.key === "ArrowDown") { e.preventDefault(); onNavigateHistory?.("down"); } }}
                    placeholder={placeholder} disabled={streaming} autoFocus
                    className="flex-1 px-4 py-2.5 text-[13px] font-medium disabled:opacity-40 outline-none"
                    style={{
                        background: CL.bgInput,
                        boxShadow: `inset 0 2px 8px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(196,181,253,0.1)`,
                        borderRadius: 14,
                        color: CL.text,
                        caretColor: CL.lila,
                    }}
                />
                <label className="cursor-pointer px-3 grid place-items-center text-[14px] font-bold" title={t.attachFile}
                    style={claySm(CL.peach, {background: "#2a1525", color: CL.peach})}>
                    +
                    <input type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py" className="hidden"
                        onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            void Promise.all(files.map((f) => new Promise<{name:string;url:string;mime:string;data:string}>((res) => {
                                const reader = new FileReader();
                                reader.onload = () => { const r = reader.result as string; res({name:f.name,url:r,mime:f.type||"application/octet-stream",data:r.split(",")[1]??""}); };
                                reader.readAsDataURL(f);
                            }))).then((atts) => setAttachments([...attachments,...atts]));
                            e.target.value = "";
                        }} />
                </label>
                <div className="px-2 grid place-items-center" style={claySm(CL.sky, {background: "#1a2035"})}>
                    <VoiceModeToggle mode={mode} listening={listening} activated={activated} t={t} onToggle={() => {
                        const next: VoiceMode = mode==="off" ? "always-on" : mode==="always-on" ? "wake-word" : "off";
                        setMode(next);
                    }} />
                </div>
                {state === "speaking" && (
                    <button onClick={onStop} className="px-3 text-[11px] font-semibold"
                        style={claySm(CL.danger, {background: "#2a1520", color: CL.danger})}>{t.stop}</button>
                )}
                <button onClick={onSend} disabled={streaming || (!input.trim() && attachments.length === 0)}
                    className="px-4 text-[12px] font-semibold disabled:opacity-30"
                    style={claySm(CL.lila, {background: "#2d2050", color: CL.lila})}>{t.send}</button>
            </div>
        </div>
    );
}

// ─── Shared: top bar ─────────────────────────────────────────────────────────
function ClBar({label, t, state, onSettingsOpen, onHistoryOpen, accent = CL.lila}: {
    label: string; t: SkinProps["t"]; state: string; accent?: string;
    onSettingsOpen: () => void; onHistoryOpen?: () => void;
}) {
    return (
        <div className="drag shrink-0 flex items-center justify-between px-4 h-12 mx-3 mt-3 mb-1"
            style={claySm(accent, {background: CL.bgPanel})}>
            <span className="text-[13px] font-semibold tracking-wide" style={{color: accent}}>{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-[9px] font-medium tracking-widest px-2 py-0.5 rounded-full"
                    style={{background: CL.bgInput, color: CL.textDim, boxShadow: `inset 0 1px 3px rgba(0,0,0,0.4)`}}>
                    {stWord(state, t)}
                </span>
                <div className="no-drag flex gap-1.5">
                    {onHistoryOpen && (
                        <button onClick={onHistoryOpen} title={t.tipHistory}
                            className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-semibold"
                            style={claySm(CL.sky, {background: CL.bgInput, color: CL.sky})}>H</button>
                    )}
                    <button onClick={onSettingsOpen} title={t.tipSettings}
                        className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-semibold"
                        style={claySm(CL.lila, {background: CL.bgInput, color: CL.lila})}>S</button>
                    <button onClick={() => window.jarvis.minimize()} title={t.tipMinimize}
                        className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-semibold"
                        style={claySm(CL.textDim, {background: CL.bgInput, color: CL.textDim})}>_</button>
                    <button onClick={() => window.jarvis.close()} title={t.tipClose}
                        className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-semibold"
                        style={claySm(CL.danger, {background: "#2a1520", color: CL.danger})}>✕</button>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1) Claymorphism · ORB (Signature / Hero)
// Giant breathing clay orb in the center, pastel chat pills around it.
// ══════════════════════════════════════════════════════════════════════════════
export function ClOrb(p: SkinProps) {
    const [pulse, setPulse] = useState(false);
    useEffect(() => {
        const i = setInterval(() => setPulse((v) => !v), 2200);
        return () => clearInterval(i);
    }, []);

    const orbColor = p.state === "error" ? CL.danger
        : p.state === "thinking" ? CL.peach
        : p.state === "speaking" ? CL.mint
        : CL.lila;

    return (
        <div className="h-screen w-screen flex flex-col" style={clRoot}>
            {/* Top bar */}
            <div className="drag shrink-0 flex items-center justify-between px-4 h-11">
                <span className="text-[13px] font-semibold" style={{color: CL.lila}}>AEGIS · ORB</span>
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-medium px-2 py-0.5 rounded-full" style={{background: CL.bgCard, color: CL.textDim}}>{stWord(p.state, p.t)}</span>
                    <div className="no-drag flex gap-1.5">
                        {p.onHistoryOpen && <button onClick={p.onHistoryOpen} className="w-6 h-6 rounded-full grid place-items-center text-[10px]" style={claySm(CL.sky, {background: CL.bgCard, color: CL.sky})}>H</button>}
                        <button onClick={p.onSettingsOpen} className="w-6 h-6 rounded-full grid place-items-center text-[10px]" style={claySm(CL.lila, {background: CL.bgCard, color: CL.lila})}>S</button>
                        <button onClick={() => window.jarvis.minimize()} className="w-6 h-6 rounded-full grid place-items-center text-[10px]" style={claySm(CL.textDim, {background: CL.bgCard, color: CL.textDim})}>_</button>
                        <button onClick={() => window.jarvis.close()} className="w-6 h-6 rounded-full grid place-items-center text-[10px]" style={claySm(CL.danger, {background: "#2a1520", color: CL.danger})}>✕</button>
                    </div>
                </div>
            </div>

            {/* Middle area: Orb + last message */}
            <div className="shrink-0 flex items-center gap-4 px-4 py-2">
                {/* Puffy orb */}
                <div className="shrink-0 w-20 h-20 rounded-full grid place-items-center" style={{
                    background: `radial-gradient(circle at 35% 30%, ${orbColor}55, ${orbColor}18)`,
                    boxShadow: `0 0 0 2px ${orbColor}30, 0 8px 32px ${orbColor}40, inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -3px 8px rgba(0,0,0,0.4)`,
                    transition: "all 0.8s ease",
                    transform: pulse ? "scale(1.04)" : "scale(1.0)",
                }}>
                    <div className="w-6 h-6 rounded-full" style={{
                        background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.6), ${orbColor}80)`,
                        boxShadow: `0 0 12px ${orbColor}60`,
                    }} />
                </div>
                {/* Last message summary */}
                <div className="flex-1 min-w-0">
                    {p.feed.length > 0 ? (() => {
                        const last = p.feed[p.feed.length - 1];
                        return (
                            <div className="px-3 py-2 text-[12px] leading-relaxed" style={claySm(orbColor, {background: CL.bgCard})}>
                                <span className="text-[9px] font-semibold block mb-0.5" style={{color: orbColor}}>
                                    {last.kind === "user" ? "SEN" : last.kind === "error" ? p.t.errLabel : "AEGIS"}
                                </span>
                                <span className="line-clamp-2 break-words">{last.kind !== "error" ? last.text : last.text}</span>
                            </div>
                        );
                    })() : (
                        <div className="text-[12px] font-medium opacity-30">{p.t.empty3}</div>
                    )}
                </div>
            </div>

            {/* Chat feed */}
            {p.feed.length > 1
                ? <ClFeed feed={p.feed.slice(0, -1)} streaming={false} t={p.t} feedRef={p.feedRef} />
                : <div className="flex-1" />
            }

            <ClInput {...p} />
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2) Claymorphism · PILLOW (Chat / Chat-first)
// Puffy pillow cards, very rounded, soft shadow, colored user/assistant.
// ══════════════════════════════════════════════════════════════════════════════
export function ClPillow(p: SkinProps) {
    return (
        <div className="h-screen w-screen flex flex-col" style={clRoot}>
            <ClBar label="PILLOW · SOHBET" t={p.t} state={p.state} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} accent={CL.mint} />
            {p.feed.length === 0
                ? <div className="flex-1 flex items-center justify-center">
                    <div className="px-6 py-4 text-[13px] font-medium opacity-30" style={clay(CL.lila)}>{p.t.empty3}</div>
                  </div>
                : <ClFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />
            }
            <ClInput {...p} />
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3) Claymorphism · PEBBLE (Compact / Mini)
// Minimal: pebble-oval nav on the left, compressed chat on the right.
// ══════════════════════════════════════════════════════════════════════════════
export function ClPebble(p: SkinProps) {
    const {tel} = p;
    return (
        <div className="h-screen w-screen flex" style={clRoot}>
            {/* Left pebble nav */}
            <aside className="shrink-0 w-16 flex flex-col items-center py-3 gap-3"
                style={{background: CL.bgPanel, borderRight: `1px solid rgba(196,181,253,0.08)`}}>
                {/* Logo pebble */}
                <div className="w-10 h-10 rounded-full grid place-items-center text-[10px] font-bold drag"
                    style={clay(CL.lila, {background: "#2d2050", color: CL.lila})}>AI</div>

                {/* Telemetry pebbles */}
                <div className="flex flex-col gap-2 flex-1 items-center justify-center">
                    <div className="flex flex-col items-center gap-0.5">
                        <div className="w-8 h-8 rounded-full grid place-items-center text-[10px] font-bold tabular-nums"
                            style={claySm(CL.mint, {background: "#1a2535", color: CL.mint})}>{tel?.cpu ?? 0}</div>
                        <span className="text-[7px] tracking-widest" style={{color: CL.textDim}}>CPU</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                        <div className="w-8 h-8 rounded-full grid place-items-center text-[10px] font-bold tabular-nums"
                            style={claySm(CL.sky, {background: "#1a2035", color: CL.sky})}>{tel?.ram ?? 0}</div>
                        <span className="text-[7px] tracking-widest" style={{color: CL.textDim}}>RAM</span>
                    </div>
                </div>

                {/* Bottom buttons */}
                <div className="no-drag flex flex-col gap-1.5">
                    {p.onHistoryOpen && (
                        <button onClick={p.onHistoryOpen} className="w-8 h-8 rounded-full grid place-items-center text-[10px] font-semibold"
                            style={claySm(CL.sky, {background: CL.bgCard, color: CL.sky})}>H</button>
                    )}
                    <button onClick={p.onSettingsOpen} className="w-8 h-8 rounded-full grid place-items-center text-[10px] font-semibold"
                        style={claySm(CL.lila, {background: CL.bgCard, color: CL.lila})}>S</button>
                    <button onClick={() => window.jarvis.minimize()} className="w-8 h-8 rounded-full grid place-items-center text-[10px]"
                        style={claySm(CL.textDim, {background: CL.bgCard, color: CL.textDim})}>_</button>
                    <button onClick={() => window.jarvis.close()} className="w-8 h-8 rounded-full grid place-items-center text-[10px]"
                        style={claySm(CL.danger, {background: "#2a1520", color: CL.danger})}>✕</button>
                </div>
            </aside>

            {/* Right: chat + input */}
            <div className="flex-1 min-w-0 flex flex-col">
                {p.feed.length === 0
                    ? <div className="flex-1 flex items-center justify-center">
                        <span className="text-[11px] font-medium opacity-25">{p.t.empty3}</span>
                      </div>
                    : <ClFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} compact />
                }
                <ClInput {...p} />
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4) Claymorphism · TILES (Panel / Dashboard)
// Puffy clay tiles: telemetry cards on top, chat below.
// ══════════════════════════════════════════════════════════════════════════════
export function ClTiles(p: SkinProps) {
    const {tel, weather} = p;
    const clock = useClock();

    const tiles: {label: string; value: string; accent: string; bg: string}[] = [
        {label: "CPU",  value: `${tel?.cpu ?? 0}%`,  accent: CL.lila,  bg: "#2d2050"},
        {label: "RAM",  value: `${tel?.ram ?? 0}%`,  accent: CL.sky,   bg: "#1a2035"},
        {label: "DISK", value: `${tel?.disk ?? 0}%`, accent: CL.mint,  bg: "#1a2535"},
        {label: "SAAT", value: clock.toLocaleTimeString(p.t.locale, {hour:"2-digit",minute:"2-digit"}), accent: CL.peach, bg: "#2a1a22"},
    ];
    if ((tel?.gpu ?? []).length > 0) tiles[2] = {label: "GPU", value: `${tel!.gpu[0].load}%`, accent: CL.mint, bg: "#1a2535"};
    if (weather && !weather.error) tiles[3] = {label: p.t.wx, value: `${weather.temp}°`, accent: CL.sky, bg: "#1a2035"};

    return (
        <div className="h-screen w-screen flex flex-col" style={clRoot}>
            <ClBar label="TILES · PANO" t={p.t} state={p.state} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} accent={CL.peach} />

            {/* Tile grid */}
            <div className="shrink-0 grid grid-cols-4 gap-2.5 px-3 py-2">
                {tiles.map((tile) => (
                    <div key={tile.label} className="flex flex-col items-center justify-center py-3"
                        style={clay(tile.accent, {background: tile.bg})}>
                        <div className="text-[22px] font-semibold tabular-nums leading-none" style={{color: tile.accent}}>{tile.value}</div>
                        <div className="text-[8px] font-semibold tracking-[0.25em] mt-1.5" style={{color: CL.textDim}}>{tile.label}</div>
                    </div>
                ))}
            </div>

            {/* Chat */}
            {p.feed.length === 0
                ? <div className="flex-1 flex items-center justify-center">
                    <div className="px-5 py-3 text-[12px] font-medium opacity-25" style={clay(CL.lila)}>{p.t.emptyDash}</div>
                  </div>
                : <ClFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />
            }

            <ClInput {...p} />
        </div>
    );
}

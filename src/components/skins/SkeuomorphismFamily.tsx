// AEGIS — "Skeuomorphism" skin ailesi (4 ferdi: Desk / Journal / Walkman / Cockpit)
// =============================================================================
// Tasarım dili: Gerçek nesne & doku. Sıcak koyu ceviz/deri zemin (~#1c1209),
// pirinç/amber vurgu, içe gömülü bevel (inset gölge), fiziksel düğme hissi,
// kâğıt-deri-metal doku katmanları. Oxanium / Rajdhani font.

import React, {useState, useEffect} from "react";
import type {SkinProps} from "./HologramSkin";
import type {VoiceMode} from "../../hooks/useVoice";
import VoiceModeToggle from "../VoiceModeToggle";

// ─── Aile renk sabitleri ──────────────────────────────────────────────────────
const SK = {
    bg:        "#1c1209",   // koyu ceviz
    bgPanel:   "#231710",   // panel zemini
    bgCard:    "#2a1d10",   // kart/girinti zemini
    bgInput:   "#160e06",   // input çukuru (daha koyu)
    brass:     "#c8922a",   // pirinç (ana vurgu)
    brassLight:"#e8b84b",   // parlak pirinç
    brassDark: "#7a5518",   // koyu pirinç
    leather:   "#3d2410",   // deri tonu
    cream:     "#f5e6c8",   // krem metin
    creamDim:  "#b89a6a",   // soluk metin
    danger:    "#c0392b",   // koyu kırmızı
    ok:        "#2d7a3a",   // koyu yeşil
    // Bevel: üst-sol parlak, alt-sağ koyu (fiziksel çıkıntı hissi)
    bevelOut:  "inset 1px 1px 0 rgba(232,184,75,0.35), inset -1px -1px 0 rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.6)",
    // Basık (pressed) buton
    bevelIn:   "inset 2px 2px 4px rgba(0,0,0,0.8), inset -1px -1px 0 rgba(232,184,75,0.15)",
    // Çerçeve çizgisi
    borderBrass: "1px solid #7a5518",
    borderBrassGlow: "1px solid rgba(200,146,42,0.5)",
};

const skRoot: React.CSSProperties = {
    background: SK.bg,
    color: SK.cream,
    fontFamily: "Oxanium, Rajdhani, sans-serif",
    WebkitFontSmoothing: "antialiased",
};

// Kabartmalı panel (fiziksel çıkıntı)
const panel = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: SK.bgPanel,
    boxShadow: SK.bevelOut,
    border: SK.borderBrass,
    ...extra,
});

// Gömülü alan (basık/çukur)
const inset = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: SK.bgInput,
    boxShadow: SK.bevelIn,
    border: SK.borderBrass,
    ...extra,
});

// Fiziksel düğme
const btn = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: `linear-gradient(145deg, ${SK.bgCard} 0%, ${SK.leather} 100%)`,
    boxShadow: SK.bevelOut,
    border: SK.borderBrass,
    color: SK.brassLight,
    cursor: "pointer",
    ...extra,
});

const stWord = (state: string, t: SkinProps["t"]) =>
    state === "thinking" ? t.stProc
    : state === "speaking" ? t.stResp
    : state === "listening" ? t.stListen
    : state === "error" ? t.stErr
    : t.stReady;

// ─── Ortak: feed ─────────────────────────────────────────────────────────────
function SkFeed({feed, streaming, t, feedRef, compact}: Pick<SkinProps,"feed"|"streaming"|"t"|"feedRef"> & {compact?: boolean}) {
    const py = compact ? "py-1.5" : "py-2.5";
    return (
        <div ref={feedRef} className={`flex-1 min-h-0 overflow-y-auto px-3 ${compact ? "py-2" : "py-3"} space-y-2`}>
            {feed.map((item, idx) => {
                if (item.kind === "error") return (
                    <div key={item.id} className={`rise px-3 ${py} text-[12px] leading-relaxed`}
                        style={inset({borderColor: SK.danger})}>
                        <span className="text-[9px] tracking-widest block mb-1 font-semibold" style={{color: SK.danger}}>{t.errLabel}</span>
                        <span className="break-words" style={{color: "#e88"}}>{item.text}</span>
                    </div>
                );
                if (item.kind === "user") return (
                    <div key={item.id} className={`rise px-3 ${py} text-[12px] leading-relaxed self-end max-w-[80%] ml-auto`}
                        style={{...inset(), background: SK.leather}}>
                        <span className="text-[9px] tracking-widest block mb-0.5 font-semibold" style={{color: SK.creamDim}}>SEN</span>
                        <span className="break-words" style={{color: SK.cream}}>{item.text}</span>
                    </div>
                );
                return (
                    <div key={item.id} className={`rise px-3 ${py} text-[12px] leading-relaxed`} style={inset()}>
                        <span className="text-[9px] tracking-widest block mb-0.5 font-semibold" style={{color: SK.brass}}>AEGIS</span>
                        {item.tools.map((tool, i) => (
                            <div key={i} className="text-[10px] mb-0.5" style={{color: SK.creamDim}}>
                                [{tool.status === "running" ? "·····" : "✓"}] {tool.name.replace(/_/g," ")}
                            </div>
                        ))}
                        {item.text && (
                            <div className="whitespace-pre-wrap break-words" style={{color: SK.cream}}>
                                {item.text}
                                {streaming && idx === feed.length - 1 && (
                                    <span className="inline-block w-[0.5em] h-[1em] ml-0.5 align-middle flick" style={{background: SK.brass}} />
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Ortak: input ─────────────────────────────────────────────────────────────
function SkInput({input, setInput, attachments, setAttachments, state, streaming, placeholder, onSend, onStop, mode, setMode, listening, activated, t}: Pick<SkinProps,
    "input"|"setInput"|"attachments"|"setAttachments"|"state"|"streaming"|"placeholder"|"onSend"|"onStop"|"mode"|"setMode"|"listening"|"activated"|"t">) {
    return (
        <div className="shrink-0 px-3 pb-3 pt-2">
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1 px-2 py-0.5 text-[10px]" style={inset()}>
                            <span className="max-w-[90px] truncate" style={{color: SK.creamDim}}>{att.name}</span>
                            <button onClick={() => setAttachments(attachments.filter((_,j) => j !== i))} style={{color: SK.brass}}>✕</button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-2 items-stretch">
                <input
                    value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSend()}
                    placeholder={placeholder} disabled={streaming} autoFocus
                    className="flex-1 px-3 py-2 text-[13px] disabled:opacity-40 outline-none"
                    style={{...inset(), color: SK.cream, caretColor: SK.brass, background: SK.bgInput}}
                />
                <label className="cursor-pointer px-2.5 grid place-items-center text-[13px] font-bold" title={t.attachFile} style={btn()}>
                    +
                    <input type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py" className="hidden"
                        onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            Promise.all(files.map((f) => new Promise<{name:string;url:string;mime:string;data:string}>((res) => {
                                const reader = new FileReader();
                                reader.onload = () => { const r = reader.result as string; res({name:f.name,url:r,mime:f.type||"application/octet-stream",data:r.split(",")[1]??""}); };
                                reader.readAsDataURL(f);
                            }))).then((atts) => setAttachments([...attachments,...atts]));
                            e.target.value = "";
                        }} />
                </label>
                <div className="grid place-items-center px-2" style={btn()}>
                    <VoiceModeToggle mode={mode} listening={listening} activated={activated} t={t} onToggle={() => {
                        const next: VoiceMode = mode==="off" ? "always-on" : mode==="always-on" ? "wake-word" : "off";
                        setMode(next);
                    }} />
                </div>
                {state === "speaking" && (
                    <button onClick={onStop} className="px-3 text-[11px] font-semibold tracking-wider"
                        style={btn({background: SK.danger, borderColor: SK.danger, color: "#fff"})}>{t.stop}</button>
                )}
                <button onClick={onSend} disabled={streaming || (!input.trim() && attachments.length === 0)}
                    className="px-4 text-[12px] font-semibold tracking-wider uppercase disabled:opacity-30"
                    style={btn()}>{t.send}</button>
            </div>
        </div>
    );
}

// ─── Ortak: üst çubuk ─────────────────────────────────────────────────────────
function SkBar({label, t, state, onSettingsOpen, onHistoryOpen}: {
    label: string; t: SkinProps["t"]; state: string;
    onSettingsOpen: () => void; onHistoryOpen?: () => void;
}) {
    return (
        <div className="drag shrink-0 h-10 flex items-center justify-between px-3 mx-3 mt-3 mb-1" style={panel()}>
            <div className="flex items-center gap-2">
                {/* Pirinç cıvata dekor */}
                <div className="w-3 h-3 rounded-full" style={{background: `radial-gradient(circle at 35% 35%, ${SK.brassLight}, ${SK.brassDark})`, boxShadow: "0 1px 2px rgba(0,0,0,0.8)"}} />
                <span className="text-[11px] font-semibold tracking-[0.25em] uppercase" style={{color: SK.brassLight}}>{label}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[9px] tracking-[0.25em] uppercase" style={{color: SK.creamDim}}>{stWord(state,t)}</span>
                <div className="no-drag flex gap-1.5">
                    {onHistoryOpen && (
                        <button onClick={onHistoryOpen} title={t.tipHistory} className="w-6 h-6 text-[10px] grid place-items-center rounded-sm" style={btn()}>H</button>
                    )}
                    <button onClick={onSettingsOpen} title={t.tipSettings} className="w-6 h-6 text-[10px] grid place-items-center rounded-sm" style={btn()}>S</button>
                    <button onClick={() => window.jarvis.minimize()} title={t.tipMinimize} className="w-6 h-6 text-[10px] grid place-items-center rounded-sm" style={btn()}>_</button>
                    <button onClick={() => window.jarvis.close()} title={t.tipClose} className="w-6 h-6 text-[10px] grid place-items-center rounded-sm"
                        style={btn({background: SK.danger, borderColor: SK.danger, color: "#fff"})}>✕</button>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1) Skeuomorphism · DESK (İmza / Hero)
// Ahşap masa hissi: üstte pirinç çıtalı panel, sohbet kâğıt notepad'de,
// köşelerde vida dekor, zemin yatay-ahşap desen.
// ══════════════════════════════════════════════════════════════════════════════
export function SkDesk(p: SkinProps) {
    return (
        <div className="h-screen w-screen flex flex-col" style={{
            ...skRoot,
            // Yatay tahta desen (repeating-linear gradient)
            backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 28px)",
        }}>
            {/* Üst pirinç başlık bandı */}
            <div className="drag shrink-0 flex items-center justify-between px-4 py-2"
                style={{
                    background: `linear-gradient(180deg, #2e1e0a 0%, #1c1209 100%)`,
                    borderBottom: `2px solid ${SK.brass}`,
                    boxShadow: `0 2px 0 ${SK.brassDark}, inset 0 1px 0 rgba(232,184,75,0.2)`,
                }}>
                <div>
                    <div className="text-[13px] font-semibold tracking-[0.3em] uppercase" style={{color: SK.brassLight}}>AEGIS</div>
                    <div className="text-[8px] tracking-[0.4em] uppercase" style={{color: SK.creamDim}}>DESK · AI ASISTAN</div>
                </div>
                <div className="no-drag flex items-center gap-2">
                    <span className="text-[9px] tracking-widest uppercase px-2 py-0.5" style={{...inset(), color: SK.creamDim}}>{stWord(p.state, p.t)}</span>
                    {p.onHistoryOpen && <button onClick={p.onHistoryOpen} title={p.t.tipHistory} className="w-6 h-6 grid place-items-center text-[10px] rounded-sm" style={btn()}>H</button>}
                    <button onClick={p.onSettingsOpen} title={p.t.tipSettings} className="w-6 h-6 grid place-items-center text-[10px] rounded-sm" style={btn()}>S</button>
                    <button onClick={() => window.jarvis.minimize()} title={p.t.tipMinimize} className="w-6 h-6 grid place-items-center text-[10px] rounded-sm" style={btn()}>_</button>
                    <button onClick={() => window.jarvis.close()} title={p.t.tipClose} className="w-6 h-6 grid place-items-center text-[10px] rounded-sm"
                        style={btn({background: SK.danger, borderColor: SK.danger, color: "#fff"})}>✕</button>
                </div>
            </div>
            {/* Vida dekor köşeleri */}
            <div className="relative flex-1 min-h-0 m-3 flex flex-col" style={panel()}>
                <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full"
                    style={{background: `radial-gradient(circle at 35% 35%, ${SK.brassLight}, ${SK.brassDark})`, boxShadow: "0 1px 2px rgba(0,0,0,0.9)"}} />
                <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full"
                    style={{background: `radial-gradient(circle at 35% 35%, ${SK.brassLight}, ${SK.brassDark})`, boxShadow: "0 1px 2px rgba(0,0,0,0.9)"}} />
                <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full"
                    style={{background: `radial-gradient(circle at 35% 35%, ${SK.brassLight}, ${SK.brassDark})`, boxShadow: "0 1px 2px rgba(0,0,0,0.9)"}} />
                <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full"
                    style={{background: `radial-gradient(circle at 35% 35%, ${SK.brassLight}, ${SK.brassDark})`, boxShadow: "0 1px 2px rgba(0,0,0,0.9)"}} />
                {/* İçerik */}
                <div className="flex-1 min-h-0 mx-5 mt-5 mb-2 flex flex-col" style={inset()}>
                    {/* Notepad çizgileri */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(200,146,42,0.08) 23px, rgba(200,146,42,0.08) 24px)",
                        marginTop: 4,
                    }} />
                    {p.feed.length === 0
                        ? <div className="flex-1 flex items-center justify-center flex-col gap-2 opacity-30">
                            <div className="text-[28px]" style={{color: SK.brass, fontFamily: "Oxanium"}}>AEGIS</div>
                            <div className="text-[11px] tracking-widest">{p.t.empty3}</div>
                          </div>
                        : <SkFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />
                    }
                </div>
            </div>
            <SkInput {...p} />
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2) Skeuomorphism · JOURNAL (Sohbet / Chat-first)
// Deri ciltli defter: sol dikiş şeridi, sağda sayfa, mesajlar kâğıt satırlarında.
// ══════════════════════════════════════════════════════════════════════════════
export function SkJournal(p: SkinProps) {
    return (
        <div className="h-screen w-screen flex flex-col" style={skRoot}>
            {/* Deri üst kapak */}
            <div className="drag shrink-0 flex items-center justify-between px-4 h-10"
                style={{
                    background: `linear-gradient(180deg, #3d2a14 0%, #2a1d10 100%)`,
                    borderBottom: `1px solid ${SK.brassDark}`,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
                }}>
                <div className="flex items-center gap-2">
                    {/* Spiralli defter halkası */}
                    <div className="flex gap-0.5">
                        {[...Array(5)].map((_,i) => (
                            <div key={i} className="w-1.5 h-4 rounded-full"
                                style={{background: `radial-gradient(circle at 40% 30%, ${SK.brassLight}, ${SK.brassDark})`, boxShadow: "0 1px 2px rgba(0,0,0,0.8)"}} />
                        ))}
                    </div>
                    <span className="text-[11px] font-semibold tracking-[0.25em]" style={{color: SK.brassLight}}>JOURNAL</span>
                </div>
                <div className="no-drag flex gap-1.5 items-center">
                    <span className="text-[9px] tracking-widest" style={{color: SK.creamDim}}>{stWord(p.state, p.t)}</span>
                    {p.onHistoryOpen && <button onClick={p.onHistoryOpen} title={p.t.tipHistory} className="w-6 h-6 grid place-items-center text-[10px] rounded-sm" style={btn()}>H</button>}
                    <button onClick={p.onSettingsOpen} title={p.t.tipSettings} className="w-6 h-6 grid place-items-center text-[10px] rounded-sm" style={btn()}>S</button>
                    <button onClick={() => window.jarvis.minimize()} className="w-6 h-6 grid place-items-center text-[10px] rounded-sm" style={btn()}>_</button>
                    <button onClick={() => window.jarvis.close()} className="w-6 h-6 grid place-items-center text-[10px] rounded-sm"
                        style={btn({background: SK.danger, borderColor: SK.danger, color: "#fff"})}>✕</button>
                </div>
            </div>
            {/* Sayfa gövdesi */}
            <div className="flex-1 min-h-0 flex">
                {/* Dikiş şeridi */}
                <div className="shrink-0 w-6 flex flex-col items-center pt-2 gap-1.5"
                    style={{background: SK.leather, borderRight: `1px solid ${SK.brassDark}`}}>
                    {[...Array(18)].map((_,i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full"
                            style={{background: SK.brassDark, boxShadow: "inset 0 1px 0 rgba(0,0,0,0.5)"}} />
                    ))}
                </div>
                {/* Sayfa içeriği */}
                <div className="flex-1 min-w-0 flex flex-col"
                    style={{
                        background: SK.bgCard,
                        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(200,146,42,0.1) 23px, rgba(200,146,42,0.1) 24px)",
                    }}>
                    {p.feed.length === 0
                        ? <div className="flex-1 flex items-center justify-center opacity-25">
                            <span className="text-[12px] tracking-widest italic">{p.t.empty3}</span>
                          </div>
                        : <SkFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />
                    }
                </div>
            </div>
            <SkInput {...p} />
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3) Skeuomorphism · WALKMAN (Kompakt / Mini)
// Retro cihaz: üstte plastik LCD ekran, altında döner düğme + butonlar.
// ══════════════════════════════════════════════════════════════════════════════
export function SkWalkman(p: SkinProps) {
    const {tel} = p;
    return (
        <div className="h-screen w-screen flex flex-col" style={{
            ...skRoot,
            background: `linear-gradient(160deg, #231710 0%, #1c1209 60%, #120d05 100%)`,
        }}>
            {/* Cihaz kabuk çerçevesi */}
            <div className="drag shrink-0 flex items-center justify-between px-3 h-9"
                style={{
                    background: `linear-gradient(180deg, #2e1e0a 0%, #1c1209 100%)`,
                    borderBottom: `1px solid ${SK.brass}`,
                    boxShadow: `0 1px 0 ${SK.brassDark}`,
                }}>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{background: SK.brass, boxShadow: `0 0 4px ${SK.brass}`}} />
                    <span className="text-[10px] font-semibold tracking-[0.3em] uppercase" style={{color: SK.brassLight}}>WALKMAN</span>
                </div>
                <div className="no-drag flex gap-1.5">
                    {p.onHistoryOpen && <button onClick={p.onHistoryOpen} title={p.t.tipHistory} className="w-5 h-5 grid place-items-center text-[9px] rounded-sm" style={btn()}>H</button>}
                    <button onClick={p.onSettingsOpen} title={p.t.tipSettings} className="w-5 h-5 grid place-items-center text-[9px] rounded-sm" style={btn()}>S</button>
                    <button onClick={() => window.jarvis.minimize()} className="w-5 h-5 grid place-items-center text-[9px] rounded-sm" style={btn()}>_</button>
                    <button onClick={() => window.jarvis.close()} className="w-5 h-5 grid place-items-center text-[9px] rounded-sm"
                        style={btn({background: SK.danger, borderColor: SK.danger, color: "#fff"})}>✕</button>
                </div>
            </div>
            {/* LCD ekran */}
            <div className="flex-1 min-h-0 mx-3 my-2 flex flex-col" style={{
                background: "#0e1a0e",
                border: `2px solid ${SK.brassDark}`,
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,146,42,0.15)",
            }}>
                {/* LCD üst status bar */}
                <div className="shrink-0 flex items-center justify-between px-2 py-1 text-[9px]"
                    style={{borderBottom: "1px solid rgba(100,200,100,0.15)", color: "#4a9a4a"}}>
                    <span>AEGIS OS</span>
                    <span>{tel?.cpu ?? 0}% CPU · {tel?.ram ?? 0}% RAM</span>
                    <span className="uppercase">{stWord(p.state, p.t)}</span>
                </div>
                {/* LCD sohbet alanı */}
                {p.feed.length === 0
                    ? <div className="flex-1 flex items-center justify-center">
                        <span className="text-[11px] opacity-40" style={{color: "#4a9a4a"}}>{p.t.empty3}</span>
                      </div>
                    : <div ref={p.feedRef} className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1.5">
                        {p.feed.map((item, idx) => {
                            const lcdc: React.CSSProperties = {color: "#4ade80", fontSize: 11, lineHeight: "1.5"};
                            const lcdUser: React.CSSProperties = {color: "#86efac", fontSize: 11};
                            if (item.kind === "error") return <div key={item.id} className="rise text-[10px]" style={{color: "#ff6666"}}>!! {p.t.errLabel}: {item.text}</div>;
                            if (item.kind === "user") return (
                                <div key={item.id} className="rise" style={lcdUser}>&gt; {item.text}</div>
                            );
                            return (
                                <div key={item.id} className="rise" style={lcdc}>
                                    {item.tools.map((tool,i) => <div key={i} className="opacity-60 text-[9px]">[{tool.status==="running"?"···":"ok"}] {tool.name}</div>)}
                                    {item.text && <div className="break-words whitespace-pre-wrap">{item.text}{p.streaming && idx===p.feed.length-1 && <span className="flick">▌</span>}</div>}
                                </div>
                            );
                        })}
                      </div>
                }
            </div>
            {/* Alt kontroller: döner düğme + butonlar */}
            <div className="shrink-0 px-3 pb-3">
                <div className="flex gap-2 items-center">
                    {/* Döner kadran dekor */}
                    <div className="shrink-0 w-10 h-10 rounded-full grid place-items-center" style={{
                        background: `radial-gradient(circle at 35% 30%, #3d2a14, #1c1209)`,
                        boxShadow: SK.bevelOut,
                        border: SK.borderBrass,
                    }}>
                        <div className="w-1.5 h-4 rounded-full" style={{background: SK.brass, opacity: 0.7}} />
                    </div>
                    <input
                        value={p.input} onChange={(e) => p.setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && p.onSend()}
                        placeholder={p.placeholder} disabled={p.streaming} autoFocus
                        className="flex-1 px-2 py-1.5 text-[12px] outline-none disabled:opacity-40"
                        style={{...inset(), color: SK.cream, caretColor: SK.brass, fontFamily: "Oxanium, monospace"}}
                    />
                    {p.state === "speaking" && (
                        <button onClick={p.onStop} className="px-2 py-1.5 text-[10px]"
                            style={btn({background: SK.danger, borderColor: SK.danger, color: "#fff"})}>{p.t.stop}</button>
                    )}
                    <button onClick={p.onSend} disabled={p.streaming || !p.input.trim()} className="px-3 py-1.5 text-[11px] uppercase tracking-wider disabled:opacity-30" style={btn()}>{p.t.send}</button>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4) Skeuomorphism · COCKPIT (Pano / Dashboard)
// Metal kontrol paneli: analog ibreli kadranlar (CPU/RAM), vidalı panel,
// cam ekran sohbet alanı, pirinç etiketler.
// ══════════════════════════════════════════════════════════════════════════════

function Gauge({label, value, max = 100, color = SK.brass}: {label: string; value: number; max?: number; color?: string}) {
    const pct = Math.min(value / max, 1);
    // 0% = -135deg, 100% = +135deg (270deg toplam açı)
    const deg = -135 + pct * 270;
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-14 h-14">
                {/* Kadran arka plan */}
                <div className="absolute inset-0 rounded-full" style={{
                    background: `radial-gradient(circle at 40% 35%, #2e1e0a, #0e0906)`,
                    border: `2px solid ${SK.brassDark}`,
                    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.8), 0 1px 0 rgba(232,184,75,0.2)",
                }} />
                {/* Derecelendirme yayı */}
                <svg className="absolute inset-0" width="56" height="56" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(200,146,42,0.15)" strokeWidth="3" strokeDasharray="103 138" strokeDashoffset="-17" strokeLinecap="round" />
                    <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="3"
                        strokeDasharray={`${pct*103} 138`} strokeDashoffset="-17" strokeLinecap="round"
                        style={{transition: "stroke-dasharray 0.6s ease"}} opacity="0.8" />
                </svg>
                {/* İbre */}
                <div className="absolute inset-0 flex items-center justify-center" style={{transform: `rotate(${deg}deg)`}}>
                    <div style={{
                        width: 2, height: 18, marginBottom: 18,
                        background: `linear-gradient(to top, ${color}, rgba(232,184,75,0.3))`,
                        borderRadius: 2,
                        transformOrigin: "bottom center",
                        boxShadow: `0 0 4px ${color}40`,
                    }} />
                </div>
                {/* Merkez vida */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full" style={{background: `radial-gradient(circle at 35% 35%, ${SK.brassLight}, ${SK.brassDark})`, boxShadow: "0 1px 2px rgba(0,0,0,0.8)"}} />
                </div>
            </div>
            <span className="text-[8px] font-semibold tracking-[0.2em] uppercase" style={{color: SK.creamDim}}>{label}</span>
            <span className="text-[11px] font-semibold tabular-nums" style={{color}}>{value}<span className="text-[8px]">%</span></span>
        </div>
    );
}

export function SkCockpit(p: SkinProps) {
    const {tel, weather} = p;
    const [clock, setClock] = useState(new Date());
    useEffect(() => { const i = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(i); }, []);

    return (
        <div className="h-screen w-screen flex flex-col" style={{
            ...skRoot,
            backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 28px)",
        }}>
            <SkBar label="COCKPIT" t={p.t} state={p.state} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} />

            {/* Kadranlar paneli */}
            <div className="shrink-0 mx-3 mb-2" style={{...panel(), padding: "10px 16px"}}>
                {/* Vida delikleri üst köşe */}
                <div className="flex items-center justify-between">
                    <div className="flex gap-6 items-end">
                        <Gauge label="CPU" value={tel?.cpu ?? 0} color={SK.brass} />
                        <Gauge label="RAM" value={tel?.ram ?? 0} color="#7ab8e8" />
                        {(tel?.gpu ?? []).length > 0
                            ? <Gauge label="GPU" value={tel!.gpu[0].load} color="#9b7ae8" />
                            : <Gauge label="DSK" value={tel?.disk ?? 0} color="#7ae8a0" />
                        }
                    </div>
                    {/* Sağ: saat + hava + sıcaklık */}
                    <div className="flex flex-col items-end gap-1.5 text-right">
                        <div className="text-[20px] font-semibold tabular-nums" style={{color: SK.brassLight, fontFamily: "Oxanium, monospace"}}>
                            {clock.toLocaleTimeString(p.t.locale, {hour:"2-digit", minute:"2-digit"})}
                        </div>
                        {weather && !weather.error && (
                            <div className="text-[11px]" style={{color: SK.creamDim}}>{p.t.wx} {weather.temp}°</div>
                        )}
                        {tel?.cpuTemp != null && (
                            <div className="text-[10px]" style={{color: SK.creamDim}}>TMP {tel.cpuTemp}°C</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Cam ekran — sohbet */}
            <div className="flex-1 min-h-0 mx-3 mb-1 flex flex-col" style={{
                background: "#0a120a",
                border: `1px solid ${SK.brassDark}`,
                boxShadow: "inset 0 2px 10px rgba(0,0,0,0.9), inset 0 0 30px rgba(0,0,0,0.5)",
            }}>
                <div className="shrink-0 px-3 py-1 flex items-center gap-2" style={{borderBottom: `1px solid rgba(200,146,42,0.15)`}}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{background: SK.brass}} />
                    <span className="text-[9px] tracking-widest uppercase" style={{color: SK.creamDim}}>{p.t.conversation}</span>
                </div>
                {p.feed.length === 0
                    ? <div className="flex-1 flex items-center justify-center opacity-20">
                        <span className="text-[11px] tracking-widest">{p.t.empty3}</span>
                      </div>
                    : <SkFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />
                }
            </div>

            <SkInput {...p} />
        </div>
    );
}

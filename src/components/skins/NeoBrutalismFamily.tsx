// AEGIS — "Neo-brutalism" skin ailesi (4 ferdi: Poster / Stack / Switch / Grid)
// =============================================================================
// Tasarım dili: KOYU TEMA. Siyah zemin (#0d0d0d), beyaz kalın çerçeve,
// elektrik vurgu rengi, sert ofset drop-shadow (4px 4px 0 #fff / renkli),
// düz renk (gradyan yok), dev/kalın tipografi. Syne / Space Grotesk.

import React, {useState, useEffect} from "react";
import type {SkinProps} from "./HologramSkin";
import type {VoiceMode} from "../../hooks/useVoice";
import VoiceModeToggle from "../VoiceModeToggle";

// ─── Aile renk sabitleri (kullanıcı accent'inden bağımsız) ───────────────────
const NB = {
    bg:       "#0d0d0d",   // neredeyse siyah
    bgCard:   "#181818",   // kart zemini
    ink:      "#f0ede6",   // krem beyaz metin
    border:   "#f0ede6",   // beyaz çerçeve
    accent:   "#3b82f6",   // elektrik mavi
    accentAlt:"#f59e0b",   // sarı vurgu (ikincil)
    shadow:   "4px 4px 0 #f0ede6",
    shadowSm: "2px 2px 0 #f0ede6",
    danger:   "#ef4444",
};

const nbRoot: React.CSSProperties = {
    background: NB.bg,
    color: NB.ink,
    fontFamily: "'Space Grotesk', 'Syne', sans-serif",
    WebkitFontSmoothing: "antialiased",
};

// Kalın ofset kart stili
const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    border: `2px solid ${NB.border}`,
    boxShadow: NB.shadow,
    background: NB.bgCard,
    ...extra,
});

const cardSm = (extra?: React.CSSProperties): React.CSSProperties => ({
    border: `2px solid ${NB.border}`,
    boxShadow: NB.shadowSm,
    background: NB.bgCard,
    ...extra,
});

const stWord = (state: string, t: SkinProps["t"]) =>
    state === "thinking" ? t.stProc
    : state === "speaking" ? t.stResp
    : state === "listening" ? t.stListen
    : state === "error" ? t.stErr
    : t.stReady;

// ─── Ortak: feed ─────────────────────────────────────────────────────────────
function NbFeed({feed, streaming, t, feedRef, compact}: Pick<SkinProps, "feed"|"streaming"|"t"|"feedRef"> & {compact?: boolean}) {
    const gap = compact ? "gap-2" : "gap-3";
    const px  = compact ? "px-3 py-2" : "px-4 py-3";
    return (
        <div ref={feedRef} className={`flex-1 min-h-0 overflow-y-auto p-3 flex flex-col ${gap}`}>
            {feed.map((item, idx) => {
                if (item.kind === "error") return (
                    <div key={item.id} className={`rise ${px} text-[13px]`}
                        style={{...card({background: "#fef2f2"}), borderColor: NB.danger, boxShadow: `2px 2px 0 ${NB.danger}`}}>
                        <span className="text-[10px] font-black tracking-[0.2em] block mb-1" style={{color: NB.danger}}>{t.errLabel}</span>
                        <span className="break-words" style={{color: NB.danger}}>{item.text}</span>
                    </div>
                );
                if (item.kind === "user") return (
                    <div key={item.id} className={`rise ${px} text-[13px] self-end max-w-[82%]`}
                        style={card({background: NB.accent, borderColor: NB.border, boxShadow: NB.shadowSm, color: "#fff"})}>
                        {item.text}
                    </div>
                );
                return (
                    <div key={item.id} className={`rise ${px} text-[13px]`} style={card()}>
                        {item.tools.length > 0 && item.tools.map((tool, i) => (
                            <div key={i} className="text-[10px] font-bold mb-1 uppercase tracking-wider"
                                style={{color: tool.status === "running" ? NB.accentAlt : NB.ink, opacity: 0.6}}>
                                [{tool.status === "running" ? "···" : "✓"}] {tool.name.replace(/_/g, " ")}
                            </div>
                        ))}
                        {item.text && (
                            <div className="leading-relaxed break-words whitespace-pre-wrap" style={{color: NB.ink}}>
                                {item.text}
                                {streaming && idx === feed.length - 1 && (
                                    <span className="inline-block w-[0.55em] h-[1em] ml-0.5 align-middle flick" style={{background: NB.ink}} />
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
function NbInput({input, setInput, attachments, setAttachments, state, streaming, placeholder, onSend, onStop, onNavigateHistory, mode, setMode, listening, activated, t}: Pick<SkinProps,
    "input"|"setInput"|"attachments"|"setAttachments"|"state"|"streaming"|"placeholder"|"onSend"|"onStop"|"onNavigateHistory"|"mode"|"setMode"|"listening"|"activated"|"t">) {
    return (
        <div className="shrink-0 p-3 pt-2">
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold"
                            style={cardSm({background: NB.accentAlt})}>
                            <span className="max-w-[90px] truncate">{att.name}</span>
                            <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="ml-1 opacity-70 hover:opacity-100">✕</button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-2 items-stretch">
                <input
                    value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { onSend(); return; } if (e.key === "ArrowUp") { e.preventDefault(); onNavigateHistory?.("up"); } if (e.key === "ArrowDown") { e.preventDefault(); onNavigateHistory?.("down"); } }}
                    placeholder={placeholder} disabled={streaming} autoFocus
                    className="flex-1 px-3 py-2.5 text-[14px] font-semibold disabled:opacity-40 outline-none"
                    style={{...card(), caretColor: NB.accent, color: NB.ink, background: NB.bgCard}}
                />
                <label className="cursor-pointer px-3 grid place-items-center text-[12px] font-black" title={t.attachFile} style={cardSm()}>
                    +
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
                <div className="grid place-items-center" style={cardSm({padding: "0 10px"})}>
                    <VoiceModeToggle mode={mode} listening={listening} activated={activated} t={t} onToggle={() => {
                        const next: VoiceMode = mode === "off" ? "always-on" : mode === "always-on" ? "wake-word" : "off";
                        setMode(next);
                    }} />
                </div>
                {state === "speaking" && (
                    <button onClick={onStop} className="px-3 text-[11px] font-black uppercase"
                        style={{...cardSm(), background: NB.danger, color: "#fff", borderColor: NB.danger, boxShadow: `2px 2px 0 #000`}}>{t.stop}</button>
                )}
                <button onClick={onSend} disabled={streaming || (!input.trim() && attachments.length === 0)}
                    className="px-4 text-[13px] font-black uppercase disabled:opacity-30"
                    style={{...cardSm(), background: NB.accent, color: "#fff", borderColor: NB.border}}>
                    {t.send}
                </button>
            </div>
        </div>
    );
}

// ─── Ortak: başlık çubuğu ─────────────────────────────────────────────────────
function NbBar({label, sub, t, state, onSettingsOpen, onHistoryOpen}: {
    label: string; sub?: string; t: SkinProps["t"]; state: string;
    onSettingsOpen: () => void; onHistoryOpen?: () => void;
}) {
    return (
        <div className="drag shrink-0 flex items-center justify-between px-4 h-12"
            style={{borderBottom: `2px solid ${NB.border}`, background: NB.bg}}>
            <div className="flex items-baseline gap-2">
                <span className="text-[15px] font-black uppercase tracking-tight">{label}</span>
                {sub && <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{sub}</span>}
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] px-1.5 py-0.5"
                    style={{border: `1.5px solid ${NB.border}`, boxShadow: "1px 1px 0 #000"}}>{stWord(state, t)}</span>
                <div className="no-drag flex gap-1.5 ml-1">
                    {onHistoryOpen && (
                        <button onClick={onHistoryOpen} title={t.tipHistory}
                            className="w-7 h-7 grid place-items-center font-black text-[12px]"
                            style={cardSm({background: NB.bg})}>H</button>
                    )}
                    <button onClick={onSettingsOpen} title={t.tipSettings}
                        className="w-7 h-7 grid place-items-center font-black text-[12px]"
                        style={cardSm({background: NB.bg})}>S</button>
                    <button onClick={() => window.jarvis.minimize()} title={t.tipMinimize}
                        className="w-7 h-7 grid place-items-center font-black text-[12px]"
                        style={cardSm({background: NB.bg})}>_</button>
                    <button onClick={() => window.jarvis.close()} title={t.tipClose}
                        className="w-7 h-7 grid place-items-center font-black text-[11px]"
                        style={cardSm({background: NB.danger, color: "#fff", borderColor: NB.danger, boxShadow: "2px 2px 0 #000"})}>✕</button>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1) Neo-brutalism · POSTER (İmza / Hero)
// Dev tipografik afiş üstte, sohbet aşağıda kalın kartlarla.
// ══════════════════════════════════════════════════════════════════════════════
export function NbPoster(p: SkinProps) {
    return (
        <div className="h-screen w-screen flex flex-col" style={nbRoot}>
            {/* Drag başlık + büyük durum şeridi */}
            <div className="drag shrink-0" style={{borderBottom: `3px solid ${NB.border}`}}>
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <div>
                        <div className="text-[22px] font-black uppercase tracking-tight leading-none">AEGIS</div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-40 mt-0.5">POSTER · AI ASISTAN</div>
                    </div>
                    <div className="no-drag flex gap-1.5">
                        {p.onHistoryOpen && (
                            <button onClick={p.onHistoryOpen} title={p.t.tipHistory} className="w-7 h-7 grid place-items-center font-black text-[12px]" style={cardSm({background: NB.bg})}>H</button>
                        )}
                        <button onClick={p.onSettingsOpen} title={p.t.tipSettings} className="w-7 h-7 grid place-items-center font-black text-[12px]" style={cardSm({background: NB.bg})}>S</button>
                        <button onClick={() => window.jarvis.minimize()} title={p.t.tipMinimize} className="w-7 h-7 grid place-items-center font-black text-[12px]" style={cardSm({background: NB.bg})}>_</button>
                        <button onClick={() => window.jarvis.close()} title={p.t.tipClose} className="w-7 h-7 grid place-items-center font-black text-[11px]"
                            style={cardSm({background: NB.danger, color: "#fff", borderColor: NB.danger, boxShadow: "2px 2px 0 #000"})}>✕</button>
                    </div>
                </div>
                {/* Durum şeridi — renk şeridi */}
                <div className="px-4 pb-3 flex items-center gap-3">
                    <div className="h-6 w-2" style={{background: NB.accent, border: `1.5px solid ${NB.border}`}} />
                    <span className="text-[28px] font-black uppercase leading-none tracking-tighter"
                        style={{color: p.state === "error" ? NB.danger : p.state === "thinking" ? NB.accentAlt : NB.ink}}>
                        {stWord(p.state, p.t)}
                    </span>
                </div>
            </div>
            {/* Feed */}
            {p.feed.length === 0
                ? <div className="flex-1 flex flex-col items-start justify-center px-6 gap-2">
                    <div className="text-[32px] font-black uppercase leading-none" style={{color: NB.ink, opacity: 0.08}}>{p.t.empty1}</div>
                    <div className="text-[13px] font-semibold opacity-40">{p.t.empty3}</div>
                  </div>
                : <NbFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />
            }
            <NbInput {...p} />
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2) Neo-brutalism · STACK (Sohbet / Chat-first)
// Her mesaj ofset-gölgeli sticker kart; kullanıcı mavi, asistan krem.
// ══════════════════════════════════════════════════════════════════════════════
export function NbStack(p: SkinProps) {
    return (
        <div className="h-screen w-screen flex flex-col" style={nbRoot}>
            <NbBar label="STACK" sub="SOHBET" t={p.t} state={p.state} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} />
            {p.feed.length === 0
                ? <div className="flex-1 flex items-center justify-center">
                    <div className="px-6 py-4 text-[13px] font-bold opacity-30 uppercase tracking-wider" style={card()}>{p.t.empty3}</div>
                  </div>
                : <NbFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />
            }
            <NbInput {...p} />
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3) Neo-brutalism · SWITCH (Kompakt / Mini)
// Ham kontrol paneli: solda durum çubuk, sağda sıkıştırılmış sohbet + input.
// ══════════════════════════════════════════════════════════════════════════════
export function NbSwitch(p: SkinProps) {
    const {tel} = p;
    return (
        <div className="h-screen w-screen flex" style={nbRoot}>
            {/* Sol sidebar — durum + telemetri */}
            <aside className="shrink-0 w-20 flex flex-col" style={{borderRight: `2px solid ${NB.border}`, background: "#1a1a1a", color: NB.ink}}>
                <div className="drag h-10 flex items-center justify-center" style={{borderBottom: `2px solid ${NB.border}`}}>
                    <span className="text-[11px] font-black uppercase tracking-widest" style={{writingMode: "vertical-rl", transform: "rotate(180deg)"}}>AEGIS</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-3 text-[10px] font-bold">
                    <div className="text-center">
                        <div className="opacity-50 text-[8px] tracking-widest">CPU</div>
                        <div className="text-[14px]">{tel?.cpu ?? 0}<span className="text-[8px]">%</span></div>
                    </div>
                    <div className="text-center">
                        <div className="opacity-50 text-[8px] tracking-widest">RAM</div>
                        <div className="text-[14px]">{tel?.ram ?? 0}<span className="text-[8px]">%</span></div>
                    </div>
                    {(tel?.gpu ?? []).length > 0 && (
                        <div className="text-center">
                            <div className="opacity-50 text-[8px] tracking-widest">GPU</div>
                            <div className="text-[14px]">{tel!.gpu[0].load}<span className="text-[8px]">%</span></div>
                        </div>
                    )}
                </div>
                <div className="no-drag p-2 flex flex-col gap-1.5">
                    {p.onHistoryOpen && (
                        <button onClick={p.onHistoryOpen} title={p.t.tipHistory}
                            className="w-full h-7 grid place-items-center text-[11px] font-black"
                            style={{border: `2px solid ${NB.border}`, background: "transparent", color: NB.ink, boxShadow: `2px 2px 0 ${NB.border}`}}>H</button>
                    )}
                    <button onClick={p.onSettingsOpen} title={p.t.tipSettings}
                        className="w-full h-7 grid place-items-center text-[11px] font-black"
                        style={{border: `2px solid ${NB.border}`, background: "transparent", color: NB.ink, boxShadow: `2px 2px 0 ${NB.border}`}}>S</button>
                    <button onClick={() => window.jarvis.minimize()}
                        className="w-full h-7 grid place-items-center text-[11px] font-black"
                        style={{border: `2px solid ${NB.border}`, background: "transparent", color: NB.ink, boxShadow: `2px 2px 0 ${NB.border}`}}>_</button>
                    <button onClick={() => window.jarvis.close()}
                        className="w-full h-7 grid place-items-center text-[11px] font-black"
                        style={{border: `2px solid ${NB.danger}`, background: NB.danger, color: "#fff", boxShadow: "2px 2px 0 #000"}}>✕</button>
                </div>
            </aside>
            {/* Sağ: sohbet + input */}
            <div className="flex-1 min-w-0 flex flex-col">
                {p.feed.length === 0
                    ? <div className="flex-1 flex items-center justify-center">
                        <span className="text-[11px] font-bold uppercase opacity-30">{p.t.empty3}</span>
                      </div>
                    : <NbFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} compact />
                }
                <NbInput {...p} />
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4) Neo-brutalism · GRID (Pano / Dashboard)
// Üstte telemetri ızgarası (hücreler farklı vurgu rengi), altta sohbet + input.
// ══════════════════════════════════════════════════════════════════════════════
export function NbGrid(p: SkinProps) {
    const {tel, weather} = p;
    const [clock, setClock] = useState(new Date());
    useEffect(() => { const i = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(i); }, []);

    const cells: {k: string; v: string; color: string}[] = [
        {k: "CPU",  v: `${tel?.cpu ?? 0}%`,  color: NB.accent},
        {k: "RAM",  v: `${tel?.ram ?? 0}%`,  color: NB.accentAlt},
        {k: "DSK",  v: `${tel?.disk ?? 0}%`, color: "#7c3aed"},
        {k: "TIME", v: clock.toLocaleTimeString(p.t.locale, {hour: "2-digit", minute: "2-digit"}), color: "#059669"},
    ];
    if ((tel?.gpu ?? []).length > 0) cells[2] = {k: "GPU", v: `${tel!.gpu[0].load}%`, color: "#7c3aed"};
    if (weather && !weather.error) cells[3] = {k: p.t.wx, v: `${weather.temp}°`, color: "#0891b2"};

    return (
        <div className="h-screen w-screen flex flex-col" style={nbRoot}>
            <NbBar label="GRID" sub="PANO" t={p.t} state={p.state} onSettingsOpen={p.onSettingsOpen} onHistoryOpen={p.onHistoryOpen} />
            {/* Telemetri ızgarası */}
            <div className="shrink-0 grid grid-cols-4 gap-0" style={{borderBottom: `2px solid ${NB.border}`}}>
                {cells.map((c) => (
                    <div key={c.k} className="px-3 py-2.5" style={{
                        borderRight: `2px solid ${NB.border}`,
                        background: NB.bg,
                    }}>
                        <div className="text-[8px] font-black uppercase tracking-[0.3em] opacity-50">{c.k}</div>
                        <div className="text-[22px] font-black leading-none mt-0.5 tabular-nums" style={{color: c.color, textShadow: "none"}}>{c.v}</div>
                    </div>
                ))}
            </div>
            {/* Sohbet */}
            {p.feed.length === 0
                ? <div className="flex-1 flex items-center justify-center">
                    <div className="text-[11px] font-bold uppercase opacity-30">{p.t.emptyDash}</div>
                  </div>
                : <NbFeed feed={p.feed} streaming={p.streaming} t={p.t} feedRef={p.feedRef} />
            }
            <NbInput {...p} />
        </div>
    );
}

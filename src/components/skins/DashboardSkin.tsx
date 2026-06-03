import React, {useState, useEffect} from "react";
import type {SkinProps} from "./HologramSkin";
import type {VoiceMode} from "../../hooks/useVoice";
import VoiceModeToggle from "../VoiceModeToggle";

const TOOL_VERB: Record<string, string> = {
    run_command: "EXEC",
    read_file: "READ",
    write_file: "WRITE",
    list_directory: "LS",
    web_search: "SEARCH",
};

function parseSearchSource(detail?: string): string | null {
    if (!detail) return null;
    const m = detail.match(/^\[([^\]]+)\]/);
    return m ? m[1] : null;
}

const fmtRate = (bps?: number) => {
    if (bps == null) return "—";
    if (bps > 1048576) return `${(bps / 1048576).toFixed(1)} MB/s`;
    return `${Math.round(bps / 1024)} KB/s`;
};

function Bar({value, warn, danger}: {value: number; warn?: number; danger?: number}) {
    const color =
        danger != null && value >= danger ? "rgb(var(--status-danger))"
        : warn != null && value >= warn ? "rgb(var(--status-warn))"
        : "rgb(var(--hud))";
    return (
        <div className="h-1.5 rounded-full overflow-hidden w-full" style={{background: "rgba(var(--hud),0.12)"}}>
            <div className="h-full rounded-full transition-[width] duration-700" style={{width: `${Math.min(value, 100)}%`, background: color}} />
        </div>
    );
}

function Widget({title, children, className = ""}: {title: string; children: React.ReactNode; className?: string}) {
    return (
        <div
            className={`rounded-xl p-3 flex flex-col gap-2 ${className}`}
            style={{background: "rgba(var(--hud),0.04)", border: "1px solid rgba(var(--hud),0.12)"}}
        >
            <div className="text-[9px] tracking-[0.35em] opacity-50" style={{color: "rgb(var(--hud))"}}>{title}</div>
            {children}
        </div>
    );
}

export default function DashboardSkin({
    feed, input, setInput, attachments, setAttachments, state, streaming, tel, weather,
    mode, setMode, listening, activated, placeholder, t,
    onSend, onStop, onSettingsOpen, feedRef, inputRef,
}: SkinProps) {
    const [clock, setClock] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    const lastMsg = feed.filter((f) => f.kind === "assistant").at(-1);
    const statusColor =
        state === "error" ? "rgb(var(--status-danger))"
        : state === "thinking" ? "rgb(var(--status-warn))"
        : state === "speaking" ? "rgb(var(--hud))"
        : "rgb(var(--status-ok))";

    return (
        <div
            className="h-screen w-screen flex flex-col"
            style={{
                background: "var(--bg)",
                color: "rgb(var(--hud))",
                fontFamily: "var(--ui-font)",
                WebkitFontSmoothing: "antialiased",
            } as React.CSSProperties}
        >
            {/* Title bar */}
            <div className="drag shrink-0 h-10 flex items-center justify-between px-5" style={{borderBottom: "1px solid rgba(var(--hud),0.08)"}}>
                <div className="flex items-center gap-3">
                    <span className="text-[11px] tracking-[0.45em]" style={{fontFamily: "Orbitron, sans-serif", color: "rgb(var(--hud))", opacity: 0.7}}>AEGIS · DASHBOARD</span>
                </div>
                <div className="text-[12px] tabular-nums opacity-60" style={{fontFamily: "Orbitron, sans-serif"}}>
                    {clock.toLocaleTimeString(t.locale, {hour: "2-digit", minute: "2-digit", second: "2-digit"})}
                </div>
                <div className="no-drag flex gap-1">
                    <button onClick={onSettingsOpen} className="w-8 h-8 grid place-items-center opacity-40 hover:opacity-100 transition text-sm" style={{color: "rgb(var(--hud))"}}>⚙</button>
                    <button onClick={() => window.jarvis.minimize()} className="w-8 h-8 grid place-items-center opacity-40 hover:opacity-100 transition" style={{color: "rgb(var(--hud))"}}>─</button>
                    <button onClick={() => window.jarvis.close()} className="w-8 h-8 grid place-items-center opacity-40 hover:opacity-80 transition" style={{color: "rgb(var(--hud))"}}>✕</button>
                </div>
            </div>

            {/* Widgets row */}
            <div className="shrink-0 grid grid-cols-6 gap-3 px-5 pt-4 pb-2">
                {/* Status */}
                <Widget title="STATUS">
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${state === "idle" || state === "listening" ? "" : "flick"}`} style={{background: statusColor}} />
                        <span className="text-[11px]" style={{color: statusColor}}>
                            {state === "thinking" ? "PROC" : state === "speaking" ? "RESP" : state === "listening" ? "LISTEN" : state === "error" ? "ERR" : "IDLE"}
                        </span>
                    </div>
                </Widget>

                {/* CPU */}
                <Widget title="CPU">
                    <div className="text-[15px] tabular-nums" style={{fontFamily: "Orbitron, sans-serif"}}>{tel?.cpu ?? 0}<span className="text-[10px] opacity-50">%</span></div>
                    <Bar value={tel?.cpu ?? 0} warn={70} danger={90} />
                    {tel?.cpuTemp != null && <div className="text-[10px] opacity-50">{tel.cpuTemp}°C</div>}
                </Widget>

                {/* RAM */}
                <Widget title="RAM">
                    <div className="text-[15px] tabular-nums" style={{fontFamily: "Orbitron, sans-serif"}}>{tel?.ram ?? 0}<span className="text-[10px] opacity-50">%</span></div>
                    <Bar value={tel?.ram ?? 0} warn={75} danger={88} />
                </Widget>

                {/* GPU */}
                <Widget title={(tel?.gpu ?? []).length > 0 ? "GPU" : "DISK"}>
                    {(tel?.gpu ?? []).length > 0 ? (
                        <>
                            <div className="text-[15px] tabular-nums" style={{fontFamily: "Orbitron, sans-serif"}}>{tel!.gpu[0].load}<span className="text-[10px] opacity-50">%</span></div>
                            <Bar value={tel!.gpu[0].load} warn={70} danger={90} />
                            {tel!.gpu[0].temp != null && <div className="text-[10px] opacity-50">{tel!.gpu[0].temp}°C</div>}
                        </>
                    ) : (
                        <>
                            <div className="text-[15px] tabular-nums" style={{fontFamily: "Orbitron, sans-serif"}}>{tel?.disk ?? 0}<span className="text-[10px] opacity-50">%</span></div>
                            <Bar value={tel?.disk ?? 0} warn={70} danger={90} />
                        </>
                    )}
                </Widget>

                {/* Network */}
                <Widget title="NET">
                    <div className="text-[11px] space-y-1 opacity-80">
                        <div>▲ {fmtRate(tel?.netUp)}</div>
                        <div>▼ {fmtRate(tel?.netDown)}</div>
                    </div>
                </Widget>

                {/* Weather */}
                <Widget title="WEATHER">
                    {weather && !weather.error ? (
                        <div>
                            <div className="text-[15px] tabular-nums" style={{fontFamily: "Orbitron, sans-serif"}}>{weather.temp}°<span className="text-[10px] opacity-50">C</span></div>
                            <div className="text-[10px] opacity-50 truncate">{weather.desc}</div>
                        </div>
                    ) : (
                        <div className="text-[10px] opacity-30">—</div>
                    )}
                </Widget>
            </div>

            {/* Main: Feed + Conversation */}
            <div className="flex-1 min-h-0 flex gap-3 px-5 pb-2">
                {/* Full feed */}
                <div
                    ref={feedRef}
                    className="flex-1 min-w-0 overflow-y-auto rounded-xl p-4 space-y-3"
                    style={{background: "rgba(var(--hud),0.02)", border: "1px solid rgba(var(--hud),0.1)"}}
                >
                    {feed.length === 0 && (
                        <div className="text-[12px] opacity-30">{t.emptyDash}</div>
                    )}
                    {feed.map((item) =>
                        item.kind === "error" ? (
                            <div key={item.id} className="rise rounded-lg border overflow-hidden" style={{borderColor: "rgba(248,113,113,0.45)", background: "rgba(248,113,113,0.07)"}}>
                                <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-[0.25em]" style={{background: "rgba(248,113,113,0.12)", color: "rgb(248,113,113)", borderBottom: "1px solid rgba(248,113,113,0.25)"}}>
                                    <span className="text-[12px]">⊘</span><span>{t.errLabel}</span>
                                </div>
                                <p className="px-3 py-2.5 text-[12px] leading-relaxed whitespace-pre-wrap break-words" style={{color: "rgb(252,180,180)"}}>{item.text}</p>
                            </div>
                        ) : item.kind === "user" ? (
                            <div key={item.id} className="rise flex justify-end">
                                <div className="max-w-[75%] px-3 py-2 rounded-lg rounded-br-sm text-[12px] leading-relaxed" style={{background: "rgba(var(--hud),0.1)", border: "1px solid rgba(var(--hud),0.2)", color: "rgb(var(--hud-soft))"}}>
                                    {item.text}
                                </div>
                            </div>
                        ) : (
                            <div key={item.id} className="rise">
                                {item.tools.map((t, i) => {
                                    const source = t.name === "web_search" && t.status === "done" ? parseSearchSource(t.detail) : null;
                                    return (
                                        <div key={i} className="flex items-center gap-2 text-[10px] mb-1" style={{color: t.status === "running" ? "rgb(var(--hud))" : "rgb(var(--status-ok))"}}>
                                            <span className={t.status === "running" ? "flick" : ""}>{t.status === "running" ? "▸" : "✓"}</span>
                                            <span>{TOOL_VERB[t.name] || t.name.toUpperCase()}</span>
                                            {source && <span className="opacity-60">· {source}</span>}
                                        </div>
                                    );
                                })}
                                {item.text && (
                                    <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-words" style={{color: "rgba(240,252,255,0.85)"}}>
                                        {item.text}
                                        {streaming && item.id === feed[feed.length - 1].id && (
                                            <span className="inline-block w-1.5 h-4 ml-0.5 align-middle flick" style={{background: "rgb(var(--hud))"}} />
                                        )}
                                    </p>
                                )}
                            </div>
                        )
                    )}
                </div>

                {/* Right: top procs */}
                {(tel?.topProcs ?? []).length > 0 && (
                    <div
                        className="shrink-0 w-40 overflow-y-auto rounded-xl p-3"
                        style={{background: "rgba(var(--hud),0.02)", border: "1px solid rgba(var(--hud),0.1)"}}
                    >
                        <div className="text-[9px] tracking-[0.35em] opacity-40 mb-2">PROCESSES</div>
                        <div className="space-y-1.5">
                            {(tel?.topProcs ?? []).map((p, i) => (
                                <div key={i} className="text-[10px] flex justify-between gap-1 opacity-60">
                                    <span className="truncate flex-1" title={p.name}>{p.name}</span>
                                    <span className="tabular-nums shrink-0">{p.ram}M</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Input bar */}
            <div className="shrink-0 px-5 pb-4">
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {attachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                                style={{background: "rgba(var(--hud),0.07)", border: "1px solid rgba(var(--hud),0.15)", color: "rgba(var(--hud-soft),0.8)"}}>
                                {att.mime.startsWith("image/") ? <img src={att.url} alt={att.name} className="w-6 h-6 object-cover rounded" /> : <span>📄</span>}
                                <span className="max-w-[80px] truncate">{att.name}</span>
                                <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="ml-0.5 opacity-50 hover:opacity-100">✕</button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border" style={{borderColor: "rgba(var(--hud),0.2)", background: "rgba(var(--hud),0.04)"}}>
                    <span style={{color: "rgba(var(--hud),0.5)"}}>›</span>
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && onSend()}
                        placeholder={placeholder}
                        disabled={streaming}
                        autoFocus
                        className="flex-1 bg-transparent outline-none text-[13px] disabled:opacity-40"
                        style={{color: "rgb(var(--hud-soft))"}}
                    />
                    <label className="cursor-pointer opacity-40 hover:opacity-80 transition text-[13px]" title={t.attachFile} style={{color: "rgb(var(--hud))"}}>
                        ⊕
                        <input type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py" className="hidden"
                            onChange={(e) => {
                                const files = Array.from(e.target.files ?? []);
                                Promise.all(files.map((f) => new Promise<{name:string;url:string;mime:string;data:string}>((res) => {
                                    const reader = new FileReader();
                                    reader.onload = () => { const r = reader.result as string; res({name: f.name, url: r, mime: f.type||"application/octet-stream", data: r.split(",")[1]??""}); };
                                    reader.readAsDataURL(f);
                                }))).then((atts) => setAttachments([...attachments, ...atts]));
                                e.target.value = "";
                            }}
                        />
                    </label>
                    {state === "speaking" && (
                        <button onClick={onStop} className="text-[10px] px-2 py-1 rounded border transition" style={{color: "rgb(var(--status-danger))", borderColor: "rgba(var(--status-danger),0.3)"}}>⏹</button>
                    )}
                    <VoiceModeToggle mode={mode} listening={listening} activated={activated} t={t} onToggle={() => {
                        const next: VoiceMode = mode === "off" ? "always-on" : mode === "always-on" ? "wake-word" : "off";
                        setMode(next);
                    }} />
                    <button onClick={onSend} disabled={streaming || (!input.trim() && attachments.length === 0)} className="px-3 py-1 rounded border text-[10px] tracking-widest disabled:opacity-30 transition hover:brightness-125" style={{fontFamily: "Orbitron, sans-serif", color: "rgb(var(--hud))", borderColor: "rgba(var(--hud),0.25)"}}>
                        SEND
                    </button>
                </div>
            </div>
        </div>
    );
}

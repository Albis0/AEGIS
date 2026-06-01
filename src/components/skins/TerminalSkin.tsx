import React, {useState, useEffect} from "react";
import type {SkinProps} from "./HologramSkin";
import type {VoiceMode} from "../../hooks/useVoice";
import VoiceModeToggle from "../VoiceModeToggle";

const TOOL_VERB: Record<string, string> = {
    run_command: "exec",
    read_file: "cat",
    write_file: "write",
    list_directory: "ls",
    web_search: "curl",
};

function parseSearchSource(detail?: string): string | null {
    if (!detail) return null;
    const m = detail.match(/^\[([^\]]+)\]/);
    return m ? m[1] : null;
}

const fmtTime = (d: Date) => d.toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit", second: "2-digit"});

export default function TerminalSkin({
    feed, input, setInput, attachments, setAttachments, state, streaming, tel,
    mode, setMode, listening, activated, placeholder,
    onSend, onStop, onSettingsOpen, feedRef, inputRef,
}: SkinProps) {
    const promptColor = state === "error" ? "rgb(var(--status-danger))" : state === "thinking" ? "rgb(var(--status-warn))" : "rgb(var(--hud))";
    const [clock, setClock] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    return (
        <div
            className="h-screen w-screen flex flex-col"
            style={{
                background: "#010408",
                color: "rgb(var(--hud))",
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: "13px",
                WebkitFontSmoothing: "antialiased",
            } as React.CSSProperties}
        >
            {/* Terminal title bar */}
            <div className="drag shrink-0 h-8 flex items-center justify-between px-4" style={{background: "rgba(var(--hud),0.06)", borderBottom: "1px solid rgba(var(--hud),0.1)"}}>
                <div className="no-drag flex gap-1.5">
                    <button onClick={() => window.jarvis.close()} className="w-3 h-3 rounded-full transition hover:brightness-125" style={{background: "rgb(var(--status-danger))"}} />
                    <button onClick={() => window.jarvis.minimize()} className="w-3 h-3 rounded-full transition hover:brightness-125" style={{background: "rgb(var(--status-warn))"}} />
                    <button onClick={() => window.jarvis.maximize()} className="w-3 h-3 rounded-full transition hover:brightness-125" style={{background: "rgb(var(--status-ok))"}} />
                </div>
                <span className="text-[11px] tracking-widest opacity-40">aegis@{tel?.host ?? "localhost"} — bash</span>
                <div className="no-drag flex gap-2">
                    <button onClick={onSettingsOpen} className="text-[10px] opacity-30 hover:opacity-70 transition px-1" style={{color: "rgb(var(--hud))"}}>⚙</button>
                </div>
            </div>

            {/* Output area */}
            <div ref={feedRef} className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-1 space-y-1">
                {/* Boot banner */}
                <div className="opacity-40 text-[11px] mb-3 space-y-0.5">
                    <div style={{color: "rgb(var(--hud))"}}>AEGIS Terminal v3.1 — {fmtTime(clock)}</div>
                    <div>Type a message or press M for voice mode.</div>
                </div>

                {feed.map((item, idx) =>
                    item.kind === "error" ? (
                        <div key={item.id} className="rise flex gap-2" style={{color: "rgb(252,180,180)"}}>
                            <span className="shrink-0" style={{color: "rgb(248,113,113)"}}>[!]</span>
                            <span className="whitespace-pre-wrap break-words">error: {item.text}</span>
                        </div>
                    ) : item.kind === "user" ? (
                        <div key={item.id} className="rise">
                            <div className="flex gap-2">
                                <span className="shrink-0" style={{color: "rgb(var(--status-ok))"}}>aegis@os</span>
                                <span className="opacity-40">:~$</span>
                                <span style={{color: "rgb(var(--hud-soft))"}}>jarvis "{item.text}"</span>
                            </div>
                        </div>
                    ) : (
                        <div key={item.id} className="rise pl-2">
                            {item.tools.map((t, i) => {
                                const source = t.name === "web_search" && t.status === "done" ? parseSearchSource(t.detail) : null;
                                return (
                                    <div key={i} className="flex gap-2 text-[11px]" style={{color: "rgba(var(--hud),0.5)"}}>
                                        <span className={t.status === "running" ? "flick" : ""}>[{t.status === "running" ? "…" : "✓"}]</span>
                                        <span>{TOOL_VERB[t.name] || t.name}</span>
                                        {source && <span>({source})</span>}
                                        {t.status === "running" && <span className="opacity-60">running…</span>}
                                    </div>
                                );
                            })}
                            {item.text && (
                                <div className="whitespace-pre-wrap break-words leading-relaxed" style={{color: "rgba(240,252,255,0.85)"}}>
                                    {item.text}
                                    {streaming && idx === feed.length - 1 && (
                                        <span className="inline-block w-[0.55em] h-[1em] ml-0.5 align-middle flick" style={{background: "rgb(var(--hud))"}} />
                                    )}
                                </div>
                            )}
                        </div>
                    )
                )}

                {/* Current prompt line when idle */}
                {!streaming && (
                    <div className="flex gap-2 mt-1">
                        <span style={{color: "rgb(var(--status-ok))"}}>aegis@os</span>
                        <span className="opacity-40">:~$</span>
                        <span className="opacity-20">_</span>
                    </div>
                )}
            </div>

            {/* Input row */}
            <div className="shrink-0 border-t px-4 py-2.5" style={{borderColor: "rgba(var(--hud),0.1)", background: "rgba(var(--hud),0.02)"}}>
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {attachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono"
                                style={{background: "rgba(var(--hud),0.07)", border: "1px solid rgba(var(--hud),0.15)", color: "rgba(var(--hud-soft),0.8)"}}>
                                {att.mime.startsWith("image/") ? <img src={att.url} alt={att.name} className="w-6 h-6 object-cover rounded" /> : <span>📄</span>}
                                <span className="max-w-[80px] truncate">{att.name}</span>
                                <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="ml-0.5 opacity-50 hover:opacity-100">✕</button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <span style={{color: promptColor}}>❯</span>
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && onSend()}
                        placeholder={placeholder}
                        disabled={streaming}
                        autoFocus
                        className="flex-1 bg-transparent outline-none text-[13px] disabled:opacity-40"
                        style={{color: "rgb(var(--hud-soft))", caretColor: "rgb(var(--hud))"}}
                    />
                    <label className="cursor-pointer opacity-40 hover:opacity-80 transition text-[12px]" title="Dosya ekle" style={{color: "rgb(var(--hud))"}}>
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
                        <button onClick={onStop} className="text-[10px] px-2 py-0.5 rounded border transition hover:brightness-125" style={{color: "rgb(var(--status-danger))", borderColor: "rgba(var(--status-danger),0.3)"}}>STOP</button>
                    )}
                    <VoiceModeToggle mode={mode} listening={listening} activated={activated} onToggle={() => {
                        const next: VoiceMode = mode === "off" ? "always-on" : mode === "always-on" ? "wake-word" : "off";
                        setMode(next);
                    }} />
                </div>
            </div>
        </div>
    );
}

import React from "react";
import {useClock} from "../../hooks/useClock";
import type {SkinProps} from "./HologramSkin";
import type {VoiceMode} from "../../hooks/useVoice";
import VoiceModeToggle from "../VoiceModeToggle";

const TOOL_VERB: Record<string, string> = {
    run_command: "shell",
    read_file: "read",
    write_file: "write",
    list_directory: "ls",
    web_search: "search",
};

function parseSearchSource(detail?: string): string | null {
    if (!detail) return null;
    const m = detail.match(/^\[([^\]]+)\]/);
    return m ? m[1] : null;
}

export default function MinimalSkin({
    feed, input, setInput, attachments, setAttachments, state, streaming,
    mode, setMode, listening, activated, placeholder, t,
    onSend, onStop, onSettingsOpen, onNavigateHistory, feedRef, inputRef,
}: SkinProps) {
    const clock = useClock();
    return (
        <div
            className="h-screen w-screen flex flex-col"
            style={{background: "var(--bg)", color: "rgb(var(--hud))", fontFamily: "var(--ui-font)", WebkitFontSmoothing: "antialiased"} as React.CSSProperties}
        >
            {/* Title bar */}
            <div className="drag shrink-0 h-9 flex items-center justify-between px-5 border-b" style={{borderColor: "rgba(var(--hud),0.08)"}}>
                <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full flick" style={{background: "rgb(var(--hud))"}} />
                    <span className="text-[11px] tracking-[0.4em]" style={{fontFamily: "Orbitron, sans-serif", opacity: 0.7}}>AEGIS</span>
                    <span className="text-[10px] opacity-30 ml-1">
                        {clock.toLocaleTimeString(t.locale, {hour: "2-digit", minute: "2-digit"})}
                    </span>
                </div>
                <div className="no-drag flex items-center gap-1">
                    <span className="text-[10px] mr-2 opacity-40" style={{color: "rgb(var(--hud))"}}>
                        {state === "thinking" ? "thinking…" : state === "speaking" ? "speaking…" : state === "listening" ? "listening…" : state === "error" ? "error" : ""}
                    </span>
                    <button onClick={onSettingsOpen} className="w-7 h-7 grid place-items-center opacity-30 hover:opacity-80 transition text-sm" style={{color: "rgb(var(--hud))"}}>⚙</button>
                    <button onClick={() => window.jarvis.minimize()} className="w-7 h-7 grid place-items-center opacity-30 hover:opacity-80 transition" style={{color: "rgb(var(--hud))"}}>─</button>
                    <button onClick={() => window.jarvis.close()} className="w-7 h-7 grid place-items-center opacity-30 hover:opacity-80 transition" style={{color: "rgb(var(--hud))"}}>✕</button>
                </div>
            </div>

            {/* Feed */}
            <div ref={feedRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
                {feed.length === 0 && (
                    <div className="text-[12px] leading-relaxed" style={{color: "rgba(var(--hud),0.35)"}}>
                        Ready.
                    </div>
                )}
                {feed.map((item) =>
                    item.kind === "error" ? (
                        <div key={item.id} className="rise flex gap-3">
                            <span className="text-[11px] shrink-0 mt-0.5" style={{color: "rgb(248,113,113)"}}>⊘</span>
                            <p className="text-[13px] leading-relaxed px-2.5 py-1.5 rounded-lg" style={{color: "rgb(252,180,180)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)"}}>
                                {item.text}
                            </p>
                        </div>
                    ) : item.kind === "user" ? (
                        <div key={item.id} className="rise flex gap-3">
                            <span className="text-[11px] opacity-30 shrink-0 mt-0.5" style={{color: "rgb(var(--hud))"}}>you</span>
                            <p className="text-[13px] leading-relaxed" style={{color: "rgb(var(--hud-soft))"}}>
                                {item.text}
                            </p>
                        </div>
                    ) : (
                        <div key={item.id} className="rise flex gap-3">
                            <span className="text-[11px] opacity-30 shrink-0 mt-0.5" style={{color: "rgb(var(--hud))"}}>ai</span>
                            <div className="flex-1 min-w-0">
                                {item.tools.map((t, i) => {
                                    const source = t.name === "web_search" && t.status === "done" ? parseSearchSource(t.detail) : null;
                                    return (
                                        <div key={i} className="flex items-center gap-1.5 text-[11px] mb-1 opacity-50">
                                            <span className={t.status === "running" ? "flick" : ""}>
                                                {t.status === "running" ? "·" : "✓"}
                                            </span>
                                            <span>{TOOL_VERB[t.name] || t.name.replace(/_/g," ")}</span>
                                            {source && <span className="opacity-70">({source})</span>}
                                        </div>
                                    );
                                })}
                                {item.text && (
                                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{color: "rgba(240,250,255,0.85)"}}>
                                        {item.text}
                                        {streaming && item.id === feed[feed.length - 1].id && (
                                            <span className="inline-block w-1.5 h-[1em] ml-0.5 align-middle flick" style={{background: "rgb(var(--hud))"}} />
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                    )
                )}
            </div>

            {/* Input */}
            <div className="shrink-0 border-t px-5 py-3" style={{borderColor: "rgba(var(--hud),0.08)"}}>
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {attachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                                style={{background: "rgba(var(--hud),0.07)", border: "1px solid rgba(var(--hud),0.15)", color: "rgba(var(--hud-soft),0.8)"}}>
                                {att.mime.startsWith("image/")
                                    ? <img src={att.url} alt={att.name} className="w-6 h-6 object-cover rounded" />
                                    : <span>📄</span>}
                                <span className="max-w-[80px] truncate">{att.name}</span>
                                <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="ml-0.5 opacity-50 hover:opacity-100">✕</button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex items-center gap-3">
                    <VoiceModeToggle mode={mode} listening={listening} activated={activated} t={t} onToggle={() => {
                        const next: VoiceMode = mode === "off" ? "always-on" : mode === "always-on" ? "wake-word" : "off";
                        setMode(next);
                    }} />
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { onSend(); return; } if (e.key === "ArrowUp") { e.preventDefault(); onNavigateHistory?.("up"); } if (e.key === "ArrowDown") { e.preventDefault(); onNavigateHistory?.("down"); } }}
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
                        <button onClick={onStop} className="text-[11px] opacity-60 hover:opacity-100 transition" style={{color: "rgb(var(--status-danger))"}}>⏹</button>
                    )}
                    <button onClick={onSend} disabled={streaming || (!input.trim() && attachments.length === 0)}
                        className="text-[11px] opacity-40 hover:opacity-100 disabled:opacity-20 transition" style={{color: "rgb(var(--hud))"}}>↵</button>
                </div>
            </div>
        </div>
    );
}

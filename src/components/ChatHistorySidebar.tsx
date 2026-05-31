import React, {useCallback, useEffect, useState} from "react";

interface Session {
    id: string;
    summary: string | null;
    ended_at: string | null;
    created_at: string;
}

interface Message {
    role: string;
    content: string;
    tool_name: string | null;
    created_at: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onLoadSession: (messages: {role: string; content: string}[]) => void;
}

export default function ChatHistorySidebar({open, onClose, onLoadSession}: Props) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [msgLoading, setMsgLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        window.jarvis.sessionsList()
            .then((s) => { setSessions(s); setLoading(false); })
            .catch(() => setLoading(false));
    }, [open]);

    const handleExpand = useCallback(async (id: string) => {
        if (expanded === id) { setExpanded(null); return; }
        setExpanded(id);
        setMsgLoading(true);
        const msgs = await window.jarvis.sessionMessages(id).catch(() => []);
        setMessages(msgs);
        setMsgLoading(false);
    }, [expanded]);

    const handleExport = useCallback(() => {
        if (!expanded || messages.length === 0) return;
        const session = sessions.find((s) => s.id === expanded);
        const date = session?.created_at
            ? new Date(session.created_at).toLocaleDateString("tr-TR", {day: "2-digit", month: "short", year: "numeric"})
            : "unknown";
        const lines = messages
            .filter((m) => m.role !== "tool")
            .map((m) => `[${m.role.toUpperCase()}]\n${m.content}`)
            .join("\n\n---\n\n");
        const blob = new Blob([`# AEGIS Konuşma — ${date}\n\n${lines}`], {type: "text/markdown"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `aegis-${date.replace(/\s/g, "-").toLowerCase()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }, [expanded, messages, sessions]);

    const handleLoad = useCallback(() => {
        const conversation = messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({role: m.role, content: m.content}));
        onLoadSession(conversation);
        onClose();
    }, [messages, onLoadSession, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div
                className="relative ml-auto w-[clamp(300px,32vw,460px)] h-full flex flex-col border-l overflow-hidden"
                style={{
                    background: "rgba(4,7,13,0.97)",
                    borderColor: "rgba(var(--hud),0.25)",
                    backdropFilter: "blur(12px)",
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{borderColor: "rgba(var(--hud),0.2)"}}>
                    <span className="text-[10px] tracking-[0.3em] glow-text" style={{color: "rgb(var(--hud))"}}>GEÇMİŞ OTURUMLAR</span>
                    <button onClick={onClose} className="w-7 h-7 grid place-items-center opacity-50 hover:opacity-100 transition text-xs" style={{color: "rgb(var(--hud))"}}>✕</button>
                </div>

                {/* Session list */}
                <div className="flex-1 min-h-0 overflow-y-auto" style={{padding: "10px"}}>
                    {loading && (
                        <div className="text-[11px] opacity-40 py-4 text-center" style={{color: "rgb(var(--hud))"}}>yükleniyor…</div>
                    )}
                    {!loading && sessions.length === 0 && (
                        <div className="text-[11px] opacity-40 py-4 text-center" style={{color: "rgb(var(--hud))"}}>kayıtlı oturum yok</div>
                    )}
                    {sessions.map((s) => {
                        const date = s.created_at
                            ? new Date(s.created_at).toLocaleDateString("tr-TR", {day: "2-digit", month: "short", year: "numeric"})
                            : "?";
                        const isExp = expanded === s.id;
                        return (
                            <div
                                key={s.id}
                                className="mb-2 rounded border overflow-hidden transition-all"
                                style={{borderColor: `rgba(var(--hud),${isExp ? "0.4" : "0.15"})`}}
                            >
                                <div
                                    className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition"
                                    onClick={() => handleExpand(s.id)}
                                >
                                    <span className="text-[8px] mt-1 opacity-30" style={{color: "rgb(var(--hud))"}}>
                                        {isExp ? "▼" : "▶"}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] tracking-wider" style={{color: "rgb(var(--hud))"}}>
                                            {date}
                                        </div>
                                        {s.summary ? (
                                            <div
                                                className="text-[10.5px] mt-0.5 opacity-60 leading-relaxed"
                                                style={{color: "rgb(var(--hud))", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden"}}
                                            >
                                                {s.summary}
                                            </div>
                                        ) : (
                                            <div className="text-[9px] opacity-25 italic mt-0.5" style={{color: "rgb(var(--hud))"}}>özet yok</div>
                                        )}
                                    </div>
                                </div>

                                {isExp && (
                                    <div className="border-t" style={{borderColor: "rgba(var(--hud),0.15)"}}>
                                        <div className="flex gap-2 px-3 py-2">
                                            <button
                                                onClick={handleLoad}
                                                className="flex-1 py-1 text-[9px] tracking-wider rounded border transition hover:brightness-125"
                                                style={{color: "rgb(var(--hud))", borderColor: "rgba(var(--hud),0.3)"}}
                                            >
                                                DEVAM ET
                                            </button>
                                            <button
                                                onClick={handleExport}
                                                disabled={msgLoading}
                                                className="flex-1 py-1 text-[9px] tracking-wider rounded border transition hover:brightness-125 disabled:opacity-40"
                                                style={{color: "rgb(var(--hud))", borderColor: "rgba(var(--hud),0.3)"}}
                                            >
                                                DIŞA AKTAR
                                            </button>
                                        </div>
                                        <div className="px-3 pb-3 space-y-1.5 max-h-52 overflow-y-auto">
                                            {msgLoading && (
                                                <div className="text-[9px] opacity-30 text-center py-2" style={{color: "rgb(var(--hud))"}}>yükleniyor…</div>
                                            )}
                                            {!msgLoading && messages
                                                .filter((m) => m.role !== "tool")
                                                .map((m, i) => (
                                                    <div key={i} className={`text-[10px] leading-relaxed ${m.role === "user" ? "text-right" : ""}`}>
                                                        <span className="text-[8px] opacity-30 mr-1" style={{color: "rgb(var(--hud))"}}>
                                                            {m.role === "user" ? "SİZ" : "AEGIS"}
                                                        </span>
                                                        <span className="opacity-60 break-words" style={{color: "rgb(var(--hud))"}}>
                                                            {m.content.slice(0, 100)}{m.content.length > 100 ? "…" : ""}
                                                        </span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

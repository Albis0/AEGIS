import React from "react";

type ToolLine = {name: string; status: "running" | "done"; detail?: string};
type Attachment = {name: string; url: string; mime: string; data: string};
export type FeedItemType =
    | {id: string; kind: "user"; text: string; attachments?: Attachment[]}
    | {id: string; kind: "assistant"; text: string; tools: ToolLine[]};

const TOOL_VERB: Record<string, string> = {
    run_command: "KOMUT YÜRÜTÜLÜYOR",
    read_file: "DOSYA OKUNUYOR",
    write_file: "DOSYA YAZILIYOR",
    list_directory: "DİZİN TARANIYOR",
    web_search: "AĞ TARANIYOR",
};

function parseSearchSource(detail?: string): string | null {
    if (!detail) return null;
    const m = detail.match(/^\[([^\]]+)\]/);
    return m ? m[1] : null;
}

interface Props {
    item: FeedItemType;
    streaming: boolean;
    isLast: boolean;
}

const FeedItem = React.memo(function FeedItem({item, streaming, isLast}: Props) {
    if (item.kind === "user") {
        return (
            <div className="flex justify-end rise">
                <div className="max-w-[88%] flex flex-col gap-1.5 items-end">
                    {item.attachments && item.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 justify-end">
                            {item.attachments.map((att, i) => (
                                att.mime.startsWith("image/")
                                    ? <img key={i} src={att.url} alt={att.name}
                                        className="max-w-[220px] max-h-[160px] object-cover rounded-lg border"
                                        style={{borderColor: "rgba(var(--hud),0.25)"}} />
                                    : <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]"
                                        style={{background: "rgba(var(--hud),0.08)", border: "1px solid rgba(var(--hud),0.2)", color: "rgb(var(--hud-soft))"}}>
                                        <span style={{color: "rgba(var(--hud),0.6)"}}>📄</span>
                                        <span className="max-w-[140px] truncate">{att.name}</span>
                                    </div>
                            ))}
                        </div>
                    )}
                    {item.text && (
                        <div
                            className="px-3 py-1.5 rounded-lg rounded-br-sm text-[12.5px] leading-relaxed border break-words"
                            style={{borderColor: "rgba(var(--hud),0.35)", background: "rgba(var(--hud),0.08)", color: "rgb(var(--hud-soft))"}}
                        >
                            {item.text}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="rise">
            {item.tools.map((t, i) => {
                const source = t.name === "web_search" && t.status === "done" ? parseSearchSource(t.detail) : null;
                return (
                    <div key={i} className="flex items-center gap-2 text-[10.5px] tracking-wider mb-0.5">
                        <span
                            className={t.status === "running" ? "flick" : ""}
                            style={{color: t.status === "running" ? "rgb(var(--hud))" : "rgb(var(--status-ok))"}}
                        >
                            {t.status === "running" ? "▸" : "✓"}
                        </span>
                        <span style={{color: t.status === "running" ? "rgb(var(--hud))" : "rgb(var(--status-ok) / 0.7)"}}>
                            {TOOL_VERB[t.name] || t.name.toUpperCase()}{t.status === "running" ? "…" : ""}
                        </span>
                        {source && (
                            <span
                                className="text-[9px] px-1.5 py-0.5 rounded tracking-widest"
                                style={{background: "rgb(var(--status-ok) / 0.12)", color: "rgb(var(--status-ok))", border: "1px solid rgb(var(--status-ok) / 0.25)"}}
                            >
                                {source}
                            </span>
                        )}
                    </div>
                );
            })}
            {item.text && (
                <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-words text-cyan-50/90">
                    {item.text}
                    {streaming && isLast && (
                        <span className="inline-block w-1.5 h-4 ml-0.5 align-middle flick" style={{background: "rgb(var(--hud))"}} />
                    )}
                </p>
            )}
        </div>
    );
}, (prev, next) => {
    if (prev.item.id !== next.item.id) return false;
    if (prev.item.kind !== next.item.kind) return false;
    if (prev.item.kind === "assistant" && next.item.kind === "assistant") {
        return (
            prev.item.text === next.item.text &&
            prev.item.tools === next.item.tools &&
            prev.isLast === next.isLast &&
            prev.streaming === next.streaming
        );
    }
    return prev.item === next.item;
});

export default FeedItem;

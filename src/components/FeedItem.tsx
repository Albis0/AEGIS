import React, {useState} from "react";
import type {LangStrings} from "../i18n";
import {toolLabel} from "./skins/toolLabels";
import type {ToolLine, FeedItem as FeedItemType} from "../types/feed";
export type {FeedItemType};

function parseSearchSource(detail?: string): string | null {
    if (!detail) return null;
    const m = detail.match(/^\[([^\]]+)\]/);
    return m ? m[1] : null;
}

interface Props {
    item: FeedItemType;
    streaming: boolean;
    isLast: boolean;
    t: LangStrings;
}

function ToolRow({tool, t}: {tool: ToolLine; t: LangStrings}) {
    const [open, setOpen] = useState(false);
    const source = tool.name === "web_search" && tool.status === "done" ? parseSearchSource(tool.detail) : null;
    const hasDetail = tool.status === "done" && !!tool.detail;

    return (
        <div className="mb-0.5">
            <div
                className="flex items-center gap-2 text-[10.5px] tracking-wider"
                style={{cursor: hasDetail ? "pointer" : "default"}}
                onClick={() => hasDetail && setOpen((o) => !o)}
            >
                <span
                    className={tool.status === "running" ? "flick" : ""}
                    style={{color: tool.status === "running" ? "rgb(var(--hud))" : "rgb(var(--status-ok))"}}
                >
                    {tool.status === "running" ? "▸" : "✓"}
                </span>
                <span style={{color: tool.status === "running" ? "rgb(var(--hud))" : "rgb(var(--status-ok) / 0.7)"}}>
                    {toolLabel(tool.name, t)}{tool.status === "running" ? "…" : ""}
                </span>
                {source && (
                    <span
                        className="text-[9px] px-1.5 py-0.5 rounded tracking-widest"
                        style={{background: "rgb(var(--status-ok) / 0.12)", color: "rgb(var(--status-ok))", border: "1px solid rgb(var(--status-ok) / 0.25)"}}
                    >
                        {source}
                    </span>
                )}
                {hasDetail && (
                    <span style={{color: "rgb(var(--status-ok) / 0.4)", fontSize: "9px", marginLeft: "auto"}}>
                        {open ? "▴" : "▾"}
                    </span>
                )}
            </div>
            {open && tool.detail && (
                <div
                    className="mt-0.5 ml-4 px-2 py-1.5 rounded text-[10px] leading-relaxed whitespace-pre-wrap break-words"
                    style={{
                        background: "rgb(var(--hud) / 0.05)",
                        border: "1px solid rgb(var(--status-ok) / 0.15)",
                        color: "rgb(var(--status-ok) / 0.65)",
                        maxHeight: "160px",
                        overflowY: "auto",
                    }}
                >
                    {tool.detail}
                </div>
            )}
        </div>
    );
}

const FeedItem = React.memo(function FeedItem({item, streaming, isLast, t}: Props) {
    if (item.kind === "error") {
        return (
            <div className="rise">
                <div
                    className="rounded-lg border overflow-hidden"
                    style={{
                        borderColor: "rgba(248,113,113,0.45)",
                        background: "rgba(248,113,113,0.07)",
                    }}
                >
                    <div
                        className="flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-[0.25em]"
                        style={{
                            background: "rgba(248,113,113,0.12)",
                            color: "rgb(248,113,113)",
                            borderBottom: "1px solid rgba(248,113,113,0.25)",
                        }}
                    >
                        <span className="text-[12px]">⊘</span>
                        <span>{t.errLabel}</span>
                    </div>
                    <p className="px-3 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words"
                        style={{color: "rgb(252,180,180)"}}>
                        {item.text}
                    </p>
                </div>
            </div>
        );
    }

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
            {item.tools.map((tool, i) => (
                <ToolRow key={i} tool={tool} t={t} />
            ))}
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
    if (prev.t !== next.t) return false;
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

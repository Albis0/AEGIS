import React, {useEffect, useRef, useState} from "react";
import {EXTRA, PALETTE_COMMANDS, type Lang, type PaletteCommand} from "../i18n";

interface Props {
    open: boolean;
    onClose: () => void;
    onSelect: (text: string, direct: boolean) => void;
    lang: Lang;
}

export default function CommandPalette({open, onClose, onSelect, lang}: Props) {
    const tr = EXTRA[lang];
    const COMMANDS = PALETTE_COMMANDS[lang];
    const [query, setQuery] = useState("");
    const [cursor, setCursor] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setQuery("");
            setCursor(0);
            setTimeout(() => inputRef.current?.focus(), 40);
        }
    }, [open]);

    const filtered = query.trim()
        ? COMMANDS.filter((c) =>
            c.label.toLowerCase().includes(query.toLowerCase()) ||
            c.description.toLowerCase().includes(query.toLowerCase()))
        : COMMANDS;

    useEffect(() => { setCursor(0); }, [query]);

    if (!open) return null;

    const select = (cmd: PaletteCommand) => {
        onSelect(cmd.text, cmd.direct);
        onClose();
    };

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") { onClose(); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); return; }
        if (e.key === "Enter" && filtered[cursor]) { e.preventDefault(); select(filtered[cursor]); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div
                className="relative w-[clamp(340px,44vw,540px)] rounded-xl border overflow-hidden"
                style={{
                    background: "rgba(4,7,13,0.98)",
                    borderColor: "rgba(var(--hud),0.35)",
                    boxShadow: "0 0 40px rgba(var(--hud),0.12), 0 25px 60px rgba(0,0,0,0.85)",
                }}
                onKeyDown={handleKey}
            >
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b" style={{borderColor: "rgba(var(--hud),0.2)"}}>
                    <span className="text-xs opacity-40" style={{color: "rgb(var(--hud))"}}>⌘</span>
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={tr.palSearch}
                        className="flex-1 bg-transparent outline-none text-sm font-mono"
                        style={{color: "rgb(var(--hud-soft))", caretColor: "rgb(var(--hud))"}}
                    />
                    <kbd className="text-[9px] opacity-25 px-1.5 py-0.5 rounded border" style={{color: "rgb(var(--hud))", borderColor: "rgba(var(--hud),0.3)"}}>ESC</kbd>
                </div>

                {/* Command list */}
                <div className="max-h-[52vh] overflow-y-auto">
                    {filtered.length === 0 && (
                        <div className="px-4 py-6 text-[11px] opacity-30 text-center" style={{color: "rgb(var(--hud))"}}>{tr.palNotFound}</div>
                    )}
                    {filtered.map((cmd, i) => (
                        <div
                            key={cmd.id}
                            className="flex items-center gap-3 px-4 py-2 cursor-pointer transition"
                            style={{background: i === cursor ? "rgba(var(--hud),0.1)" : "transparent"}}
                            onMouseEnter={() => setCursor(i)}
                            onClick={() => select(cmd)}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-mono" style={{color: "rgb(var(--hud-soft))"}}>{cmd.label}</div>
                                <div className="text-[9.5px] opacity-45 truncate" style={{color: "rgb(var(--hud))"}}>{cmd.description}</div>
                            </div>
                            <span
                                className="shrink-0 text-[8px] px-1.5 py-0.5 rounded tracking-widest"
                                style={{
                                    color: cmd.direct ? "rgb(var(--status-ok))" : "rgb(var(--hud))",
                                    background: cmd.direct ? "rgb(var(--status-ok) / 0.1)" : "rgba(var(--hud),0.08)",
                                    border: `1px solid ${cmd.direct ? "rgb(var(--status-ok) / 0.25)" : "rgba(var(--hud),0.2)"}`,
                                }}
                            >
                                {cmd.direct ? tr.palInstant : tr.palEdit}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex gap-4 px-4 py-1.5 border-t text-[8.5px] opacity-30" style={{borderColor: "rgba(var(--hud),0.15)", color: "rgb(var(--hud))"}}>
                    <span>{tr.palNav}</span>
                    <span>{tr.palSelect}</span>
                    <span>{tr.palClose}</span>
                    <span className="ml-auto">{tr.palHint}</span>
                </div>
            </div>
        </div>
    );
}

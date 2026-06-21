import {useState, useEffect, useCallback, useRef} from "react";

// Phase 63.4 — Pomodoro widget.
// pomodoro_status returns "PHASE|remainingSeconds|session"; the widget counts down
// locally every second and periodically (15s) syncs with the server state. Renders
// nothing if there's no active pomodoro.

interface Pomo {
    phase: "WORK" | "BREAK";
    remaining: number; // seconds
    session: number;
}

export function parsePomo(raw: string): Pomo | null {
    if (!raw || raw.trim() === "INACTIVE") return null;
    const parts = raw.trim().split("|");
    if (parts.length < 3) return null;
    const phase = parts[0] === "BREAK" ? "BREAK" : "WORK";
    const remaining = parseInt(parts[1]);
    const session = parseInt(parts[2]);
    if (!Number.isFinite(remaining)) return null;
    return {phase, remaining, session};
}

export function fmt(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PomodoroWidget() {
    const [pomo, setPomo] = useState<Pomo | null>(null);
    const [busy, setBusy] = useState(false);
    const mounted = useRef(true);

    const sync = useCallback(async () => {
        try {
            const raw = await window.jarvis.runTool("pomodoro_status");
            if (mounted.current) setPomo(parsePomo(raw));
        } catch {
            if (mounted.current) setPomo(null);
        }
    }, []);

    // Server sync (15s) + mount
    useEffect(() => {
        mounted.current = true;
        sync();
        const id = setInterval(sync, 15000);
        return () => { mounted.current = false; clearInterval(id); };
    }, [sync]);

    // Local per-second countdown
    useEffect(() => {
        if (!pomo) return;
        const id = setInterval(() => {
            setPomo((p) => p ? {...p, remaining: Math.max(0, p.remaining - 1)} : p);
        }, 1000);
        return () => clearInterval(id);
    }, [pomo?.phase, pomo?.session]);

    const stop = async () => {
        if (busy) return;
        setBusy(true);
        try { await window.jarvis.runTool("pomodoro_stop"); setPomo(null); }
        finally { setBusy(false); }
    };

    if (!pomo) return null;

    const isWork = pomo.phase === "WORK";

    return (
        <div className="rounded-lg px-2.5 py-2 shrink-0"
            style={{border: "1px solid rgba(var(--hud),0.2)", background: "rgba(var(--hud),0.07)"}}>
            <div className="flex items-center gap-1.5 mb-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{color: "rgb(var(--hud))", flexShrink: 0}}>
                    <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6M12 5V2"/>
                </svg>
                <span className="text-[9px] tracking-[0.2em] glow-text" style={{color: "rgba(var(--hud),0.7)"}}>
                    {isWork ? "ODAKLANMA" : "MOLA"}
                </span>
                <span className="ml-auto text-[8px]" style={{color: "rgba(var(--hud),0.45)"}}>#{pomo.session}</span>
                <button onClick={stop} disabled={busy} title="Durdur"
                    className="grid place-items-center w-4 h-4 rounded transition hover:text-red-400 disabled:opacity-30" style={{color: "rgba(var(--hud),0.6)"}}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                </button>
            </div>
            <div className="text-2xl tabular-nums glow-text leading-none text-center py-0.5" style={{fontFamily: "Orbitron, sans-serif", color: "rgb(var(--hud))"}}>
                {fmt(pomo.remaining)}
            </div>
        </div>
    );
}

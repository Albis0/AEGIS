import {useEffect, useState} from "react";
import type {LangStrings} from "../i18n";

// Faz CC-3 — live plan / todo panel (Claude-Code TodoWrite parity).
// The backend `plan_todo` tool emits a "todo-update" event with the current
// steps; this panel renders them and auto-hides once every step is done (or the
// user starts a new turn, which App resets via the `reset` counter prop).

export interface TodoStep {
    text: string;
    status: "pending" | "in_progress" | "done";
}

const STATUS_COLOR: Record<TodoStep["status"], string> = {
    pending: "rgba(var(--hud),0.4)",
    in_progress: "rgb(var(--hud))",
    done: "rgba(var(--hud),0.6)",
};

function StatusIcon({status}: {status: TodoStep["status"]}) {
    if (status === "done") {
        // check-circle
        return (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/>
            </svg>
        );
    }
    if (status === "in_progress") {
        // half-filled dot (in-progress)
        return (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>
            </svg>
        );
    }
    // empty circle (pending)
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9"/>
        </svg>
    );
}

export default function TodoPanel({t, reset}: {t: LangStrings; reset: number}) {
    const [steps, setSteps] = useState<TodoStep[]>([]);

    useEffect(() => {
        const off = window.jarvis.on("todo-update", (payload: {steps?: TodoStep[]}) => {
            setSteps(Array.isArray(payload?.steps) ? payload.steps : []);
        });
        return off;
    }, []);

    // A fresh user turn clears the previous plan.
    useEffect(() => { setSteps([]); }, [reset]);

    if (steps.length === 0) return null;
    const done = steps.filter((s) => s.status === "done").length;
    const allDone = done === steps.length;

    return (
        <div className="rounded-lg px-2.5 py-2 shrink-0"
            style={{border: "1px solid rgba(var(--hud),0.2)", background: "rgba(var(--hud),0.07)"}}>
            <div className="flex items-center gap-1.5 mb-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "rgb(var(--hud))", flexShrink: 0}}>
                    <path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>
                </svg>
                <span className="text-[9px] tracking-[0.2em] glow-text" style={{color: "rgba(var(--hud),0.7)"}}>
                    {t.todoPlanTitle}
                </span>
                <span className="ml-auto text-[8px] tabular-nums" style={{color: allDone ? "rgb(var(--hud))" : "rgba(var(--hud),0.45)"}}>
                    {done}/{steps.length}
                </span>
            </div>
            <ul className="flex flex-col gap-1">
                {steps.map((s, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                        <span style={{color: STATUS_COLOR[s.status], flexShrink: 0}}>
                            <StatusIcon status={s.status}/>
                        </span>
                        <span className="text-[10px] leading-tight"
                            style={{
                                color: s.status === "pending" ? "rgba(var(--hud),0.55)" : "rgb(var(--hud))",
                                textDecoration: s.status === "done" ? "line-through" : "none",
                                opacity: s.status === "done" ? 0.65 : 1,
                            }}>
                            {s.text}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

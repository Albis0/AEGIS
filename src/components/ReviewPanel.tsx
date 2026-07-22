import {useEffect, useState} from "react";

// Faz CC-7 — code review findings panel. The review_changes tool emits a
// "review-findings" event with structured findings; this overlay renders them
// grouped by severity. The formatted text also appears in the feed (tool
// result); this panel is the at-a-glance, dismissible view.

export interface Finding {
    file: string;
    line: number | null;
    severity: "high" | "medium" | "low";
    summary: string;
}

const SEV_COLOR: Record<Finding["severity"], string> = {
    high: "248,113,113",   // red
    medium: "251,191,36",  // amber
    low: "148,163,184",    // slate
};

export default function ReviewPanel() {
    const [findings, setFindings] = useState<Finding[] | null>(null);

    useEffect(() => {
        return window.jarvis.on("review-findings", (payload: {findings?: Finding[]}) => {
            setFindings(Array.isArray(payload?.findings) ? payload.findings : []);
        });
    }, []);

    if (findings === null) return null;

    return (
        <div className="fixed bottom-4 left-4 z-40 w-[clamp(240px,26vw,360px)] max-h-[60vh] rounded-lg overflow-hidden flex flex-col"
            style={{background: "rgba(4,7,13,0.97)", border: "1px solid rgba(var(--hud),0.3)"}}>
            <div className="flex items-center gap-2 px-3 py-2" style={{borderBottom: "1px solid rgba(var(--hud),0.15)"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "rgb(var(--hud))"}}>
                    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <span className="text-[10px] tracking-[0.2em] glow-text" style={{color: "rgba(var(--hud),0.75)"}}>
                    CODE REVIEW · {findings.length}
                </span>
                <button onClick={() => setFindings(null)} className="ml-auto opacity-50 hover:opacity-100 transition" style={{color: "rgb(var(--hud))"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                {findings.length === 0 ? (
                    <div className="text-[11px] py-3 text-center" style={{color: "rgba(var(--hud),0.5)"}}>No issues found.</div>
                ) : findings.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded"
                        style={{background: `rgba(${SEV_COLOR[f.severity]},0.06)`, border: `1px solid rgba(${SEV_COLOR[f.severity]},0.25)`}}>
                        <span className="text-[8px] tracking-wider px-1 py-0.5 rounded shrink-0 mt-0.5" style={{background: `rgba(${SEV_COLOR[f.severity]},0.18)`, color: `rgb(${SEV_COLOR[f.severity]})`}}>
                            {f.severity.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                            <div className="text-[10px] font-medium truncate" style={{color: "rgb(var(--hud))"}}>
                                {f.file}{f.line ? `:${f.line}` : ""}
                            </div>
                            <div className="text-[10px] leading-snug" style={{color: "rgba(var(--hud),0.7)"}}>{f.summary}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

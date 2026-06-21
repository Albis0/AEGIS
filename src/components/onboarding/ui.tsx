// AEGIS — Onboarding design system (Phase 64)
// Soft, modern, warm dark theme. Deep slate base instead of flat "blue" +
// cyan accent + subtle purple glow. All onboarding screens are powered from here.

import {useEffect, useState, type ReactNode} from "react";

// ── Palette ──────────────────────────────────────────────────────────────────
export const C = {
    accent: "56, 189, 248",   // sky-400 — soft cyan
    accent2: "129, 140, 248", // indigo-400 — secondary accent (for gradient)
    bg: "#0a0e17",            // deep slate (not pure black → warmer)
    text: "248, 250, 252",    // slate-50
    muted: "148, 163, 184",   // slate-400
    line: "148, 163, 184",    // for borders (low alpha)
};

export const ac = `rgb(${C.text})`;
export const muted = `rgb(${C.muted})`;

// ── Shell — outer frame for every screen ─────────────────────────────────────
// Background gradient + drag bar + brand + optional step indicator.
export function Shell({
    children, step, totalSteps, onClose,
}: {
    children: ReactNode;
    step?: number;        // 0-indexli; verilirse alt-ortada nokta göstergesi
    totalSteps?: number;
    onClose?: () => void;
}) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, []);

    return (
        <div
            className="h-screen w-screen flex flex-col relative overflow-hidden"
            style={{
                background: C.bg,
                color: ac,
                fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale",
            } as React.CSSProperties}
        >
            {/* Atmospheric background — two soft glows, static (easy on the eyes) */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background: `
                        radial-gradient(120% 90% at 15% 0%, rgba(${C.accent2},0.16), transparent 55%),
                        radial-gradient(120% 90% at 100% 100%, rgba(${C.accent},0.14), transparent 55%)`,
                }}
            />
            {/* Thin grid texture — very subtle, for depth */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.5]"
                style={{
                    background: `
                        linear-gradient(rgba(${C.line},0.025) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(${C.line},0.025) 1px, transparent 1px)`,
                    backgroundSize: "32px 32px",
                    maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent 100%)",
                }}
            />

            {/* Drag bar */}
            <div className="drag h-11 shrink-0 flex items-center justify-between px-5 relative z-10">
                <div className="flex items-center gap-2.5">
                    <Logo />
                    <span className="text-[12px] font-semibold tracking-[0.3em]" style={{color: ac}}>AEGIS</span>
                </div>
                <button
                    className="no-drag w-7 h-7 grid place-items-center rounded-md transition hover:bg-white/5"
                    style={{color: muted}}
                    onClick={() => (onClose ? onClose() : window.jarvis.close())}
                    aria-label="Kapat"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Content — soft fade+rise entrance */}
            <div
                className="flex-1 min-h-0 relative z-10 flex flex-col transition-all duration-500 ease-out"
                style={{opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(8px)"}}
            >
                {children}
            </div>

            {/* Step indicator */}
            {step != null && totalSteps != null && (
                <div className="shrink-0 flex items-center justify-center gap-2 pb-5 relative z-10">
                    {Array.from({length: totalSteps}).map((_, i) => (
                        <span
                            key={i}
                            className="rounded-full transition-all duration-300"
                            style={{
                                width: i === step ? 20 : 6,
                                height: 6,
                                background: i === step ? `rgb(${C.accent})` : `rgba(${C.line},0.25)`,
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Brand logo — simple, cyan via currentColor ───────────────────────────────
function Logo() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <defs>
                <linearGradient id="aegis-logo-g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={`rgb(${C.accent2})`} />
                    <stop offset="100%" stopColor={`rgb(${C.accent})`} />
                </linearGradient>
            </defs>
            <path d="M12 2 4 5.5v6c0 5 3.4 8.5 8 10.5 4.6-2 8-5.5 8-10.5v-6L12 2Z"
                fill="url(#aegis-logo-g)" fillOpacity="0.18" stroke="url(#aegis-logo-g)" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M12 7v5l3 2" stroke="url(#aegis-logo-g)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Heading block ─────────────────────────────────────────────────────────────
export function Heading({title, subtitle}: {title: string; subtitle?: string}) {
    return (
        <div className="space-y-2">
            <h1 className="text-[26px] font-semibold tracking-tight leading-tight" style={{color: ac}}>{title}</h1>
            {subtitle && <p className="text-[13.5px] leading-relaxed" style={{color: muted}}>{subtitle}</p>}
        </div>
    );
}

// ── Primary button — gradient filled, soft ───────────────────────────────────
export function PrimaryButton({
    children, onClick, disabled, type = "button",
}: {children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="w-full h-11 rounded-xl text-[14px] font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            style={{
                color: "#0a0e17",
                background: `linear-gradient(135deg, rgb(${C.accent}), rgb(${C.accent2}))`,
                boxShadow: `0 8px 24px -8px rgba(${C.accent},0.6)`,
            }}
        >
            {children}
        </button>
    );
}

// ── Secondary / ghost button ──────────────────────────────────────────────────
export function GhostButton({
    children, onClick, disabled, active,
}: {children: ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="w-full h-11 rounded-xl text-[14px] font-medium border transition-all duration-200 disabled:opacity-50 active:scale-[0.99] hover:bg-white/5"
            style={{
                color: ac,
                borderColor: active ? `rgba(${C.accent},0.5)` : `rgba(${C.line},0.18)`,
                background: active ? `rgba(${C.accent},0.08)` : "rgba(255,255,255,0.02)",
            }}
        >
            {children}
        </button>
    );
}

// ── Text link (secondary actions) ────────────────────────────────────────────
export function LinkButton({children, onClick}: {children: ReactNode; onClick?: () => void}) {
    return (
        <button
            onClick={onClick}
            className="text-[12.5px] font-medium transition hover:opacity-100"
            style={{color: muted, opacity: 0.8}}
        >
            {children}
        </button>
    );
}

// ── Input field ───────────────────────────────────────────────────────────────
export function Field({
    label, type = "text", value, onChange, placeholder, hint, required, optional, onEnter,
}: {
    label: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    hint?: string;
    required?: boolean;
    optional?: boolean;
    onEnter?: () => void;
}) {
    const [focus, setFocus] = useState(false);
    return (
        <label className="block space-y-1.5">
            <div className="flex items-center gap-2">
                <span className="text-[11.5px] font-medium tracking-wide" style={{color: muted}}>{label}</span>
                {required && <span className="text-[11px]" style={{color: `rgb(${C.accent})`}}>•</span>}
                {optional && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{background: `rgba(${C.line},0.1)`, color: muted}}>opsiyonel</span>}
            </div>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
                placeholder={placeholder}
                className="w-full h-11 rounded-xl px-3.5 text-[13.5px] outline-none transition-all duration-200"
                style={{
                    color: ac,
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${focus ? `rgba(${C.accent},0.55)` : value ? `rgba(${C.line},0.28)` : `rgba(${C.line},0.14)`}`,
                    boxShadow: focus ? `0 0 0 3px rgba(${C.accent},0.12)` : "none",
                }}
            />
            {hint && <p className="text-[11.5px] leading-relaxed" style={{color: muted, opacity: 0.75}}>{hint}</p>}
        </label>
    );
}

// ── Error box ─────────────────────────────────────────────────────────────────
export function ErrorBox({children}: {children: ReactNode}) {
    return (
        <div
            className="text-[12.5px] px-3.5 py-2.5 rounded-xl flex items-start gap-2.5"
            style={{color: "rgb(252,165,165)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)"}}
        >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-px">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" strokeLinecap="round" />
            </svg>
            <span className="leading-relaxed">{children}</span>
        </div>
    );
}

// ── Content column — centered, reasonable width, scrollable ─────────────────
export function Body({children}: {children: ReactNode}) {
    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="min-h-full flex flex-col justify-center px-8 py-6 max-w-[440px] mx-auto w-full gap-7">
                {children}
            </div>
        </div>
    );
}

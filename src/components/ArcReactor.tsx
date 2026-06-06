import ParticleGlobe from "./ParticleGlobe";

export type CoreState = "idle" | "listening" | "thinking" | "speaking" | "error";
export type ReactorStyle = "rings" | "hexcore" | "pulsar" | "vortex";

const LABEL: Record<CoreState, string> = {
    idle: "STANDBY",
    listening: "LISTENING",
    thinking: "PROCESSING",
    speaking: "RESPONDING",
    error: "ERROR",
};

// ── Hexagon path helper ───────────────────────────────────────────────────────
function hexPath(cx: number, cy: number, r: number, rot = 0): string {
    const pts = Array.from({length: 6}, (_, i) => {
        const a = (Math.PI / 180) * (60 * i + rot);
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    });
    return `M ${pts.join(" L ")} Z`;
}

// ── Reactor variants ──────────────────────────────────────────────────────────

function RingsReactor({state, capturing}: {state: CoreState; capturing?: boolean}) {
    const midSpin =
        state === "thinking" ? "spin-fast"
        : state === "listening" ? "breathe-fast"
        : "spin-3";

    return (
        <>
            <div
                className={`absolute rounded-full transition-opacity duration-700 ${state !== "idle" ? "w-[80%] h-[80%] opacity-60" : "w-[80%] h-[80%] opacity-20"}`}
                style={{background: "radial-gradient(circle, rgba(var(--hud),0.35) 0%, rgba(var(--hud),0.12) 40%, transparent 70%)"}}
            />
            <svg className="absolute w-[98%] h-[98%] spin-1" viewBox="0 0 200 200" fill="none" stroke="currentColor">
                <circle cx="100" cy="100" r="97" strokeWidth="0.4" strokeOpacity="0.35" strokeDasharray="1 5" />
            </svg>
            <svg className="absolute w-[90%] h-[90%] spin-2" viewBox="0 0 200 200" fill="none" stroke="currentColor">
                <circle cx="100" cy="100" r="92" strokeWidth="0.3" strokeOpacity="0.18" />
                {Array.from({length: 60}).map((_, i) => (
                    <line key={i} x1="100" y1="8" x2="100" y2={i % 5 === 0 ? "15" : "12"}
                        strokeWidth={i % 5 === 0 ? "0.7" : "0.35"}
                        strokeOpacity={i % 5 === 0 ? "0.55" : "0.28"}
                        transform={`rotate(${i * 6} 100 100)`} />
                ))}
            </svg>
            <svg className="absolute w-[80%] h-[80%] spin-2" viewBox="0 0 200 200" fill="none" stroke="currentColor">
                {[0, 90, 180, 270].map((a) => (
                    <path key={a} d="M 100 18 A 82 82 0 0 1 158 42" strokeWidth="1.4" strokeOpacity="0.5" strokeLinecap="round" transform={`rotate(${a} 100 100)`} />
                ))}
            </svg>
            <svg className={`absolute w-[74%] h-[74%] ${midSpin}`} viewBox="0 0 200 200" fill="none" stroke="currentColor">
                {Array.from({length: 3}).map((_, i) => (
                    <circle key={i} cx="100" cy="100" r="80" strokeWidth="1.5" strokeOpacity="0.45" strokeDasharray="80 87.5" strokeDashoffset={-i * 167.5} strokeLinecap="round" />
                ))}
            </svg>
        </>
    );
}

function HexCoreReactor({state}: {state: CoreState}) {
    const active = state !== "idle";
    const fast = state === "thinking";

    return (
        <>
            <div
                className={`absolute rounded-full transition-opacity duration-700 ${active ? "opacity-50" : "opacity-15"}`}
                style={{width: "75%", height: "75%", background: "radial-gradient(circle, rgba(var(--hud),0.4) 0%, rgba(var(--hud),0.08) 55%, transparent 75%)"}}
            />
            {/* Outer slow hex ring */}
            <svg className={`absolute w-[96%] h-[96%] hex-spin-slow`} viewBox="0 0 200 200" fill="none" stroke="currentColor">
                {Array.from({length: 6}).map((_, i) => (
                    <path key={i} d={hexPath(100, 100, 92, i * 60)} strokeWidth="0.4" strokeOpacity="0.25" />
                ))}
                <path d={hexPath(100, 100, 94)} strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="8 6" />
            </svg>
            {/* Mid hex ring */}
            <svg className={`absolute w-[80%] h-[80%] ${fast ? "hex-spin-fast" : "hex-spin-mid"}`} viewBox="0 0 200 200" fill="none" stroke="currentColor">
                <path d={hexPath(100, 100, 82)} strokeWidth="1.2" strokeOpacity="0.45" />
                {Array.from({length: 6}).map((_, i) => {
                    const a = (Math.PI / 3) * i;
                    const x = 100 + 82 * Math.cos(a);
                    const y = 100 + 82 * Math.sin(a);
                    return <path key={i} d={hexPath(x, y, 7)} strokeWidth="0.8" strokeOpacity="0.5" />;
                })}
            </svg>
            {/* Inner hex */}
            <svg className={`absolute w-[60%] h-[60%] ${fast ? "hex-spin-mid" : "hex-spin-slow"}`} style={{animationDirection: "reverse"}} viewBox="0 0 200 200" fill="none" stroke="currentColor">
                <path d={hexPath(100, 100, 70)} strokeWidth="1.5" strokeOpacity="0.6" />
                <path d={hexPath(100, 100, 55)} strokeWidth="0.7" strokeOpacity="0.3" strokeDasharray="5 8" />
            </svg>
            {/* Center hex */}
            <svg className="absolute w-[30%] h-[30%]" viewBox="0 0 200 200" fill="none" stroke="currentColor">
                <path d={hexPath(100, 100, 70)} strokeWidth="2.5" strokeOpacity={active ? 0.9 : 0.5} fill="rgba(var(--hud),0.08)" />
                <path d={hexPath(100, 100, 50)} strokeWidth="1" strokeOpacity="0.4" />
            </svg>
        </>
    );
}

function PulsarReactor({state}: {state: CoreState}) {
    const active = state !== "idle";
    const speed = state === "thinking" ? "1.1s" : state === "listening" ? "1.5s" : "2.2s";

    return (
        <>
            {/* Expanding wave rings */}
            {[0, 1, 2].map((i) => (
                <div key={i} className="absolute rounded-full"
                    style={{
                        width: "60%", height: "60%",
                        border: "1px solid rgba(var(--hud),0.6)",
                        animation: `pulsar-ring ${speed} ease-out ${(i * parseFloat(speed)) / 3}s infinite`,
                        opacity: active ? 0.8 : 0.4,
                    }} />
            ))}
            {/* Static outer guide ring */}
            <svg className="absolute w-[90%] h-[90%] spin-1" viewBox="0 0 200 200" fill="none" stroke="currentColor">
                <circle cx="100" cy="100" r="92" strokeWidth="0.3" strokeOpacity="0.2" strokeDasharray="2 8" />
            </svg>
            {/* Inner accent ring */}
            <svg className="absolute w-[65%] h-[65%] spin-3" viewBox="0 0 200 200" fill="none" stroke="currentColor">
                {Array.from({length: 4}).map((_, i) => (
                    <circle key={i} cx="100" cy="100" r="80" strokeWidth="1.2" strokeOpacity="0.35"
                        strokeDasharray="40 80" strokeDashoffset={-i * 120} strokeLinecap="round" />
                ))}
            </svg>
            {/* Center glow dot */}
            <div className="absolute rounded-full transition-all duration-500"
                style={{
                    width: active ? "8%" : "5%",
                    height: active ? "8%" : "5%",
                    background: "radial-gradient(circle, rgba(var(--hud),1) 0%, rgba(var(--hud),0.3) 60%, transparent 100%)",
                    boxShadow: `0 0 ${active ? 20 : 8}px rgba(var(--hud),0.8)`,
                }} />
        </>
    );
}

function VortexReactor({state}: {state: CoreState}) {
    const active = state !== "idle";
    const fast = state === "thinking";

    // Spiral segments: 3 arcs at different radii, each rotated
    const arcs = [
        {r: 85, sw: 1.0, op: 0.5, dash: "60 95", cls: "vortex-a"},
        {r: 68, sw: 1.4, op: 0.6, dash: "50 78", cls: "vortex-b"},
        {r: 50, sw: 1.8, op: 0.7, dash: "40 58", cls: fast ? "spin-fast" : "vortex-a"},
        {r: 33, sw: 2.0, op: 0.8, dash: "28 38", cls: fast ? "vortex-b" : "vortex-c"},
    ];

    return (
        <>
            <div
                className={`absolute rounded-full transition-opacity duration-700 ${active ? "opacity-55" : "opacity-18"}`}
                style={{width: "80%", height: "80%", background: "radial-gradient(circle, rgba(var(--hud),0.3) 0%, rgba(var(--hud),0.05) 60%, transparent 80%)"}}
            />
            {/* Outer dashed guide */}
            <svg className="absolute w-[98%] h-[98%] spin-1" viewBox="0 0 200 200" fill="none" stroke="currentColor">
                <circle cx="100" cy="100" r="96" strokeWidth="0.35" strokeOpacity="0.25" strokeDasharray="1 6" />
            </svg>
            {/* Vortex spirals */}
            {arcs.map((arc, i) => (
                <svg key={i} className={`absolute w-full h-full ${arc.cls}`} viewBox="0 0 200 200" fill="none" stroke="currentColor">
                    {Array.from({length: 3}).map((_, j) => (
                        <circle key={j} cx="100" cy="100" r={arc.r}
                            strokeWidth={arc.sw} strokeOpacity={arc.op * (active ? 1 : 0.55)}
                            strokeDasharray={arc.dash}
                            strokeDashoffset={-(j * (parseFloat(arc.dash.split(" ")[0]) + parseFloat(arc.dash.split(" ")[1])) / 3)}
                            strokeLinecap="round" />
                    ))}
                </svg>
            ))}
            {/* Center core */}
            <div className="absolute rounded-full transition-all duration-500"
                style={{
                    width: "12%", height: "12%",
                    background: "radial-gradient(circle, rgba(var(--hud),0.9) 0%, rgba(var(--hud),0.2) 70%, transparent 100%)",
                    boxShadow: active ? `0 0 18px rgba(var(--hud),0.7), 0 0 40px rgba(var(--hud),0.2)` : `0 0 6px rgba(var(--hud),0.4)`,
                }} />
        </>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ArcReactor({
    state,
    capturing,
    reactorStyle = "rings",
}: {
    state: CoreState;
    capturing?: boolean;
    reactorStyle?: ReactorStyle;
}) {
    const active = state !== "idle";

    return (
        <div className="relative grid place-items-center w-full h-full hud" style={{color: "rgb(var(--hud))"}}>
            {reactorStyle === "rings"   && <RingsReactor   state={state} capturing={capturing} />}
            {reactorStyle === "hexcore" && <HexCoreReactor state={state} />}
            {reactorStyle === "pulsar"  && <PulsarReactor  state={state} />}
            {reactorStyle === "vortex"  && <VortexReactor  state={state} />}

            {/* Particle globe — shown for all styles */}
            <div className="absolute w-[70%] h-[70%]">
                <ParticleGlobe state={state} capturing={capturing} />
            </div>

            {/* State label */}
            <div className="absolute bottom-[2%] text-[10px] tracking-[0.5em] glow-text flex items-center gap-2" style={{fontFamily: "Orbitron, sans-serif"}}>
                {LABEL[state]}
                {active && <span className="flick">●</span>}
            </div>
        </div>
    );
}

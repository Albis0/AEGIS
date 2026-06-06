import {lazy, Suspense} from "react";
import ParticleGlobe from "./ParticleGlobe";

export type CoreState = "idle" | "listening" | "thinking" | "speaking" | "error";
export type ReactorStyle = "rings" | "hexcore" | "pulsar" | "vortex" | "orb" | "plasma" | "helix" | "quantum";

const ArcReactor3D = lazy(() => import("./ArcReactor3D"));

const LABEL: Record<CoreState, string> = {
    idle: "STANDBY",
    listening: "LISTENING",
    thinking: "PROCESSING",
    speaking: "RESPONDING",
    error: "ERROR",
};

const IS_3D: Record<ReactorStyle, boolean> = {
    rings: false, hexcore: false, pulsar: false, vortex: false,
    orb: true, plasma: true, helix: true, quantum: true,
};

// ── Speed multiplier per state ────────────────────────────────────────────────
function rxSpeed(state: CoreState): number {
    return state === "thinking" ? 2.5
        : state === "listening" ? 1.6
        : state === "speaking"  ? 1.2
        : 1.0;
}

// ── Hex path helper ───────────────────────────────────────────────────────────
function hexPath(cx: number, cy: number, r: number, rot = 0): string {
    const pts = Array.from({length: 6}, (_, i) => {
        const a = (Math.PI / 180) * (60 * i + rot);
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    });
    return `M ${pts.join(" L ")} Z`;
}

// ── LITE: Chronos (Rings) ─────────────────────────────────────────────────────
function RingsReactor({state}: {state: CoreState; capturing?: boolean}) {
    const active = state !== "idle";
    const err = state === "error";
    const c = (op: number) => err ? `rgba(239,68,68,${op})` : `rgba(var(--hud),${op})`;

    return (
        <svg className="absolute w-full h-full" viewBox="0 0 200 200" fill="none">
            <defs>
                <radialGradient id="rg-rings-center" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor={c(active ? 1.0 : 0.5)} />
                    <stop offset="50%"  stopColor={c(active ? 0.35 : 0.12)} />
                    <stop offset="100%" stopColor={c(0)} />
                </radialGradient>
                <filter id="glow-rings" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-rings-core" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {/* Outer tick ring — 48 marks */}
            <g className="rx-spin-1">
                {Array.from({length: 48}).map((_, i) => (
                    <line key={i}
                        x1="100" y1="6"
                        x2="100" y2={i % 4 === 0 ? "13" : "10"}
                        stroke={c(i % 4 === 0 ? 0.5 : 0.2)}
                        strokeWidth={i % 4 === 0 ? "0.9" : "0.4"}
                        transform={`rotate(${i * 7.5} 100 100)`} />
                ))}
            </g>

            {/* Ring 1 — 4 bracket arcs, counter-rotate */}
            <g className="rx-spin-2" style={{transformOrigin: "100px 100px"}} filter="url(#glow-rings)">
                {[0, 90, 180, 270].map((a) => (
                    <path key={a}
                        d="M 100 18 A 82 82 0 0 1 158 50"
                        stroke={c(0.65)} strokeWidth="1.8" strokeLinecap="round"
                        transform={`rotate(${a} 100 100)`} />
                ))}
            </g>

            {/* Ring 2 — flowing dash, larger */}
            <circle cx="100" cy="100" r="70"
                className="rx-spin-3 dash-flow"
                filter="url(#glow-rings)"
                stroke={c(0.55)} strokeWidth="1.3" strokeLinecap="round"
                strokeDasharray="20 12" />

            {/* Ring 3 — 3 arc segments */}
            <g className="rx-spin-fast" filter="url(#glow-rings)">
                {[0, 1, 2].map((i) => (
                    <circle key={i} cx="100" cy="100" r="54"
                        stroke={c(0.5)} strokeWidth="2.0" strokeLinecap="round"
                        strokeDasharray="46 60" strokeDashoffset={i * -106} />
                ))}
            </g>

            {/* Ring 4 — inner reverse dashes */}
            <circle cx="100" cy="100" r="38"
                className="rx-spin-2 dash-flow-rev"
                filter="url(#glow-rings)"
                stroke={c(0.45)} strokeWidth="1.1"
                strokeLinecap="round" strokeDasharray="10 8" />

            {/* Center core glow */}
            <circle cx="100" cy="100" r={active ? "18" : "11"}
                fill="url(#rg-rings-center)"
                filter="url(#glow-rings-core)"
                style={{transition: "r 0.5s ease"}} />
            <circle cx="100" cy="100" r={active ? "5.5" : "3.5"}
                fill={c(active ? 1.0 : 0.6)}
                filter="url(#glow-rings-core)"
                className="rx-glow-pulse" />
        </svg>
    );
}

// ── LITE: Tesseract (Hex Core) ────────────────────────────────────────────────
function HexCoreReactor({state}: {state: CoreState}) {
    const active = state !== "idle";
    const fast = state === "thinking";
    const errC = state === "error";
    const c = (op: number) => errC ? `rgba(239,68,68,${op})` : `rgba(var(--hud),${op})`;

    return (
        <svg className="absolute w-full h-full" viewBox="0 0 200 200" fill="none">
            <defs>
                <radialGradient id="rg-hex-center" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor={c(active ? 0.35 : 0.12)} />
                    <stop offset="100%" stopColor={c(0)} />
                </radialGradient>
                <filter id="glow-hex" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-hex-vertex" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {/* Outer hex ring with flowing dash */}
            <g className={`rx-hex-slow`}>
                <path d={hexPath(100, 100, 90)} stroke={c(0.25)} strokeWidth="0.5" strokeDasharray="6 8"
                    className="dash-flow" />
                {Array.from({length: 6}).map((_, i) => {
                    const a = (Math.PI / 3) * i;
                    const x = 100 + 90 * Math.cos(a);
                    const y = 100 + 90 * Math.sin(a);
                    return <path key={i} d={hexPath(x, y, 6)} stroke={c(0.3)} strokeWidth="0.6"
                        filter="url(#glow-hex-vertex)" fill={c(0.05)} />;
                })}
            </g>

            {/* Mid hex — flowing edges */}
            <g className={fast ? "rx-hex-fast" : "rx-hex-mid"} filter="url(#glow-hex)">
                <path d={hexPath(100, 100, 72)} stroke={c(0.5)} strokeWidth="1.2"
                    strokeDasharray="12 6" className="dash-flow" />
                {Array.from({length: 6}).map((_, i) => {
                    const a = (Math.PI / 3) * i;
                    const x = 100 + 72 * Math.cos(a);
                    const y = 100 + 72 * Math.sin(a);
                    return <circle key={i} cx={x} cy={y} r="3.5"
                        fill={c(active ? 0.9 : 0.4)}
                        filter="url(#glow-hex-vertex)" className="rx-glow-pulse" />;
                })}
            </g>

            {/* Inner hex — reverse spin */}
            <g className={fast ? "rx-hex-mid" : "rx-hex-slow"} style={{animationDirection: "reverse"}}
                filter="url(#glow-hex)">
                <path d={hexPath(100, 100, 52)} stroke={c(0.65)} strokeWidth="1.6"
                    strokeDasharray="10 4" className="dash-flow-rev" />
                <path d={hexPath(100, 100, 40)} stroke={c(0.3)} strokeWidth="0.6" strokeDasharray="4 8" />
            </g>

            {/* Center hex — filled */}
            <path d={hexPath(100, 100, 26)} fill="url(#rg-hex-center)"
                stroke={c(active ? 0.9 : 0.45)} strokeWidth="2"
                filter="url(#glow-hex)" className="rx-glow-pulse" />
            <path d={hexPath(100, 100, 16)} stroke={c(0.35)} strokeWidth="0.8" strokeDasharray="3 5" />

            {/* Center dot */}
            <circle cx="100" cy="100" r={active ? "5" : "3"}
                fill={c(active ? 1 : 0.5)} filter="url(#glow-hex-vertex)" className="rx-glow-pulse" />
        </svg>
    );
}

// ── LITE: Sonar (Pulsar) ──────────────────────────────────────────────────────
function PulsarReactor({state}: {state: CoreState}) {
    const active = state !== "idle";
    const errC = state === "error";
    const c = (op: number) => errC ? `rgba(239,68,68,${op})` : `rgba(var(--hud),${op})`;

    return (
        <svg className="absolute w-full h-full" viewBox="0 0 200 200" fill="none">
            <defs>
                <radialGradient id="rg-pulsar-core" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor={c(active ? 1 : 0.6)} />
                    <stop offset="40%"  stopColor={c(active ? 0.4 : 0.15)} />
                    <stop offset="100%" stopColor={c(0)} />
                </radialGradient>
                <radialGradient id="rg-pulsar-wave" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor={c(0)} />
                    <stop offset="60%"  stopColor={c(0.25)} />
                    <stop offset="100%" stopColor={c(0)} />
                </radialGradient>
                <filter id="glow-pulsar" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation={active ? "4" : "2"} result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-pulsar-core" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {/* Sonar expand waves (3 staggered) */}
            <circle cx="100" cy="100" r="50" className="rx-sonar"
                stroke={c(0.6)} strokeWidth="1" fill="url(#rg-pulsar-wave)" />
            <circle cx="100" cy="100" r="50" className="rx-sonar-2"
                stroke={c(0.5)} strokeWidth="0.8" fill="none" />
            <circle cx="100" cy="100" r="50" className="rx-sonar-3"
                stroke={c(0.4)} strokeWidth="0.6" fill="none" />

            {/* Outer guide ring */}
            <circle cx="100" cy="100" r="92" className="rx-spin-1"
                stroke={c(0.15)} strokeWidth="0.35" strokeDasharray="2 8" />

            {/* Static rings with flowing dash */}
            <circle cx="100" cy="100" r="78" className="rx-spin-2 dash-flow"
                filter="url(#glow-pulsar)"
                stroke={c(0.35)} strokeWidth="0.8" strokeDasharray="6 10" />
            <circle cx="100" cy="100" r="60" className="rx-spin-3 dash-flow-rev"
                filter="url(#glow-pulsar)"
                stroke={c(0.45)} strokeWidth="1.0" strokeDasharray="8 8" />

            {/* 3 arc segments 120° apart */}
            <g className="rx-spin-fast" filter="url(#glow-pulsar)">
                {[0, 120, 240].map((a) => (
                    <path key={a} d="M 100 54 A 46 46 0 0 1 130 62"
                        stroke={c(0.65)} strokeWidth="2" strokeLinecap="round"
                        transform={`rotate(${a} 100 100)`} />
                ))}
            </g>

            {/* Center core glow */}
            <circle cx="100" cy="100" r={active ? "20" : "12"}
                fill="url(#rg-pulsar-core)" filter="url(#glow-pulsar-core)"
                style={{transition: "r 0.5s ease"}} className="rx-glow-pulse" />
            <circle cx="100" cy="100" r={active ? "6" : "4"}
                fill={c(active ? 1 : 0.6)} filter="url(#glow-pulsar-core)" />
        </svg>
    );
}

// ── LITE: Singularity (Vortex) ────────────────────────────────────────────────
function VortexReactor({state}: {state: CoreState}) {
    const active = state !== "idle";
    const fast = state === "thinking";
    const errC = state === "error";
    const c = (op: number) => errC ? `rgba(239,68,68,${op})` : `rgba(var(--hud),${op})`;

    // 4 rings: inside out — fewer longer dashes → more shorter dashes
    const rings = [
        {r: 30, sw: 2.2, dash: "16 10", cls: fast ? "rx-spin-fast" : "rx-vortex-a", flow: "dash-flow"},
        {r: 48, sw: 1.8, dash: "12 10", cls: fast ? "rx-vortex-a" : "rx-vortex-b", flow: "dash-flow-rev"},
        {r: 65, sw: 1.4, dash: "9 10",  cls: fast ? "rx-vortex-b" : "rx-vortex-c", flow: "dash-flow"},
        {r: 82, sw: 1.0, dash: "6 10",  cls: "rx-vortex-c",                        flow: "dash-flow-rev"},
    ];

    return (
        <svg className="absolute w-full h-full" viewBox="0 0 200 200" fill="none">
            <defs>
                <radialGradient id="rg-vortex" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor={c(active ? 0.55 : 0.2)} />
                    <stop offset="50%"  stopColor={c(active ? 0.15 : 0.05)} />
                    <stop offset="100%" stopColor={c(0)} />
                </radialGradient>
                <filter id="glow-vortex" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-vortex-core" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {/* Radial fill */}
            <circle cx="100" cy="100" r="88" fill="url(#rg-vortex)" />

            {/* Outer guide */}
            <circle cx="100" cy="100" r="96" className="rx-spin-1"
                stroke={c(0.15)} strokeWidth="0.4" strokeDasharray="1 6" />

            {/* Vortex rings */}
            {rings.map((ring, i) => (
                <circle key={i} cx="100" cy="100" r={ring.r}
                    className={`${ring.cls} ${ring.flow}`}
                    filter="url(#glow-vortex)"
                    stroke={c((active ? 0.7 : 0.35) - i * 0.04)}
                    strokeWidth={ring.sw}
                    strokeLinecap="round"
                    strokeDasharray={ring.dash} />
            ))}

            {/* Double spiral center paths */}
            <g filter="url(#glow-vortex)">
                <path d="M 100 88 Q 112 94 100 100 Q 88 106 100 112"
                    stroke={c(active ? 0.8 : 0.4)} strokeWidth="1.5" strokeLinecap="round"
                    className="rx-spin-3" />
                <path d="M 100 88 Q 88 94 100 100 Q 112 106 100 112"
                    stroke={c(active ? 0.6 : 0.3)} strokeWidth="1.2" strokeLinecap="round"
                    className="rx-vortex-b" />
            </g>

            {/* Core */}
            <circle cx="100" cy="100" r={active ? "10" : "7"}
                fill={c(active ? 0.9 : 0.4)} filter="url(#glow-vortex-core)"
                className="rx-glow-pulse" style={{transition: "r 0.5s ease"}} />
            <circle cx="100" cy="100" r={active ? "4" : "2.5"}
                fill={c(1)} filter="url(#glow-vortex-core)" />
        </svg>
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
    const speed = rxSpeed(state);
    const is3D = IS_3D[reactorStyle];

    return (
        <div className="relative grid place-items-center w-full h-full hud"
            style={{"--rx-speed": speed, color: "rgb(var(--hud))"} as React.CSSProperties}>

            {/* Lite SVG reactors */}
            {!is3D && (
                <div className="absolute inset-0 grid place-items-center">
                    {reactorStyle === "rings"   && <RingsReactor   state={state} capturing={capturing} />}
                    {reactorStyle === "hexcore" && <HexCoreReactor state={state} />}
                    {reactorStyle === "pulsar"  && <PulsarReactor  state={state} />}
                    {reactorStyle === "vortex"  && <VortexReactor  state={state} />}
                </div>
            )}

            {/* 3D reactors */}
            {is3D && (
                <div className="absolute inset-0">
                    <Suspense fallback={null}>
                        <ArcReactor3D state={state} capturing={capturing} reactorStyle={reactorStyle} />
                    </Suspense>
                </div>
            )}

            {/* Particle globe — Lite modda 3D reaktörlerin üzerinde değil */}
            {!is3D && (
                <div className="absolute w-[70%] h-[70%]">
                    <ParticleGlobe state={state} capturing={capturing} />
                </div>
            )}

            {/* State label */}
            <div className="absolute bottom-[2%] text-[10px] tracking-[0.5em] glow-text flex items-center gap-2"
                style={{fontFamily: "Orbitron, sans-serif"}}>
                {LABEL[state]}
                {active && <span className="flick">●</span>}
            </div>
        </div>
    );
}

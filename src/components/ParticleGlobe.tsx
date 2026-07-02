import {useEffect, useRef} from "react";
import type {CoreState} from "./ArcReactor";

type P = {x: number; y: number; z: number};

// Fibonacci sphere — evenly distributed points on a sphere surface
function makeSphere(n: number): P[] {
    const pts: P[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const t = golden * i;
        pts.push({x: Math.cos(t) * r, y, z: Math.sin(t) * r});
    }
    return pts;
}

function readHud(): [number, number, number] {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--hud").trim();
    const parts = v.split(",").map((s) => parseInt(s.trim(), 10));
    return parts.length === 3 && parts.every((n) => !isNaN(n)) ? (parts as [number, number, number]) : [34, 211, 238];
}

export default function ParticleGlobe({state, capturing}: {state: CoreState; capturing?: boolean}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef<CoreState>(state);
    const capturingRef = useRef(capturing);
    stateRef.current = state;
    capturingRef.current = capturing;

    useEffect(() => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        let size = 0;
        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            size = Math.min(rect.width, rect.height);
            canvas.width = size * dpr;
            canvas.height = size * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        // Fewer particles — still looks great, much cheaper to render
        const PARTICLE_COUNT = 200;
        const NODE_COUNT = 18;
        const sphere = makeSphere(PARTICLE_COUNT);
        const nodeSet = new Set(
            Array.from({length: NODE_COUNT}, () => Math.floor(Math.random() * sphere.length))
        );
        const nodeIdx = [...nodeSet];

        // Pre-allocated projection buffer — no GC per frame
        const proj = sphere.map(() => ({sx: 0, sy: 0, depth: 0}));
        const order = sphere.map((_, i) => i);

        // Cache HUD color — reread every 2s, not every frame
        let hudRgb: [number, number, number] = [34, 211, 238];
        let hudCacheAt = 0;
        const getHud = () => {
            const now = performance.now();
            if (now - hudCacheAt > 2000) { hudRgb = readHud(); hudCacheAt = now; }
            return hudRgb;
        };

        let rotY = 0;
        const rotX = 0.32;
        let raf = 0;
        let last = performance.now();
        let pulse = 0;

        // 30fps target — halves GPU work vs 60fps
        const FRAME_MS = 1000 / 30;

        const draw = (now: number) => {
            raf = requestAnimationFrame(draw);
            // Skip frame if tab hidden or not enough time elapsed
            if (document.hidden || now - last < FRAME_MS) return;
            const dt = Math.min((now - last) / 16.67, 3);
            last = now;

            const st = stateRef.current;
            const cap = capturingRef.current;
            const speed =
                st === "thinking" ? 0.012
                : cap ? 0.014
                : st === "listening" ? 0.008
                : st === "speaking" ? 0.006
                : 0.0035;
            rotY += speed * dt;
            if (st === "listening" || cap) pulse += (cap ? 0.1 : 0.04) * dt;

            const [r, g, b] = getHud();
            const cx = size / 2;
            const cy = size / 2;
            const pulseScale =
                cap ? 1 + Math.sin(pulse) * 0.12
                : st === "listening" ? 1 + Math.sin(pulse) * 0.06
                : 1;
            const radius = size * 0.4 * pulseScale;

            ctx.clearRect(0, 0, size, size);

            const cosY = Math.cos(rotY);
            const sinY = Math.sin(rotY);
            const cosX = Math.cos(rotX);
            const sinX = Math.sin(rotX);

            // Project into pre-allocated buffer — no allocation per frame
            for (let i = 0; i < sphere.length; i++) {
                const p = sphere[i];
                const x = p.x * cosY - p.z * sinY;
                const z0 = p.x * sinY + p.z * cosY;
                const y2 = p.y * cosX - z0 * sinX;
                const z2 = p.y * sinX + z0 * cosX;
                proj[i].sx = cx + x * radius;
                proj[i].sy = cy + y2 * radius;
                proj[i].depth = (z2 + 1) / 2;
            }

            // Sort in place — reuses same array
            order.sort((i, j) => proj[i].depth - proj[j].depth);

            // Constellation links between nodes
            ctx.lineWidth = 0.6;
            const linkThresh = radius * 0.55;
            for (let i = 0; i < nodeIdx.length; i++) {
                for (let j = i + 1; j < nodeIdx.length; j++) {
                    const a = proj[nodeIdx[i]];
                    const c = proj[nodeIdx[j]];
                    const dx = a.sx - c.sx;
                    const dy = a.sy - c.sy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < linkThresh) {
                        const alpha = (1 - dist / linkThresh) * 0.25 * Math.min(a.depth, c.depth);
                        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
                        ctx.beginPath();
                        ctx.moveTo(a.sx, a.sy);
                        ctx.lineTo(c.sx, c.sy);
                        ctx.stroke();
                    }
                }
            }

            // Dots back-to-front
            const isListening = st === "listening";
            for (const i of order) {
                const pt = proj[i];
                const isNode = nodeSet.has(i);
                const sizeBoost =
                    cap ? 1 + Math.abs(Math.sin(pulse + i * 0.05)) * 1.2
                    : isListening ? 1 + Math.abs(Math.sin(pulse + i * 0.05)) * 0.5
                    : 1;
                const dotR = (isNode ? 1.8 : 1.0) * (0.4 + pt.depth * 0.9) * sizeBoost;
                const alpha =
                    cap ? 0.3 + pt.depth * 1.0 + Math.abs(Math.sin(pulse + i * 0.03)) * 0.25
                    : isListening ? 0.2 + pt.depth * 0.9 + Math.abs(Math.sin(pulse + i * 0.03)) * 0.15
                    : 0.12 + pt.depth * 0.85;
                ctx.fillStyle = isNode
                    ? `rgba(180,220,255,${Math.min(alpha, 1).toFixed(3)})`
                    : `rgba(${r},${g},${b},${Math.min(alpha, 1).toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(pt.sx, pt.sy, dotR, 0, Math.PI * 2);
                ctx.fill();
            }
        };
        raf = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        };
    }, []);

    return <canvas ref={canvasRef} className="w-full h-full" />;
}

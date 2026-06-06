import {useRef, useMemo} from "react";
import {Canvas, useFrame} from "@react-three/fiber";
import {EffectComposer, Bloom} from "@react-three/postprocessing";
import * as THREE from "three";
import type {CoreState, ReactorStyle} from "./ArcReactor";

// ── Shared helpers ────────────────────────────────────────────────────────────

function stateColor(state: CoreState): THREE.Color {
    if (state === "error")    return new THREE.Color(0xff2244);
    if (state === "thinking") return new THREE.Color(0xffffff);
    if (state === "listening")return new THREE.Color(0x00ffcc);
    if (state === "speaking") return new THREE.Color(0x44aaff);
    return new THREE.Color(0x22d3ee);
}

function stateSpeed(state: CoreState): number {
    return state === "thinking" ? 3.0
        : state === "listening" ? 1.8
        : state === "speaking"  ? 1.3
        : 0.8;
}

interface ReactorProps { state: CoreState; capturing?: boolean }

// ── Orb — "Arc Core" ──────────────────────────────────────────────────────────
function OrbScene({state}: ReactorProps) {
    const color = stateColor(state);
    const speed = stateSpeed(state);

    const ring1 = useRef<THREE.Mesh>(null!);
    const ring2 = useRef<THREE.Mesh>(null!);
    const ring3 = useRef<THREE.Mesh>(null!);
    const core  = useRef<THREE.Mesh>(null!);
    const pts   = useRef<THREE.Points>(null!);

    // fibonacci sphere particles
    const [positions, colors] = useMemo(() => {
        const count = 220;
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const golden = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < count; i++) {
            const y = 1 - (i / (count - 1)) * 2;
            const r = Math.sqrt(1 - y * y);
            const theta = golden * i;
            pos[i * 3]     = Math.cos(theta) * r * 2.2;
            pos[i * 3 + 1] = y * 2.2;
            pos[i * 3 + 2] = Math.sin(theta) * r * 2.2;
            col[i * 3]     = color.r;
            col[i * 3 + 1] = color.g;
            col[i * 3 + 2] = color.b;
        }
        return [pos, col];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    useFrame((_, delta) => {
        const d = delta * speed;
        ring1.current.rotation.z += d * 0.5;
        ring1.current.rotation.y += d * 0.2;
        ring2.current.rotation.x += d * 0.7;
        ring2.current.rotation.z -= d * 0.3;
        ring3.current.rotation.y += d * 0.4;
        ring3.current.rotation.x -= d * 0.5;
        pts.current.rotation.y   += delta * 0.004;
        // core breathe
        const pulse = Math.sin(Date.now() * 0.003 * speed) * 0.06 + 1;
        core.current.scale.setScalar(pulse);
    });

    const mat = {
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
    };

    return (
        <>
            {/* Particle sphere */}
            <points ref={pts}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                    <bufferAttribute attach="attributes-color"    args={[colors, 3]} />
                </bufferGeometry>
                <pointsMaterial size={0.04} vertexColors {...mat} />
            </points>

            {/* Ring X */}
            <mesh ref={ring1}>
                <torusGeometry args={[1.3, 0.025, 24, 100]} />
                <meshBasicMaterial color={color} {...mat} />
            </mesh>

            {/* Ring Y */}
            <mesh ref={ring2} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[1.0, 0.018, 24, 100]} />
                <meshBasicMaterial color={color} {...mat} />
            </mesh>

            {/* Ring Z */}
            <mesh ref={ring3} rotation={[Math.PI / 4, Math.PI / 4, 0]}>
                <torusGeometry args={[0.75, 0.014, 24, 100]} />
                <meshBasicMaterial color={color} {...mat} />
            </mesh>

            {/* Core sphere */}
            <mesh ref={core}>
                <sphereGeometry args={[0.22, 32, 32]} />
                <meshBasicMaterial color={color} {...mat} />
            </mesh>
            <mesh>
                <sphereGeometry args={[0.12, 32, 32]} />
                <meshBasicMaterial color={new THREE.Color(0xffffff)} {...mat} />
            </mesh>
        </>
    );
}

// ── Plasma — "Fusion" ─────────────────────────────────────────────────────────
function PlasmaScene({state}: ReactorProps) {
    const color = stateColor(state);
    const speed = stateSpeed(state);

    const ico   = useRef<THREE.Mesh>(null!);
    const torusH= useRef<THREE.Mesh>(null!);
    const torusV= useRef<THREE.Mesh>(null!);
    const knot  = useRef<THREE.Mesh>(null!);

    useFrame((_, delta) => {
        const d = delta * speed;
        ico.current.rotation.y += d * 0.4;
        ico.current.rotation.x += d * 0.25;
        torusH.current.rotation.z += d * 0.6;
        torusV.current.rotation.x += d * 0.5;
        torusV.current.rotation.y -= d * 0.3;
        knot.current.rotation.y   += d * 0.15;
        knot.current.rotation.z   -= d * 0.1;
        // scale pulse for icosahedron
        const s = Math.sin(Date.now() * 0.002 * speed) * 0.08 + 1;
        ico.current.scale.setScalar(s);
    });

    const mat = {
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        wireframe: true,
    };

    return (
        <>
            <mesh ref={ico}>
                <icosahedronGeometry args={[0.55, 2]} />
                <meshBasicMaterial color={color} {...mat} />
            </mesh>

            <mesh ref={torusH}>
                <torusGeometry args={[1.1, 0.03, 16, 80]} />
                <meshBasicMaterial color={color} {...{...mat, wireframe: false}} />
            </mesh>

            <mesh ref={torusV} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.85, 0.022, 16, 80]} />
                <meshBasicMaterial color={color} {...{...mat, wireframe: false}} />
            </mesh>

            {/* Outer slow torus knot */}
            <mesh ref={knot}>
                <torusKnotGeometry args={[1.55, 0.012, 200, 8, 2, 3]} />
                <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(0.7)}
                    {...{...mat, wireframe: false}} />
            </mesh>

            {/* Bright center */}
            <mesh>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshBasicMaterial color={new THREE.Color(0xffffff)} {...{...mat, wireframe: false}} />
            </mesh>
        </>
    );
}

// ── Helix — "DNA" ─────────────────────────────────────────────────────────────
function HelixScene({state}: ReactorProps) {
    const color = stateColor(state);
    const speed = stateSpeed(state);

    const groupA = useRef<THREE.Group>(null!);
    const groupB = useRef<THREE.Group>(null!);
    const outer  = useRef<THREE.Group>(null!);

    // Build helix tube points
    const {curveA, curveB, nodePositionsA, nodePositionsB} = useMemo(() => {
        const turns = 2.5;
        const height = 2.8;
        const radius = 0.7;
        const segments = 120;

        const ptsA: THREE.Vector3[] = [];
        const ptsB: THREE.Vector3[] = [];
        const nA: THREE.Vector3[] = [];
        const nB: THREE.Vector3[] = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = t * turns * Math.PI * 2;
            const y = t * height - height / 2;
            ptsA.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
            ptsB.push(new THREE.Vector3(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius));
        }
        // Node positions every ~12 segments
        for (let i = 0; i <= segments; i += 12) {
            const t = i / segments;
            const angle = t * turns * Math.PI * 2;
            const y = t * height - height / 2;
            nA.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
            nB.push(new THREE.Vector3(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius));
        }

        return {
            curveA: new THREE.CatmullRomCurve3(ptsA),
            curveB: new THREE.CatmullRomCurve3(ptsB),
            nodePositionsA: nA,
            nodePositionsB: nB,
        };
    }, []);

    useFrame((_, delta) => {
        const d = delta * speed;
        groupA.current.rotation.y += d * 0.5;
        groupB.current.rotation.y -= d * 0.5;
        outer.current.rotation.y  += delta * 0.003;
    });

    const mat = {
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
    };
    const colorDim = new THREE.Color(color).multiplyScalar(0.6);

    return (
        <group ref={outer}>
            {/* Helix strand A */}
            <group ref={groupA}>
                <mesh>
                    <tubeGeometry args={[curveA, 120, 0.022, 6, false]} />
                    <meshBasicMaterial color={color} {...mat} />
                </mesh>
                {nodePositionsA.map((pos, i) => (
                    <mesh key={i} position={pos}>
                        <sphereGeometry args={[0.06, 8, 8]} />
                        <meshBasicMaterial color={new THREE.Color(0xffffff)} {...mat} />
                    </mesh>
                ))}
            </group>

            {/* Helix strand B */}
            <group ref={groupB}>
                <mesh>
                    <tubeGeometry args={[curveB, 120, 0.018, 6, false]} />
                    <meshBasicMaterial color={colorDim} {...mat} />
                </mesh>
                {nodePositionsB.map((pos, i) => (
                    <mesh key={i} position={pos}>
                        <sphereGeometry args={[0.05, 8, 8]} />
                        <meshBasicMaterial color={color} {...mat} />
                    </mesh>
                ))}
            </group>

            {/* Outer ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[1.4, 0.012, 8, 100]} />
                <meshBasicMaterial color={colorDim} {...mat} />
            </mesh>

            {/* Center */}
            <mesh>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshBasicMaterial color={new THREE.Color(0xffffff)} {...mat} />
            </mesh>
        </group>
    );
}

// ── Quantum — "Entanglement" ───────────────────────────────────────────────────
function QuantumScene({state}: ReactorProps) {
    const color = stateColor(state);
    const speed = stateSpeed(state);

    const knot  = useRef<THREE.Mesh>(null!);
    const ring1 = useRef<THREE.Mesh>(null!);
    const ring2 = useRef<THREE.Mesh>(null!);
    const ring3 = useRef<THREE.Mesh>(null!);
    const ptRef = useRef<THREE.Points>(null!);

    // Torus-shaped particle ring
    const ptPositions = useMemo(() => {
        const count = 320;
        const pos = new Float32Array(count * 3);
        const R = 1.8; const r = 0.18;
        for (let i = 0; i < count; i++) {
            const u = (i / count) * Math.PI * 2;
            const v = Math.random() * Math.PI * 2;
            pos[i * 3]     = (R + r * Math.cos(v)) * Math.cos(u);
            pos[i * 3 + 1] = r * Math.sin(v);
            pos[i * 3 + 2] = (R + r * Math.cos(v)) * Math.sin(u);
        }
        return pos;
    }, []);

    useFrame((_, delta) => {
        const d = delta * speed;
        knot.current.rotation.y  += d * 0.35;
        knot.current.rotation.x  += d * 0.15;
        ring1.current.rotation.z += d * 0.6;
        ring2.current.rotation.x += d * 0.45;
        ring2.current.rotation.y += d * 0.2;
        ring3.current.rotation.z -= d * 0.3;
        ring3.current.rotation.y += d * 0.35;
        ptRef.current.rotation.y += delta * 0.006;

        // knot scale on state
        const target = state === "thinking" ? 1.12 : 1.0;
        knot.current.scale.lerp(new THREE.Vector3(target, target, target), 0.05);
    });

    const mat = {
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
    };

    return (
        <>
            {/* Particle torus ring */}
            <points ref={ptRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[ptPositions, 3]} />
                </bufferGeometry>
                <pointsMaterial size={0.035} color={color} {...mat} />
            </points>

            {/* Torus knot */}
            <mesh ref={knot}>
                <torusKnotGeometry args={[0.9, 0.08, 200, 20, 2, 3]} />
                <meshBasicMaterial color={color} {...mat} />
            </mesh>

            {/* Orbit rings at different tilts */}
            <mesh ref={ring1}>
                <torusGeometry args={[1.5, 0.018, 8, 100]} />
                <meshBasicMaterial color={color} {...mat} />
            </mesh>

            <mesh ref={ring2} rotation={[Math.PI / 3, 0, 0]}>
                <torusGeometry args={[1.25, 0.014, 8, 100]} />
                <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(0.75)} {...mat} />
            </mesh>

            <mesh ref={ring3} rotation={[0, Math.PI / 4, Math.PI / 3]}>
                <torusGeometry args={[1.0, 0.01, 8, 100]} />
                <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(0.55)} {...mat} />
            </mesh>

            {/* Center */}
            <mesh>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshBasicMaterial color={new THREE.Color(0xffffff)} {...mat} />
            </mesh>
        </>
    );
}

// ── Scene selector ────────────────────────────────────────────────────────────
function Scene({state, capturing, reactorStyle}: {state: CoreState; capturing?: boolean; reactorStyle: ReactorStyle}) {
    if (reactorStyle === "plasma")  return <PlasmaScene  state={state} capturing={capturing} />;
    if (reactorStyle === "helix")   return <HelixScene   state={state} capturing={capturing} />;
    if (reactorStyle === "quantum") return <QuantumScene state={state} capturing={capturing} />;
    return <OrbScene state={state} capturing={capturing} />;
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function ArcReactor3D({state, capturing, reactorStyle}: {
    state: CoreState;
    capturing?: boolean;
    reactorStyle: ReactorStyle;
}) {
    const bloomIntensity = state === "thinking" ? 3.0 : state === "error" ? 2.5 : 2.0;

    return (
        <Canvas
            style={{width: "100%", height: "100%"}}
            gl={{
                alpha: true,
                antialias: true,
                toneMapping: THREE.NoToneMapping,
            }}
            camera={{position: [0, 0, 5.5], fov: 48}}
        >
            <EffectComposer>
                <Bloom
                    intensity={bloomIntensity}
                    luminanceThreshold={0.05}
                    luminanceSmoothing={0.9}
                    radius={0.85}
                    mipmapBlur
                />
            </EffectComposer>
            <Scene state={state} capturing={capturing} reactorStyle={reactorStyle} />
        </Canvas>
    );
}

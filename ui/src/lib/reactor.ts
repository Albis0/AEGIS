/**
 * The reactor — an instrument face, drawn in 2D.
 *
 * This is the centre of the interface and the only thing on an otherwise
 * empty stage, so it has to hold up to being looked at directly.
 *
 * It was a WebGL object before this, and the reasons it is not any more are
 * worth keeping written down, because "make it 3D" is the obvious instinct:
 *
 *   - A disc seen in perspective foreshortens by the cosine of the angle it
 *     is turned through. Every interaction that made the object feel handled
 *     also flattened it into an ellipse, so the rotation had to be clamped so
 *     tightly that the perspective it paid for was never really visible.
 *   - Bloom is a screen-space pass with no idea what a material is. Making
 *     the plasma bloom without the housing blooming with it meant tuning a
 *     threshold against a lighting rig, and the answer differed per theme.
 *   - Metal is entirely reflection. On a white page a metal housing has to
 *     stay dark, and the only lever for that is de-metalling it, which is the
 *     definition of plastic.
 *
 * All three are lighting problems, and this face has no lighting: it is line
 * work. Every value is chosen rather than computed, which is why it can be
 * exactly as crisp on a white page as on a black one. The reads that made the
 * 3D version worth having are kept and drawn directly instead — turned metal
 * as a swept conic gradient, wound wire as paired dark and lit strokes, and
 * bloom as an explicit blur of an emissive layer that is drawn separately and
 * is therefore thresholded by construction rather than by luminance.
 *
 * Everything animated is driven by a single `Drive` struct that the caller
 * mutates. State changes are interpolated, never snapped: the reactor
 * spinning up when a request starts is a large part of what tells the user
 * something is happening, and a jump cut says nothing.
 */

/** What the reactor is reacting to. The caller mutates this in place. */
export interface Drive {
    /** Target rotation speed, revolutions per second. Signed. */
    spin: number;
    /** Target emissive intensity of the core, roughly 0-2. */
    glow: number;
    /** Target hue of the plasma, in degrees. */
    hue: number;
    /** 0-1, drives the outward pressure wave. Used while speaking. */
    pulse: number;
    /** 0-1 live microphone level, spikes the core. */
    level: number;
}

/** A handle on a running reactor. */
export interface Reactor {
    /** The mutable drive state. Assign to its fields to steer the visual. */
    drive: Drive;
    /**
     * The canvas, so the caller can style the cursor over it.
     *
     * Exposed rather than guessed at: the element is created here and appended
     * to the host, so this is the only reliable reference to it.
     */
    readonly canvas: HTMLCanvasElement;
    /** Tears down the loop and every listener. */
    dispose(): void;
}

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;

/**
 * Every radius, as a fraction of the reactor's own radius.
 *
 * Kept in one table because the whole design is the spacing between these
 * numbers. A ring that lands in the middle of a gap reads as an accident; one
 * that lands flush against its neighbour reads as a machined seat.
 */
const RIM = 0.995;
const GRAD_OUTER = 0.966;
const GRAD_INNER = 0.928;
const GRAD_MAJOR = 0.9;
const CHANNEL_OUTER = 0.886;
const HOUSING_OUTER = 0.874;
const HOUSING_INNER = 0.716;
const BOLT_RING = 0.795;
const BOLT_RADIUS = 0.031;
const COIL_OUTER = 0.656;
const COIL_INNER = 0.546;
const INDEX_RING = 0.487;
const BORE = 0.404;

/** Coil segments around the drive ring. */
const COILS = 10;
/** Wire turns drawn across each coil. */
const TURNS = 7;
/** Graduations on the outer bezel. Divisible by 12, for the majors. */
const GRADUATIONS = 144;
/** Bolts through the housing. */
const BOLTS = 8;
/** Index ticks on the counter-rotating inner ring. */
const INDICES = 36;

/** How far the reactor's radius reaches across the shorter side of the host. */
const FRACTION = 0.36;

/**
 * How much the bloom buffer is shrunk before it is blurred.
 *
 * Blur radius is in buffer pixels, so working at a quarter scale makes a
 * cheap 3px blur behave like a 12px one, which is the width the core needs.
 */
const BLOOM_SCALE = 4;

/**
 * Markers that travel the dial at their own rates.
 *
 * These carry most of the sense that the thing is running. The radii are
 * deliberately picked to land in the channels between the fixed rings, so
 * each one reads as riding in a track rather than floating over the face.
 */
const MARKERS: { radius: number; span: number; rate: number }[] = [
    { radius: 0.686, span: 0.05, rate: -1.35 },
    { radius: 0.686, span: 0.17, rate: 0.48 },
    { radius: 0.914, span: 0.035, rate: 0.82 },
    { radius: 0.914, span: 0.13, rate: -0.31 },
    { radius: 0.52, span: 0.04, rate: 1.9 },
];

type Theme = "dark" | "light";

/**
 * Everything the theme changes.
 *
 * The two palettes are not inversions of each other. A dark instrument on a
 * dark page and a pale instrument on a white page are both real objects; a
 * dark instrument on a white page is a hole, and a pale one on a black page is
 * a lamp. What stays constant across both is the bore, which is dark either
 * way, because that is the only thing guaranteeing the core still reads as hot
 * rather than as a coloured circle.
 */
interface Palette {
    /** Soft contact shadow that seats the reactor on the page. */
    shadow: string;
    faceInner: string;
    faceOuter: string;
    rim: string;
    /** The recess the coils are seated in. Reads as a machined pocket. */
    track: string;
    /** The two lobes of the turned-metal sweep on the housing. */
    metalLow: string;
    metalHigh: string;
    /** Engraved line work. */
    line: string;
    lineStrong: string;
    tick: string;
    tickMajor: string;
    /** Coil body, across the band. */
    coilLow: string;
    coilHigh: string;
    /** The gap between two turns of wire, and the crown of the wire itself. */
    wire: string;
    wireLit: string;
    bolt: string;
    boltRim: string;
    /** The bore the core sits in. Dark in both themes, on purpose. */
    boreInner: string;
    boreOuter: string;
    /**
     * How the emissive layer is laid over the structure.
     *
     * Additive on a dark face, which is what makes light look like light. On a
     * pale face additive saturates to white immediately, so there the layer
     * composites normally and the dark bore provides the contrast instead.
     */
    composite: GlobalCompositeOperation;
    /** How much of the blurred emissive layer comes back over the top. */
    bloom: number;
    /** Multiplier on every emissive alpha. */
    emissive: number;
}

const PALETTES: Record<Theme, Palette> = {
    dark: {
        shadow: "rgba(0, 0, 0, 0.7)",
        faceInner: "#101720",
        faceOuter: "#070a10",
        rim: "rgba(150, 176, 208, 0.34)",
        track: "#070a10",
        metalLow: "#161c26",
        metalHigh: "#414d5f",
        line: "rgba(150, 175, 208, 0.2)",
        lineStrong: "rgba(178, 202, 232, 0.46)",
        tick: "rgba(150, 176, 208, 0.3)",
        tickMajor: "rgba(206, 224, 246, 0.74)",
        coilLow: "#2c1a0f",
        coilHigh: "#b8703a",
        wire: "rgba(20, 11, 6, 0.72)",
        wireLit: "rgba(255, 199, 148, 0.5)",
        bolt: "#0d131b",
        boltRim: "rgba(176, 200, 228, 0.4)",
        boreInner: "#04070c",
        boreOuter: "#0e1620",
        composite: "lighter",
        bloom: 0.9,
        emissive: 1,
    },
    light: {
        shadow: "rgba(24, 36, 54, 0.3)",
        faceInner: "#eef1f5",
        faceOuter: "#ccd4de",
        rim: "rgba(40, 56, 78, 0.42)",
        track: "#7f8c9c",
        metalLow: "#aeb9c6",
        metalHigh: "#f4f7fa",
        line: "rgba(38, 54, 76, 0.22)",
        lineStrong: "rgba(28, 42, 60, 0.44)",
        tick: "rgba(40, 58, 80, 0.36)",
        tickMajor: "rgba(18, 28, 42, 0.72)",
        coilLow: "#965127",
        coilHigh: "#e39a5c",
        wire: "rgba(58, 28, 10, 0.5)",
        wireLit: "rgba(255, 232, 206, 0.7)",
        bolt: "#96a2b1",
        boltRim: "rgba(255, 255, 255, 0.78)",
        boreInner: "#131a25",
        boreOuter: "#28323f",
        composite: "source-over",
        bloom: 0.36,
        emissive: 1,
    },
};

/** An emissive colour at a given lightness and alpha. */
function hot(hue: number, lightness: number, alpha: number): string {
    return `hsla(${hue}, 100%, ${lightness}%, ${Math.max(0, alpha)})`;
}

/** Paths a full circle centred on the origin. */
function circle(ctx: Ctx, radius: number): void {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
}

/**
 * Paths the band between two radii, wound so a plain fill leaves the middle
 * empty: the outer circle one way round, the inner one back the other.
 */
function band(ctx: Ctx, inner: number, outer: number): void {
    ctx.beginPath();
    ctx.arc(0, 0, outer, 0, TAU, false);
    ctx.closePath();
    ctx.arc(0, 0, inner, 0, TAU, true);
    ctx.closePath();
}

/** A stroke width of at least one device pixel, so hairlines never vanish. */
function hairline(radius: number, scale: number): number {
    return Math.max(0.75, radius * scale);
}

/**
 * A turned-metal fill: light and dark lobes swept around the centre.
 *
 * This is the whole reason the housing reads as machined rather than as a grey
 * ring. A conic gradient is what a lathe-turned face actually does to a light
 * source, and one call buys the entire effect.
 *
 * `createConicGradient` is Chromium 104+, which the webview always is, but the
 * fallback keeps this from being the thing that blanks the stage if it ever
 * runs somewhere older.
 */
function turned(ctx: Ctx, angle: number, low: string, high: string): string | CanvasGradient {
    const make = (
        ctx as Ctx & {
            createConicGradient?: (start: number, x: number, y: number) => CanvasGradient;
        }
    ).createConicGradient;
    if (typeof make !== "function") return low;

    const gradient = make.call(ctx, angle, 0, 0);
    const lobes = 12;
    for (let i = 0; i <= lobes; i++) {
        gradient.addColorStop(i / lobes, i % 2 === 0 ? low : high);
    }
    return gradient;
}

/**
 * The soft ground shadow, drawn before anything else.
 *
 * It starts just inside the rim rather than well inside it: a shadow that
 * begins at 70% of the radius is a fog the object floats in, not a shadow the
 * object casts. Everything the reactor covers is wasted, so the falloff is
 * short and it does its work in the last fifth.
 */
function drawShadow(ctx: Ctx, radius: number, palette: Palette): void {
    const gradient = ctx.createRadialGradient(
        0,
        radius * 0.05,
        radius * 0.97,
        0,
        radius * 0.05,
        radius * 1.1,
    );
    gradient.addColorStop(0, palette.shadow);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    circle(ctx, radius * 1.1);
    ctx.fill();
}

/** The dial face and its rim. */
function drawFace(ctx: Ctx, radius: number, palette: Palette): void {
    const gradient = ctx.createRadialGradient(0, -radius * 0.3, radius * 0.05, 0, 0, radius * 1.05);
    gradient.addColorStop(0, palette.faceInner);
    gradient.addColorStop(1, palette.faceOuter);
    ctx.fillStyle = gradient;
    circle(ctx, radius * RIM);
    ctx.fill();

    ctx.lineWidth = hairline(radius, 0.006);
    ctx.strokeStyle = palette.rim;
    circle(ctx, radius * RIM);
    ctx.stroke();
}

/** The graduated scale around the bezel. */
function drawGraduations(ctx: Ctx, radius: number, angle: number, palette: Palette): void {
    ctx.lineCap = "butt";
    for (let i = 0; i < GRADUATIONS; i++) {
        const a = angle + (i / GRADUATIONS) * TAU;
        const major = i % 12 === 0;
        const inner = radius * (major ? GRAD_MAJOR : GRAD_INNER);
        const cos = Math.cos(a);
        const sin = Math.sin(a);

        ctx.strokeStyle = major ? palette.tickMajor : palette.tick;
        ctx.lineWidth = hairline(radius, major ? 0.011 : 0.0045);
        ctx.beginPath();
        ctx.moveTo(cos * inner, sin * inner);
        ctx.lineTo(cos * radius * GRAD_OUTER, sin * radius * GRAD_OUTER);
        ctx.stroke();
    }

    ctx.lineWidth = hairline(radius, 0.004);
    ctx.strokeStyle = palette.line;
    circle(ctx, radius * GRAD_INNER);
    ctx.stroke();
}

/** The turned housing, its two machined edges, and the bolts through it. */
function drawHousing(ctx: Ctx, radius: number, angle: number, palette: Palette): void {
    band(ctx, radius * HOUSING_INNER, radius * HOUSING_OUTER);
    ctx.fillStyle = turned(ctx, angle * 0.28, palette.metalLow, palette.metalHigh);
    ctx.fill();

    // A machined edge is a step, and a step is one bright line beside one dark
    // one. A single heavy stroke reads as an outline instead.
    ctx.lineWidth = hairline(radius, 0.005);
    for (const r of [HOUSING_INNER, HOUSING_OUTER]) {
        ctx.strokeStyle = palette.lineStrong;
        circle(ctx, radius * r);
        ctx.stroke();
    }

    const size = radius * BOLT_RADIUS;
    for (let i = 0; i < BOLTS; i++) {
        const a = angle * 0.28 + (i / BOLTS) * TAU;
        const x = Math.cos(a) * radius * BOLT_RING;
        const y = Math.sin(a) * radius * BOLT_RING;

        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
            const h = a + (k / 6) * TAU;
            const px = x + Math.cos(h) * size;
            const py = y + Math.sin(h) * size;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = palette.bolt;
        ctx.fill();
        ctx.lineWidth = hairline(radius, 0.004);
        ctx.strokeStyle = palette.boltRim;
        ctx.stroke();
    }
}

/** Short radial ribs in the channel outside the housing. Density, nothing more. */
function drawChannel(ctx: Ctx, radius: number, palette: Palette): void {
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = hairline(radius, 0.004);
    for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(cos * radius * HOUSING_OUTER, sin * radius * HOUSING_OUTER);
        ctx.lineTo(cos * radius * CHANNEL_OUTER, sin * radius * CHANNEL_OUTER);
        ctx.stroke();
    }
}

/**
 * The coils: ten wound segments on the drive ring.
 *
 * Each turn of wire is a dark stroke for the gap between turns with a bright
 * one just after it for the crown. That pairing is the whole trick — a band of
 * evenly spaced identical lines reads as a stripe pattern, and offsetting a
 * highlight against each gap is what makes it read as round wire lying on a
 * bobbin.
 */
function drawCoils(ctx: Ctx, radius: number, angle: number, palette: Palette): void {
    const inner = radius * COIL_INNER;
    const outer = radius * COIL_OUTER;
    const step = TAU / COILS;
    const span = step * 0.76;

    // The track the coils are seated in. Without it they read as bars lying on
    // the face; with it they read as parts dropped into a machined recess, and
    // the gaps between them become part of the object rather than holes in it.
    band(ctx, inner - radius * 0.012, outer + radius * 0.012);
    ctx.fillStyle = palette.track;
    ctx.fill();
    ctx.lineWidth = hairline(radius, 0.004);
    ctx.strokeStyle = palette.line;
    for (const r of [inner - radius * 0.012, outer + radius * 0.012]) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
    }

    for (let i = 0; i < COILS; i++) {
        ctx.save();
        ctx.rotate(angle + i * step);

        ctx.beginPath();
        ctx.arc(0, 0, outer, -span / 2, span / 2);
        ctx.arc(0, 0, inner, span / 2, -span / 2, true);
        ctx.closePath();

        const body = ctx.createLinearGradient(inner, 0, outer, 0);
        body.addColorStop(0, palette.coilLow);
        body.addColorStop(0.4, palette.coilHigh);
        body.addColorStop(1, palette.coilLow);
        ctx.fillStyle = body;
        ctx.fill();

        for (let k = 0; k < TURNS; k++) {
            const gap = -span / 2 + (span * (k + 0.5)) / TURNS;
            const crown = gap + (span / TURNS) * 0.32;

            ctx.strokeStyle = palette.wire;
            ctx.lineWidth = hairline(radius, 0.008);
            ctx.beginPath();
            ctx.moveTo(Math.cos(gap) * inner, Math.sin(gap) * inner);
            ctx.lineTo(Math.cos(gap) * outer, Math.sin(gap) * outer);
            ctx.stroke();

            ctx.strokeStyle = palette.wireLit;
            ctx.lineWidth = hairline(radius, 0.004);
            ctx.beginPath();
            ctx.moveTo(Math.cos(crown) * inner, Math.sin(crown) * inner);
            ctx.lineTo(Math.cos(crown) * outer, Math.sin(crown) * outer);
            ctx.stroke();
        }

        ctx.restore();
    }
}

/** The bore the core sits in, and its lip. */
function drawBore(ctx: Ctx, radius: number, palette: Palette): void {
    const gradient = ctx.createRadialGradient(0, 0, radius * 0.04, 0, 0, radius * BORE);
    gradient.addColorStop(0, palette.boreInner);
    gradient.addColorStop(1, palette.boreOuter);
    ctx.fillStyle = gradient;
    circle(ctx, radius * BORE);
    ctx.fill();

    ctx.lineWidth = hairline(radius, 0.009);
    ctx.strokeStyle = palette.lineStrong;
    circle(ctx, radius * BORE);
    ctx.stroke();
}

/**
 * The core.
 *
 * Three additive layers and no opaque disc anywhere in it. An opaque sphere at
 * the centre is the obvious way to build a core, and it hides the very layers
 * meant to give it depth: it comes out as a flat pale coin however brightly it
 * is driven.
 */
function drawCore(
    ctx: Ctx,
    radius: number,
    hue: number,
    glow: number,
    level: number,
    palette: Palette,
): void {
    const k = palette.emissive * glow;

    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.95);
    halo.addColorStop(0, hot(hue, 66, 0.4 * k));
    halo.addColorStop(0.16, hot(hue, 58, 0.19 * k));
    halo.addColorStop(0.44, hot(hue, 52, 0.055 * k));
    halo.addColorStop(1, hot(hue, 50, 0));
    ctx.fillStyle = halo;
    circle(ctx, radius * 0.95);
    ctx.fill();

    const bulb = radius * (BORE * 0.82 + level * 0.06);
    const inner = ctx.createRadialGradient(0, 0, 0, 0, 0, bulb);
    inner.addColorStop(0, hot(hue, 97, Math.min(1, 0.95 * k)));
    inner.addColorStop(0.18, hot(hue, 82, 0.72 * k));
    inner.addColorStop(0.52, hot(hue, 62, 0.26 * k));
    inner.addColorStop(1, hot(hue, 55, 0));
    ctx.fillStyle = inner;
    circle(ctx, bulb);
    ctx.fill();

    ctx.fillStyle = hot(hue, 99, Math.min(1, 0.9 * k));
    circle(ctx, radius * (0.055 + level * 0.02));
    ctx.fill();
}

/**
 * The core's light caught on the inner face of each coil.
 *
 * The one thing a flat face cannot get for free is that the core and the
 * machine around it are in the same room. One lit edge per coil, in the core's
 * own hue and rotating with them, is what buys it.
 */
function drawCoilBores(ctx: Ctx, radius: number, angle: number, hue: number, alpha: number): void {
    const step = TAU / COILS;
    const span = step * 0.76;

    ctx.lineCap = "butt";
    ctx.lineWidth = hairline(radius, 0.011);
    ctx.strokeStyle = hot(hue, 76, alpha * 0.42);
    for (let i = 0; i < COILS; i++) {
        const a = angle + i * step;
        ctx.beginPath();
        ctx.arc(0, 0, radius * (COIL_INNER + 0.006), a - span / 2, a + span / 2);
        ctx.stroke();
    }
}

/** The counter-rotating index ring just outside the bore. */
function drawIndices(ctx: Ctx, radius: number, angle: number, hue: number, alpha: number): void {
    ctx.lineCap = "butt";
    for (let i = 0; i < INDICES; i++) {
        const a = -angle * 1.6 + (i / INDICES) * TAU;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const major = i % 9 === 0;

        ctx.strokeStyle = hot(hue, major ? 80 : 66, alpha * (major ? 0.85 : 0.4));
        ctx.lineWidth = hairline(radius, major ? 0.012 : 0.006);
        ctx.beginPath();
        ctx.moveTo(cos * radius * (INDEX_RING - 0.032), sin * radius * (INDEX_RING - 0.032));
        ctx.lineTo(cos * radius * (INDEX_RING + 0.018), sin * radius * (INDEX_RING + 0.018));
        ctx.stroke();
    }
}

/**
 * The sweep: a comet's tail running the drive ring.
 *
 * Drawn as a chain of short arcs whose alpha rises along the length, because a
 * stroke cannot take a gradient that follows a curve. Twenty-four segments is
 * where the banding stops being visible.
 */
function drawSweep(ctx: Ctx, radius: number, angle: number, hue: number, alpha: number): void {
    const r = radius * (COIL_INNER - 0.028);
    const span = 1.25;
    const steps = 24;

    ctx.lineCap = "round";
    ctx.lineWidth = hairline(radius, 0.02);
    for (let i = 0; i < steps; i++) {
        const t = i / steps;
        ctx.strokeStyle = hot(hue, 74, alpha * t * t);
        ctx.beginPath();
        ctx.arc(0, 0, r, angle - span + span * t, angle - span + span * ((i + 1) / steps) + 0.012);
        ctx.stroke();
    }
}

/** Markers riding the channels between the fixed rings. */
function drawMarkers(
    ctx: Ctx,
    radius: number,
    time: number,
    angle: number,
    hue: number,
    alpha: number,
): void {
    ctx.lineCap = "round";
    ctx.lineWidth = hairline(radius, 0.013);
    for (const marker of MARKERS) {
        const a = angle * marker.rate + time * marker.rate * 0.35;
        ctx.strokeStyle = hot(hue, 78, alpha * 0.8);
        ctx.beginPath();
        ctx.arc(0, 0, radius * marker.radius, a, a + marker.span);
        ctx.stroke();
    }
}

/**
 * The pressure wave, while speaking.
 *
 * Two rings half a cycle apart, so there is always one on the way out and the
 * effect never has a visible gap between beats.
 */
function drawWave(ctx: Ctx, radius: number, phase: number, hue: number, alpha: number): void {
    for (const offset of [0, 0.5]) {
        const t = (phase + offset) % 1;
        const r = radius * (BORE + (RIM - BORE) * t);
        ctx.strokeStyle = hot(hue, 72, alpha * (1 - t) * (1 - t) * 0.7);
        ctx.lineWidth = hairline(radius, 0.01 * (1 - t) + 0.003);
        circle(ctx, r);
        ctx.stroke();
    }
}

/** The live microphone level, as a ring that tightens around the bore. */
function drawLevel(ctx: Ctx, radius: number, level: number, hue: number, alpha: number): void {
    if (level < 0.01) return;
    ctx.strokeStyle = hot(hue, 80, alpha * Math.min(1, level * 1.6) * 0.8);
    ctx.lineWidth = hairline(radius, 0.006 + level * 0.012);
    circle(ctx, radius * (BORE + 0.026));
    ctx.stroke();
}

/**
 * A 2D context, or a thrown error.
 *
 * Split out rather than checked inline because a narrowed `const` does not
 * stay narrowed inside the render closure, and the alternative is a non-null
 * assertion on every one of the forty-odd calls the loop makes.
 */
function context2d(canvas: HTMLCanvasElement): Ctx {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas is unavailable");
    return context;
}

/** Reads the theme the way it is set: an attribute on the root element. */
function currentTheme(): Theme {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Eases a hue the short way round, so 350 to 10 does not sweep the wheel. */
function easeHue(from: number, to: number, k: number): number {
    const delta = ((to - from + 540) % 360) - 180;
    return from + delta * k;
}

/**
 * Builds a reactor inside `host` and starts it.
 *
 * Throws if a 2D context cannot be had, which the caller catches to fall back
 * to a plain CSS ring rather than leaving a hole in the window.
 */
export function createReactor(host: HTMLElement): Reactor {
    const canvas = document.createElement("canvas");

    // The emissive layer gets its own canvas so the bloom pass can be handed
    // the light and nothing else. That is what the threshold on the old
    // screen-space bloom was trying, and failing, to do by luminance: here the
    // housing simply is not in the buffer, so it cannot bloom whatever the page
    // or the palette does.
    const lightCanvas = document.createElement("canvas");
    const bloomCanvas = document.createElement("canvas");

    // Every context is taken before the canvas is mounted, so a failure here
    // leaves nothing half-attached to the host for the caller to clean up.
    const ctx = context2d(canvas);
    const lightCtx = context2d(lightCanvas);
    const bloomCtx = context2d(bloomCanvas);

    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.cursor = "grab";
    // Without this the browser claims the gesture for panning, and the dial
    // only turns until the page decides it was a scroll.
    canvas.style.touchAction = "none";
    host.appendChild(canvas);

    const drive: Drive = { spin: 0.045, glow: 0.72, hue: 205, pulse: 0, level: 0 };

    let palette = PALETTES[currentTheme()];

    let width = 1;
    let height = 1;
    let dpr = 1;

    function resize(): void {
        const rect = host.getBoundingClientRect();
        // Capped at 2: past that the extra pixels cost real frame time on an
        // integrated GPU and buy nothing the eye can find on a dial.
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = Math.max(1, Math.round(rect.width));
        height = Math.max(1, Math.round(rect.height));

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        lightCanvas.width = canvas.width;
        lightCanvas.height = canvas.height;
        bloomCanvas.width = Math.max(1, Math.round(canvas.width / BLOOM_SCALE));
        bloomCanvas.height = Math.max(1, Math.round(canvas.height / BLOOM_SCALE));
    }

    resize();

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(host);

    const themeObserver = new MutationObserver(() => {
        palette = PALETTES[currentTheme()];
    });
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
    });

    // Eased state. Everything the caller sets is a target; these are what is
    // actually drawn, and they only ever move toward it.
    let spin = drive.spin;
    let glow = drive.glow;
    let hue = drive.hue;
    let pulse = 0;
    let level = 0;

    let angle = 0;
    let wave = 0;
    let zoom = 1;
    let zoomTarget = 1;
    /** Carried rotation from a flick, in radians per second. */
    let momentum = 0;

    let dragging = false;
    let grabAngle = 0;
    let grabTime = 0;

    /** The pointer's bearing from the centre of the canvas. */
    function bearing(event: PointerEvent): number {
        const rect = canvas.getBoundingClientRect();
        return Math.atan2(
            event.clientY - rect.top - rect.height / 2,
            event.clientX - rect.left - rect.width / 2,
        );
    }

    function onPointerDown(event: PointerEvent): void {
        dragging = true;
        momentum = 0;
        grabAngle = bearing(event);
        grabTime = performance.now();
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
    }

    function onPointerMove(event: PointerEvent): void {
        if (!dragging) return;

        const now = performance.now();
        const next = bearing(event);
        // Shortest arc, so crossing the seam at pi does not throw the dial a
        // whole turn in one frame.
        const delta = ((next - grabAngle + Math.PI * 3) % TAU) - Math.PI;
        const elapsed = Math.max(1, now - grabTime) / 1000;

        angle += delta;
        // Blended rather than replaced: a raw last-frame velocity is mostly
        // noise, and a flick that happens to end on a slow frame would launch
        // the dial across several turns.
        momentum = momentum * 0.6 + (delta / elapsed) * 0.4;
        grabAngle = next;
        grabTime = now;
    }

    function onPointerUp(event: PointerEvent): void {
        if (!dragging) return;
        dragging = false;
        canvas.style.cursor = "grab";
        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
    }

    function onWheel(event: WheelEvent): void {
        event.preventDefault();
        zoomTarget = Math.min(1.65, Math.max(0.68, zoomTarget * Math.exp(-event.deltaY * 0.0011)));
    }

    function onDoubleClick(): void {
        zoomTarget = 1;
        momentum = 0;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    // Non-passive on purpose: Chrome defaults wheel listeners to passive, which
    // silently voids preventDefault and scrolls the page behind the zoom.
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDoubleClick);

    let frame = 0;
    let last = performance.now();
    let clock = 0;

    function render(now: number): void {
        frame = requestAnimationFrame(render);

        // Clamped: coming back from a hidden window, an unclamped delta would
        // advance the dial by however long it was away, in one frame.
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        clock += dt;

        const ease = 1 - Math.exp(-3.4 * dt);
        spin += (drive.spin - spin) * ease;
        glow += (drive.glow - glow) * ease;
        pulse += (drive.pulse - pulse) * ease;
        hue = easeHue(hue, drive.hue, ease);
        // The microphone is the one thing that must not lag: it is the only
        // feedback that the app is hearing anything at all.
        level += (drive.level - level) * (1 - Math.exp(-14 * dt));
        zoom += (zoomTarget - zoom) * (1 - Math.exp(-9 * dt));

        if (!dragging) {
            angle += momentum * dt;
            momentum *= Math.exp(-2.6 * dt);
        }
        angle += spin * TAU * dt;
        wave = (wave + dt * 0.5) % 1;

        const radius = Math.min(width, height) * FRACTION * zoom;
        const cx = (width / 2) * dpr;
        const cy = (height / 2) * dpr;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, cx, cy);
        ctx.globalCompositeOperation = "source-over";

        drawShadow(ctx, radius, palette);
        drawFace(ctx, radius, palette);
        drawGraduations(ctx, radius, angle * 0.18, palette);
        drawChannel(ctx, radius, palette);
        drawHousing(ctx, radius, angle, palette);
        drawCoils(ctx, radius, angle, palette);
        drawBore(ctx, radius, palette);

        lightCtx.setTransform(1, 0, 0, 1, 0, 0);
        lightCtx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
        lightCtx.setTransform(dpr, 0, 0, dpr, cx, cy);
        // Additive within the layer whatever the theme: overlapping glows have
        // to add up here, regardless of how the finished layer is later laid
        // over the face below it.
        lightCtx.globalCompositeOperation = "lighter";

        const alpha = palette.emissive * Math.min(1.4, glow);
        drawCore(lightCtx, radius, hue, glow, level, palette);
        drawCoilBores(lightCtx, radius, angle, hue, alpha);
        drawIndices(lightCtx, radius, angle, hue, alpha);
        drawSweep(lightCtx, radius, angle * 1.8, hue, alpha);
        drawMarkers(lightCtx, radius, clock, angle, hue, alpha);
        drawLevel(lightCtx, radius, level, hue, alpha);
        if (pulse > 0.01) drawWave(lightCtx, radius, wave, hue, alpha * pulse);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = palette.composite;
        ctx.drawImage(lightCanvas, 0, 0);

        bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
        bloomCtx.filter = "none";
        bloomCtx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);
        bloomCtx.filter = "blur(3px)";
        bloomCtx.drawImage(lightCanvas, 0, 0, bloomCanvas.width, bloomCanvas.height);
        bloomCtx.filter = "none";

        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = palette.bloom * Math.min(1.2, glow);
        ctx.drawImage(bloomCanvas, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
    }

    frame = requestAnimationFrame(render);

    // A hidden window still gets frames in some webview configurations, and
    // there is nothing to see, so the clock is reset on the way back rather
    // than the loop being left to catch up.
    function onVisibility(): void {
        last = performance.now();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return {
        drive,
        canvas,
        dispose() {
            cancelAnimationFrame(frame);
            sizeObserver.disconnect();
            themeObserver.disconnect();
            document.removeEventListener("visibilitychange", onVisibility);
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointermove", onPointerMove);
            canvas.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointercancel", onPointerUp);
            canvas.removeEventListener("wheel", onWheel);
            canvas.removeEventListener("dblclick", onDoubleClick);
            canvas.remove();
        },
    };
}

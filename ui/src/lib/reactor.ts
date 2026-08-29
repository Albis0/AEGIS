/**
 * The reactor — a real 3D object, rendered with WebGL.
 *
 * This is the centre of the interface and the only thing on an otherwise
 * empty stage, so it has to hold up to being looked at directly. That rules
 * out the CSS-animated SVG rings it replaces: they read as a loading spinner
 * the moment you stop moving.
 *
 * What makes it read as a physical object rather than a shape:
 *
 *   - A real perspective camera, so the rings foreshorten as they turn and
 *     the housing has a visible near and far side.
 *   - Physically-based metal for the housing, lit by an environment map
 *     built at runtime. Metal is entirely reflection; with no environment
 *     to reflect, `metalness: 1` renders as flat black. The gradient room
 *     built in `environment()` is what gives the bevels their sheen.
 *   - Emissive coils and a plasma core that light the housing around them,
 *     rather than glowing in isolation.
 *   - Volumetric-ish bloom, so bright parts bleed the way a real light does
 *     through a camera.
 *
 * Everything animated is driven by a single `Drive` struct that the caller
 * mutates. State changes are interpolated, never snapped: the reactor
 * spinning up when a request starts is a large part of what tells the user
 * something is happening, and a jump cut says nothing.
 *
 * Runs entirely on the GPU compositor once started. When the tab is hidden
 * or the caller stops it, the loop is torn down rather than throttled.
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/** What the reactor is reacting to. The caller mutates this in place. */
export interface Drive {
    /** Target rotation speed, revolutions per second. Signed. */
    spin: number;
    /** Target emissive intensity of the core, roughly 0-3. */
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
    /** Tears down the loop, the listeners and every GPU resource. */
    dispose(): void;
}

/**
 * Builds the environment the metal reflects.
 *
 * A canvas gradient rather than a loaded HDR: it is a few hundred bytes of
 * code instead of a multi-megabyte asset in an app that ships as one exe,
 * and for a dark interface with one bright object the difference is not
 * visible. The bright band across the top acts as a key light and is what
 * produces the highlight running along the top of each ring.
 */
function environment(
    renderer: THREE.WebGLRenderer,
    light: boolean,
): {
    texture: THREE.Texture;
    pmrem: THREE.PMREMGenerator;
} {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // A room with bright softboxes, not an evenly lit one. Metal shows its
    // shape only through what it reflects, so form comes from the *contrast*
    // between the lights and the ground around them -- a gently graded room,
    // however bright, reflects as an even wash and the object reads as a flat
    // silhouette no matter how high `envMapIntensity` goes.
    //
    // The room is built to match the theme. On a white page a dark room makes
    // the housing reflect nothing but shadow, and the reactor turns into a
    // pale ghost; the light room gives it something to be darker *than*.
    const sky = ctx.createLinearGradient(0, 0, 0, size);
    if (light) {
        // Mid-greys, not white. A white room reflects to white on a housing that
        // is already meant to be the dark thing on the page, and the reactor
        // washes out into the background it is supposed to stand against.
        sky.addColorStop(0.0, "#9aa6b6");
        sky.addColorStop(0.5, "#5f6a78");
        sky.addColorStop(1.0, "#39424e");
    } else {
        sky.addColorStop(0.0, "#243040");
        sky.addColorStop(0.5, "#0d1219");
        sky.addColorStop(1.0, "#05070a");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, size, size);

    // The lights themselves. Values well above white: this map is read as
    // lighting, and a highlight capped at #fff can only ever reflect as grey.
    // Offset from centre so the reflections are not symmetric -- symmetric
    // highlights look like a rendering, not like an object in a room.
    for (const [x, y, rx, ry, alpha] of [
        // Key: a broad softbox high and to the left.
        [size * 0.28, size * 0.1, size * 0.26, size * 0.16, 1],
        // Fill: smaller, right, dimmer.
        [size * 0.74, size * 0.24, size * 0.14, size * 0.1, 0.55],
        // Kicker: low and behind, to separate the housing from the ground.
        [size * 0.55, size * 0.86, size * 0.3, size * 0.09, 0.35],
    ]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(rx / ry, 1);
        // Softboxes are dimmed for the light room: there the surrounding ground
        // is already bright, so a full-strength highlight has almost nothing to
        // contrast with and only serves to blow the housing out.
        const a = alpha * (light ? 0.45 : 1);
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
        glow.addColorStop(0, `rgba(255, 255, 255, ${a})`);
        glow.addColorStop(0.45, `rgba(214, 232, 255, ${a * 0.5})`);
        glow.addColorStop(1, "rgba(190, 214, 255, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(-size, -size, size * 2, size * 2);
        ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    // PMREM pre-filters the map per roughness level. Without it, rough
    // surfaces sample the sharp texture and come out sparkling.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromEquirectangular(texture);
    texture.dispose();
    // `pmrem.dispose()` is deliberately NOT called here. It frees the render
    // target that owns the texture being returned, so the environment map ends
    // up pointing at a released GPU buffer: every metal surface then reflects
    // nothing and renders near-black, with no error anywhere. The generator is
    // released by the caller's `dispose`, together with the texture.
    return { texture: target.texture, pmrem };
}

/**
 * A ring with a profile, revolved around the Z axis.
 *
 * `TorusGeometry` can only make a round tube, which is why the first version
 * of this reactor read as a stack of hoops: real machined parts have square
 * shoulders, chamfers and steps, and those edges are what catch the light and
 * tell the eye how thick something is.
 *
 * `points` is the cross-section in the XZ plane -- x is distance from the
 * axis, y of the Vector2 is depth along Z -- traced in order. `LatheGeometry`
 * revolves it around Y, so the result is rotated a quarter turn to face the
 * camera.
 */
function profileRing(
    points: THREE.Vector2[],
    segments: number,
    material: THREE.Material,
): THREE.Mesh {
    const geometry = new THREE.LatheGeometry(points, segments);
    // Lathe revolves around Y; the reactor faces Z.
    geometry.rotateX(Math.PI / 2);
    // Smooths the revolved surface without softening the profile's corners,
    // so a chamfer still reads as an edge rather than a gradient.
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, material);
}

/**
 * Places `count` copies of a mesh evenly around the Z axis.
 *
 * Each instance is rotated to face outward and can be tilted, which is what
 * makes a coil bobbin sit *in* the ring rather than merely near it.
 */
function radialArray(
    mesh: THREE.InstancedMesh,
    count: number,
    radius: number,
    depth = 0,
    tilt = 0,
) {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3(1, 1, 1);

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, depth);
        // Roll to face outward, then pitch by `tilt` about that new axis.
        euler.set(tilt, 0, angle, "ZYX");
        quaternion.setFromEuler(euler);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(i, matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Mounts a reactor into `host` and starts its loop.
 *
 * The host should be a sized block element; the reactor fills it and follows
 * it through resizes.
 */
export function createReactor(host: HTMLElement): Reactor {
    const drive: Drive = { spin: 0.05, glow: 1, hue: 205, pulse: 0, level: 0 };

    // -- Renderer ---------------------------------------------------------

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
    });
    // Capped at 2: beyond that the pixel count grows faster than the visible
    // improvement, and this runs behind a chat window all day.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Tone mapping is the OutputPass's job at the end of the composer chain.
    // Doing it here as well would map twice -- once before bloom and once
    // after -- which crushes the highlights the bloom is there to produce.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // `display: block` only -- the width and height are set by `setSize` on
    // every resize, and a percentage here would fight it.
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Tracks which room the environment map was built for, so a theme change
    // can tell whether it needs rebuilding.
    let builtForLight = document.documentElement.dataset.theme === "light";
    let env = environment(renderer, builtForLight);
    scene.environment = env.texture;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.35, 7.4);
    camera.lookAt(0, 0, 0);

    // Bloom. This is what separates a glowing object from a bright-coloured
    // one: light from the core bleeds over the housing in front of it, the way
    // it does through a real lens. `threshold` is high enough that only the
    // emissive parts bloom -- drop it and the metal starts glowing too, which
    // instantly looks like a cheap filter over the whole image.
    //
    // The output pass does the tone mapping and colour conversion, so the
    // renderer must not do it a second time; `toneMapping` is set to None
    // further down for exactly that reason.
    // The composer allocates its own render targets, and the default ones drop
    // the alpha channel -- which is why a transparent canvas alone is not
    // enough here: the pass chain hands back an opaque image and the stage
    // shows a black square around the reactor. Handing it a target built with
    // an explicit alpha format is what preserves the transparency all the way
    // to the screen. The target has to be constructed with the format, not
    // patched afterwards; the GPU buffer is allocated in the constructor.
    const target = new THREE.WebGLRenderTarget(1, 1, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        colorSpace: THREE.LinearSRGBColorSpace,
        samples: 4,
    });

    const composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        0.75, // strength
        0.55, // radius
        0.5, // threshold
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    /**
     * Paints the canvas with the page background.
     *
     * The reactor cannot simply be transparent: `UnrealBloomPass` composites
     * with a shader that writes `alpha = 1`, so whatever the renderer clears
     * to, the final image comes back opaque and the stage shows a hard square
     * around the reactor. Rather than patch a library shader, the canvas is
     * cleared to the page's own background colour, read from the CSS token so
     * it follows the theme.
     *
     * Called again whenever the theme changes -- see the observer below.
     */
    function matchBackground() {
        const css = getComputedStyle(document.documentElement)
            .getPropertyValue("--bg")
            .trim();
        // An unparsable value would throw and take the whole loop down, so a
        // failure here falls back to the dark ground rather than propagating.
        let colour: THREE.Color;
        try {
            colour = new THREE.Color(css || "#0b0d10");
        } catch {
            colour = new THREE.Color(0x0b0d10);
        }
        renderer.setClearColor(colour, 1);

        // Also set as the scene background, in the renderer's working colour
        // space. The clear colour alone is not enough: the bloom pass lifts
        // whatever it is handed, so a background that only exists as a clear
        // comes back visibly greyer than the page around it. Setting it on the
        // scene puts it through the same tone mapping as everything else, and
        // the two agree.
        scene.background = colour.clone().convertSRGBToLinear();
    }
    matchBackground();

    // The theme is switched by setting `data-theme` on <html>, which changes
    // what `--bg` resolves to. Nothing tells the renderer, so it is watched.
    // `matchTheme` is declared further down, once the materials exist. The
    // observer is only ever invoked long after construction, so reaching it
    // through the wrapper is safe -- calling it directly here would not be.
    const themeObserver = new MutationObserver(() => {
        matchBackground();
        matchTheme();
    });
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
    });

    // -- Materials --------------------------------------------------------

    // Brushed metal rather than mirror metal.
    //
    // `metalness: 1` is physically correct for bare metal and wrong here: a
    // fully metallic surface has no diffuse response at all, so in a dark
    // scene it can only show what it reflects, and against a near-black
    // background that is nothing. Backing off to ~0.75 leaves a diffuse
    // component that the lights can actually land on, which is what gives
    // the housing its form. The lower value is doing the same job a real
    // product render does with a much brighter studio.

    /** Dark machined metal. The housing and the segment rings. */
    const shell = new THREE.MeshStandardMaterial({
        color: 0x5a636e,
        metalness: 0.72,
        roughness: 0.38,
        envMapIntensity: 2.4,
    });

    /** Lighter metal, for the parts that catch the key light. */
    const trim = new THREE.MeshStandardMaterial({
        color: 0x9aa5b2,
        metalness: 0.78,
        roughness: 0.24,
        envMapIntensity: 2.8,
    });

    /** The glowing parts. Emissive colour is driven by `drive.hue`. */
    const plasma = new THREE.MeshStandardMaterial({
        color: 0x0a0f18,
        metalness: 0.1,
        roughness: 0.45,
        emissive: new THREE.Color(0x4aa8ff),
        emissiveIntensity: 2,
        // The winding is an open-ended sleeve, so its inside surface has to be
        // drawn too -- otherwise the coils facing away show as hollow gaps.
        side: THREE.DoubleSide,
    });

    // -- Assembly ---------------------------------------------------------

    /** Everything, so the whole assembly can be tilted as one. */
    const rig = new THREE.Group();
    scene.add(rig);

    /** The parts that spin together. */
    const rotor = new THREE.Group();
    rig.add(rotor);

    /** The parts that counter-rotate. Counter-motion is what reads as
            machinery rather than a spinner. */
    const counter = new THREE.Group();
    rig.add(counter);

    // The parts are deliberately staggered in Z rather than laid out on one
    // plane. Coplanar rings read as a flat disc no matter how they are lit --
    // the depth has to be in the geometry, and the drift on `rig.rotation.y`
    // below is what lets the eye see it.

    // Outer casing: a machined rim with a chamfered front lip, a flat outer
    // wall and a shoulder that steps down into the well. Traced as a profile
    // rather than a torus, because the flat faces and hard edges are what read
    // as a turned metal part -- a round tube reads as a hoop no matter how it
    // is lit.
    //
    // Coordinates are (radius, depth): the outline is walked from the inner
    // shoulder at the back, out and around the front lip, and back in.
    const casing = profileRing(
        [
            new THREE.Vector2(1.62, -0.34), // inner wall, back
            new THREE.Vector2(1.62, 0.1), // inner wall, front
            new THREE.Vector2(1.72, 0.2), // shoulder chamfer
            new THREE.Vector2(2.0, 0.2), // flat face
            new THREE.Vector2(2.12, 0.12), // front lip chamfer
            new THREE.Vector2(2.18, -0.02), // outer edge
            new THREE.Vector2(2.18, -0.26), // outer wall
            new THREE.Vector2(2.04, -0.4), // rear chamfer
            new THREE.Vector2(1.62, -0.4), // back face
        ],
        192,
        trim,
    );
    rig.add(casing);

    // Inner bezel: a narrower stepped ring inside the casing, set back, which
    // gives the well a visible depth instead of a painted floor.
    const bezel = profileRing(
        [
            new THREE.Vector2(1.12, -0.3),
            new THREE.Vector2(1.12, -0.02),
            new THREE.Vector2(1.2, 0.06),
            new THREE.Vector2(1.48, 0.06),
            new THREE.Vector2(1.56, -0.02),
            new THREE.Vector2(1.56, -0.3),
        ],
        160,
        shell,
    );
    rig.add(bezel);

    // A solid back plate, so the reactor has a body instead of being a set of
    // rings you can see the background through. It also gives the core
    // something to cast its light onto, which is most of what sells the glow.
    const plateMaterial = new THREE.MeshStandardMaterial({
        color: 0x0f1319,
        metalness: 0.9,
        roughness: 0.55,
        envMapIntensity: 2.0,
    });
    const backPlate = new THREE.Mesh(
        new THREE.CylinderGeometry(1.66, 1.66, 0.16, 96),
        plateMaterial,
    );
    // The cylinder is built standing up the Y axis; the reactor faces Z.
    backPlate.rotation.x = Math.PI / 2;
    // Just behind the casing's back face, so it closes the well without
    // poking through it.
    backPlate.position.z = -0.44;
    rig.add(backPlate);

    // Fine teeth around the outer face. Small, many, and shallow: they catch
    // the key light one at a time as the ring turns, which is what makes the
    // rotation legible on a part that is otherwise a smooth circle.
    const teeth = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.05, 0.12, 0.055),
        shell,
        72,
    );
    radialArray(teeth, 72, 1.86, 0.21);
    rotor.add(teeth);

    // The coils. This is the part that makes it a reactor rather than a
    // wheel, so they are built as real objects: a metal bobbin, a glowing
    // winding wrapped around it, and a cap on the front.
    //
    // Each sits *in* the well and is pitched inward toward the core, so the
    // ring of them forms a shallow cone. Laid flat they read as a printed
    // pattern; tilted, the near ones occlude the far ones as the assembly
    // drifts, and that parallax is what sells the depth.
    const COIL_COUNT = 10;
    const COIL_RADIUS = 1.02;
    const COIL_TILT = -0.42;

    const coilCores = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.13, 0.15, 0.34, 20),
        shell,
        COIL_COUNT,
    );
    radialArray(coilCores, COIL_COUNT, COIL_RADIUS, -0.08, COIL_TILT);
    rotor.add(coilCores);

    // The winding: a glowing sleeve around the bobbin, and the only emissive
    // part of the assembly besides the core.
    //
    // A cylinder rather than a torus. A torus is a ring with a hole, so it
    // only reads as a winding when seen face-on; around the ring the far
    // coils turn edge-on and it collapses into a bright C. A sleeve looks the
    // same from every angle, which is what a wound coil actually does.
    const coils = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.165, 0.175, 0.2, 24, 1, true),
        plasma,
        COIL_COUNT,
    );
    radialArray(coils, COIL_COUNT, COIL_RADIUS, -0.08, COIL_TILT);
    rotor.add(coils);

    const coilCaps = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.17, 0.17, 0.04, 20),
        trim,
        COIL_COUNT,
    );
    radialArray(coilCaps, COIL_COUNT, COIL_RADIUS, 0.11, COIL_TILT);
    rotor.add(coilCaps);

    // Struts bridging the core housing to the bezel, counter-rotating. Long
    // and thin, so they read as structure holding the core rather than as
    // more decoration.
    const struts = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.045, 0.52, 0.07),
        trim,
        6,
    );
    {
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3(1, 1, 1);
        const axis = new THREE.Vector3(0, 0, 1);
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const radius = 0.58;
            position.set(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                -0.12,
            );
            // Rotated a quarter turn past the angle so the long axis points
            // outward along the radius.
            quaternion.setFromAxisAngle(axis, angle + Math.PI / 2);
            matrix.compose(position, quaternion, scale);
            struts.setMatrixAt(i, matrix);
        }
        struts.instanceMatrix.needsUpdate = true;
    }
    counter.add(struts);

    // The housing the core sits in: a short collar with a chamfered mouth, so
    // the core is recessed in a well rather than stuck on a flat plate.
    const coreHousing = profileRing(
        [
            new THREE.Vector2(0.3, -0.34),
            new THREE.Vector2(0.3, -0.06),
            new THREE.Vector2(0.4, 0.04),
            new THREE.Vector2(0.52, 0.04),
            new THREE.Vector2(0.52, -0.34),
        ],
        96,
        trim,
    );
    rig.add(coreHousing);

    // The core is built entirely from additive layers -- there is no opaque
    // sphere at its centre.
    //
    // An emissive sphere was the obvious way and it is what made the core read
    // as a flat pale disc for so long: being opaque, it hid the very glow
    // layers meant to give it depth, and no amount of extra brightness could
    // show through something drawn in front. Light has no surface, so the core
    // does not get one.

    // A brighter pip inside the core.
    //
    // One emissive sphere renders as a flat disc: every point on it emits the
    // same amount, so there is no gradient and nothing to read as depth. A
    // second, smaller and hotter sphere just behind the surface gives the
    // falloff that makes it look like light coming from inside something,
    // rather than a circle painted the colour of light.
    // Additive, so it adds light to the core behind it and crosses the bloom
    // threshold. A plain opaque sphere just paints a lighter circle: it never
    // blooms, which is why the core kept reading as a flat disc.
    const pipMaterial = new THREE.MeshBasicMaterial({
        color: 0xbfe4ff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const pip = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 24), pipMaterial);
    pip.position.z = 0.06;
    // Drawn after the opaque core, so the additive layers land on top of it
    // rather than being depth-rejected by the sphere in front of them.
    pip.renderOrder = 2;
    rig.add(pip);

    // A soft shell over the core, brightest at its rim.
    //
    // `BackSide` means only the far surface is drawn, so the shell is thinnest
    // where it faces the camera and thickest around the edge -- which stacks
    // additively into a falloff from the middle outward. That gradient is what
    // a glowing volume looks like, and it is the piece a solid sphere cannot
    // produce however bright it is set.
    const bloomShellMaterial = new THREE.MeshBasicMaterial({
        color: 0x8ed0ff,
        transparent: true,
        opacity: 0.28,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const bloomShell = new THREE.Mesh(
        new THREE.SphereGeometry(0.33, 32, 24),
        bloomShellMaterial,
    );
    bloomShell.position.z = 0.03;
    bloomShell.renderOrder = 3;
    rig.add(bloomShell);

    const haloMaterial = new THREE.MeshBasicMaterial({
        color: 0x5cb8ff,
        transparent: true,
        opacity: 0.07,
        // Back side only, so the front does not wash out the core behind it.
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 32, 24),
        haloMaterial,
    );
    halo.position.z = 0.02;
    rig.add(halo);

    // The pressure wave, shown while speaking. A flat ring scaled outward and
    // faded; parked invisible the rest of the time.
    const waveMaterial = new THREE.MeshBasicMaterial({
        color: 0x6cc0ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const wave = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 96), waveMaterial);
    rig.add(wave);

    // -- Lights -----------------------------------------------------------

    // The environment map does most of the work. These are for shaping.

    // A real point light at the core, so the housing is lit *by* the plasma.
    // Without it the glow sits on top of the metal instead of illuminating it,
    // which is the single biggest tell that a render is fake.
    const coreLight = new THREE.PointLight(0x6cc0ff, 12, 9, 2);
    rig.add(coreLight);

    const key = new THREE.DirectionalLight(0xbdd4ff, 0.9);
    key.position.set(-3, 4, 5);
    scene.add(key);

    // Ambient sky/ground fill. Lifts the housing off the background without
    // flattening it: a plain AmbientLight would raise every surface by the
    // same amount and erase the shading the other lights just produced.
    const ambient = new THREE.HemisphereLight(0x8fa8c8, 0x141a22, 1.15);
    scene.add(ambient);

    /**
     * Scales every emissive value for the current theme. Set by `matchTheme`
     * and multiplied into the loop's own `glow`, which is the per-state value.
     */
    let themeGlow = 1;

    // Declared before `matchTheme`, which adjusts its intensity: a `const`
    // reached before its declaration is a TDZ error, and `matchTheme` runs
    // during construction.
    const rim = new THREE.DirectionalLight(0x6f9bd8, 0.55);
    rim.position.set(4, -2, -4);
    scene.add(rim);

    /**
     * Re-tints the housing for the current theme.
     *
     * On a light ground the dark housing all but disappears and the reactor
     * reads as a faint smudge, so the metal is darkened rather than lightened:
     * against white, contrast has to come from the object being darker than
     * its background, which is the opposite of what works on black. The ground
     * half of the hemisphere light is lifted at the same time, or the underside
     * goes muddy.
     */
    function matchTheme() {
        const light = document.documentElement.dataset.theme === "light";

        // The room itself is rebuilt, not just re-tinted: which way the metal has
        // to contrast against the page is the thing that changes, and no material
        // tweak fixes a housing reflecting the wrong room. It costs one PMREM
        // pass, so it is skipped when the room already matches -- including on
        // the first call, where `environment` has just built the right one.
        if (light !== builtForLight) {
            builtForLight = light;
            env.texture.dispose();
            env.pmrem.dispose();
            env = environment(renderer, light);
            scene.environment = env.texture;
        }

        // On a light page the reactor becomes a dark object, and it gets there by
        // being made *less* metallic rather than merely darker in colour. A
        // metallic surface takes its brightness from the room, so against a light
        // room it stays bright no matter how dark its base colour is set -- which
        // is why simply darkening the colour above did nothing. Dropping
        // metalness lets the base colour actually show, and the reflection is cut
        // right back so it reads as a highlight rather than as the whole surface.
        shell.color.set(light ? 0x39424e : 0x5a636e);
        trim.color.set(light ? 0x8790a0 : 0x9aa5b2);
        shell.metalness = light ? 0.15 : 0.72;
        trim.metalness = light ? 0.2 : 0.78;
        shell.envMapIntensity = light ? 0.18 : 2.4;
        trim.envMapIntensity = light ? 0.22 : 2.8;
        // Rough, so the key light spreads into a broad sheen instead of a hard
        // specular hit. At the dark theme's roughness the segments each catch the
        // softbox as a small bright spot, and around a ring of forty that reads
        // as one solid white band.
        shell.roughness = light ? 0.72 : 0.38;
        trim.roughness = light ? 0.6 : 0.24;

        ambient.groundColor.set(light ? 0x9aa5b2 : 0x141a22);
        ambient.intensity = light ? 0.5 : 1.15;
        key.intensity = light ? 0.6 : 0.9;
        rim.intensity = light ? 0.35 : 0.55;

        plateMaterial.color.set(light ? 0x252b33 : 0x0f1319);
        plateMaterial.metalness = light ? 0.35 : 0.9;
        plateMaterial.envMapIntensity = light ? 0.4 : 2.0;

        // With the emissive turned right down for the light theme, the coils and
        // the core need a base colour to actually be: on the dark theme they are
        // nearly black and all their colour comes from the glow, which would
        // leave them as dark holes here.
        plasma.color.set(light ? 0x2f6ea8 : 0x0a0f18);

        // Bloom is a glow *added* to the image. On a dark ground that reads as
        // light; on a white one there is no headroom left to add to, so the same
        // settings erase the object into a white blob. It is cut hard, and the
        // threshold raised so only the core itself blooms at all.
        // Switched off entirely for the light theme, not merely reduced. Bloom is
        // a screen-space pass: it takes whatever is bright in the rendered image
        // and spreads it, with no idea which material produced it. On a white
        // page the page itself is near the threshold, so any strength at all
        // smears a halo over the housing that no material setting can undo --
        // which is exactly what the stubborn white ring was.
        bloom.enabled = !light;
        bloom.strength = 0.75;
        bloom.threshold = 0.5;

        // The emissive is what the core is made of, so it is dimmed with the
        // bloom rather than left to burn out on its own. It has to go a long way
        // down: emissive is added on top of the surface, and on a light page even
        // a modest value lands at the top of the range and renders as white --
        // which is what the bright ring of coils was.
        themeGlow = light ? 0.16 : 1;

        // Additive blending only works over a dark ground: it adds light, and on
        // a near-white page every pixel it touches is already at the top of the
        // range, so the halo and the wave spread as flat white over whatever is
        // behind them -- which is what was bleaching the housing. Normal blending
        // keeps them as translucent glows instead.
        const blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
        haloMaterial.blending = blending;
        waveMaterial.blending = blending;
        haloMaterial.needsUpdate = true;
        waveMaterial.needsUpdate = true;
    }
    matchTheme();

    // -- Pointer control --------------------------------------------------

    /**
     * How far the reactor can be turned by hand, in radians.
     *
     * Bounded rather than free. The back of the housing is a closed plate with
     * nothing on it -- the coils, the core and every lit surface face forward
     * -- so a full orbit lets the user turn the object around and find nothing
     * there, which reads as a bug rather than a feature. Just under a quarter
     * turn each way shows the depth of the assembly from the side without ever
     * reaching that dead face.
     */
    const YAW_LIMIT = 1.15;
    /**
     * Vertical range, deliberately smaller than the horizontal one.
     *
     * The rings are stacked along Z and splay outward, so tilting reveals much
     * more per degree than turning does; matching the two makes the vertical
     * axis feel violently oversensitive by comparison.
     */
    const PITCH_LIMIT = 0.62;
    /** Radians of rotation per pixel dragged. */
    const DRAG_SPEED = 0.0075;
    /**
     * Seconds of stillness before the reactor eases back to its resting angle.
     *
     * Long enough to look at it from an angle without it sliding away while
     * you do, short enough that a window left alone returns to the shape the
     * interface is designed around.
     */
    const RETURN_AFTER = 4;
    /** Zoom range, as a multiplier on the camera distance `resize` computes. */
    const ZOOM_MIN = 0.55;
    const ZOOM_MAX = 1.6;

    /** Where the user has dragged to. */
    let userYaw = 0;
    let userPitch = 0;
    /** Momentum, so a flick keeps turning and settles instead of stopping dead. */
    let yawVelocity = 0;
    let pitchVelocity = 0;
    /** Zoom factor, eased toward `zoomTarget`. */
    let zoom = 1;
    let zoomTarget = 1;
    /** Whether the user has taken control; the idle drift stops while true. */
    let held = false;
    /**
     * Seconds since the last interaction.
     *
     * Drives the return home: after a while untouched, the reactor eases back
     * to its resting angle and the ambient drift fades in again, so an
     * abandoned window does not sit at whatever angle it was left at.
     */
    let idleFor = 0;
    /** Set on pointer down, cleared once the pointer has moved far enough. */
    let dragOrigin: { x: number; y: number } | null = null;
    let activePointer: number | null = null;

    const canvas = renderer.domElement;
    // Without this a drag on a touchscreen scrolls the page instead of turning
    // the reactor, and the pointermove events stop arriving mid-gesture.
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    // The reactor was decorative and marked `aria-hidden`; it can be turned by
    // hand now, so it is announced instead. It carries no information a screen
    // reader needs -- the assistant's state is in the status bar as text -- so
    // this describes the control, not the state.
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Reactor. Drag to turn, scroll to zoom, double click to reset.");

    function onPointerDown(event: PointerEvent) {
        // Only the primary button drags -- right click belongs to the context
        // menu, and middle click to the browser's own scroll gesture.
        if (event.button !== 0) return;
        activePointer = event.pointerId;
        // Capture, so a drag that leaves the canvas (or the window) still ends
        // with a matching up event. Without it, dragging off the edge leaves
        // the reactor stuck to the cursor forever.
        canvas.setPointerCapture(event.pointerId);
        held = true;
        idleFor = 0;
        dragOrigin = { x: event.clientX, y: event.clientY };
        yawVelocity = 0;
        pitchVelocity = 0;
        canvas.style.cursor = "grabbing";
    }

    function onPointerMove(event: PointerEvent) {
        if (!held || event.pointerId !== activePointer || !dragOrigin) return;

        const dx = event.clientX - dragOrigin.x;
        const dy = event.clientY - dragOrigin.y;
        dragOrigin = { x: event.clientX, y: event.clientY };

        userYaw = THREE.MathUtils.clamp(userYaw + dx * DRAG_SPEED, -YAW_LIMIT, YAW_LIMIT);
        userPitch = THREE.MathUtils.clamp(
            userPitch + dy * DRAG_SPEED,
            -PITCH_LIMIT,
            PITCH_LIMIT,
        );

        // Momentum for the release. Taken from this event rather than
        // accumulated, so it reflects how fast the pointer was moving at the
        // end of the drag rather than its average over the whole gesture.
        yawVelocity = dx * DRAG_SPEED;
        pitchVelocity = dy * DRAG_SPEED;
        idleFor = 0;
    }

    function endDrag(event: PointerEvent) {
        if (event.pointerId !== activePointer) return;
        held = false;
        activePointer = null;
        dragOrigin = null;
        idleFor = 0;
        canvas.style.cursor = "grab";
        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
    }

    function onWheel(event: WheelEvent) {
        // The stage has nothing to scroll, so the gesture is free to mean
        // zoom. Prevented so the page behind does not scroll as well.
        event.preventDefault();
        // `deltaMode` differs between mice and trackpads: some report lines
        // rather than pixels, which is a factor of ~16. Normalising keeps one
        // notch of a wheel and one trackpad swipe roughly comparable.
        const lines = event.deltaMode === 1 ? 16 : 1;
        zoomTarget = THREE.MathUtils.clamp(
            zoomTarget * Math.exp(event.deltaY * lines * 0.0012),
            ZOOM_MIN,
            ZOOM_MAX,
        );
        idleFor = 0;
    }

    /** Double click puts it back where it started. */
    function onDoubleClick() {
        userYaw = 0;
        userPitch = 0;
        yawVelocity = 0;
        pitchVelocity = 0;
        zoomTarget = 1;
        idleFor = 0;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    // Not passive: the handler calls `preventDefault`, and Chrome treats wheel
    // listeners as passive by default, which would make that call a no-op and
    // log a warning for every notch.
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDoubleClick);

    // -- Sizing -----------------------------------------------------------

    /**
     * Camera distance for the current window, before the user's zoom.
     *
     * Kept separate from `camera.position.z` because both a resize and the
     * wheel want to set it. If `resize` wrote the position directly, resizing
     * the window would silently throw away the zoom; if the wheel wrote it, the
     * next resize would. The loop multiplies the two together instead, so each
     * one owns exactly one number.
     */
    let baseDistance = 7.4;

    function resize() {
        const { clientWidth: w, clientHeight: h } = host;
        if (w === 0 || h === 0) return;
        // `updateStyle` left on: the canvas gets an explicit CSS size matching
        // its drawing buffer. Suppressing it and sizing the canvas from a
        // stylesheet instead leaves the buffer at its 300x150 default, stretched
        // to fit -- which renders as a small blurry square in the corner of an
        // otherwise empty stage.
        renderer.setSize(w, h);
        // The composer owns its own render targets and does not follow the
        // renderer, so it has to be resized too or the image stays at the size
        // it was first created at and comes back stretched.
        composer.setSize(w, h);
        bloom.setSize(w, h);
        camera.aspect = w / h;

        // The canvas fills the stage, so the reactor is sized by how far back
        // the camera sits. It is fitted to the *smaller* dimension, so a wide
        // short window does not crop it, and it takes a little under half of
        // that so the object has room to breathe on an empty stage.
        //
        // Pulling the camera back is the right lever: scaling the rig instead
        // would change how much perspective the object shows, and the
        // foreshortening is what makes it read as solid.
        const REACTOR_RADIUS = 2.4;
        /** How much of the constraining dimension the reactor should cover. */
        const FRACTION = 0.78;

        // How far back the camera must sit for an object of that radius to cover
        // `FRACTION` of the viewport height at this field of view.
        const fovRadians = (camera.fov * Math.PI) / 180;
        let distance = REACTOR_RADIUS / FRACTION / Math.tan(fovRadians / 2);

        // Vertical fit only holds while the stage is at least as wide as it is
        // tall. Once it is narrower, width is what constrains the object, so the
        // camera has to pull back by the aspect ratio to keep it in frame.
        if (w < h) distance *= h / Math.max(w, 1);

        baseDistance = THREE.MathUtils.clamp(distance, 5.5, 16);
        // Applied here as well as in the loop: `resize` runs once before the
        // first frame, and the reactor should be framed correctly on that
        // frame rather than easing into position from wherever it started.
        camera.position.z = baseDistance * zoom;

        camera.updateProjectionMatrix();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    // -- Loop -------------------------------------------------------------

    // Smoothed copies of the drive values. The reactor eases toward its
    // target rather than snapping, which is what makes spinning up on a
    // request read as the machine responding.
    let spin = drive.spin;
    let glow = drive.glow;
    let hue = drive.hue;
    let level = 0;

    let rotorAngle = 0;
    let counterAngle = 0;
    /**
     * How much of the ambient drift is currently mixed in, 0-1.
     *
     * Eased rather than switched, so grabbing the reactor stops the drift
     * smoothly and letting go brings it back the same way.
     */
    let driftWeight = 1;
    let waveClock = 0;
    let frame = 0;
    let running = true;

    const clock = new THREE.Clock();
    const emissive = new THREE.Color();
    /** Reused for the pip tint; allocating a Color per frame would churn. */
    const WHITE = new THREE.Color(0xffffff);

    /** Frame-rate independent easing toward a target. */
    function approach(current: number, target: number, rate: number, dt: number) {
        return current + (target - current) * (1 - Math.exp(-rate * dt));
    }

    function tick() {
        if (!running) return;
        frame = requestAnimationFrame(tick);

        // Clamped: a background tab can hand back a delta of many seconds, and
        // an unclamped one makes the rotor jump a quarter turn on return.
        const dt = Math.min(clock.getDelta(), 0.1);
        const time = clock.elapsedTime;

        spin = approach(spin, drive.spin, 2.2, dt);
        glow = approach(glow, drive.glow, 4, dt);
        hue = approach(hue, drive.hue, 3, dt);
        level = approach(level, drive.level, 12, dt);

        rotorAngle += spin * dt * Math.PI * 2;
        counterAngle -= spin * 0.62 * dt * Math.PI * 2;
        rotor.rotation.z = rotorAngle;
        counter.rotation.z = counterAngle;

        // Orientation: the user's drag, plus a slow drift when they are not
        // touching it.
        //
        // The drift is not only life -- it is what makes the staggered depth
        // legible. Dead-on, the rings project onto one plane, and only the
        // parallax from turning shows that they sit at different distances.
        if (!held) {
            idleFor += dt;

            // Momentum from a flick, bled off rather than stopped: an object
            // with this much apparent mass should not halt the instant the
            // pointer lifts.
            if (Math.abs(yawVelocity) > 1e-4 || Math.abs(pitchVelocity) > 1e-4) {
                userYaw = THREE.MathUtils.clamp(
                    userYaw + yawVelocity,
                    -YAW_LIMIT,
                    YAW_LIMIT,
                );
                userPitch = THREE.MathUtils.clamp(
                    userPitch + pitchVelocity,
                    -PITCH_LIMIT,
                    PITCH_LIMIT,
                );
                // Frame-rate independent decay, so a 144 Hz screen does not
                // kill the glide five times faster than a 30 Hz one.
                const decay = Math.exp(-4.5 * dt);
                yawVelocity *= decay;
                pitchVelocity *= decay;
            }

            // After a while untouched, ease back to rest. Ramped in over a
            // second rather than switched on, or the reactor visibly lurches
            // the moment the timer expires.
            if (idleFor > RETURN_AFTER) {
                const strength = Math.min((idleFor - RETURN_AFTER) / 1, 1);
                userYaw = approach(userYaw, 0, 1.1 * strength, dt);
                userPitch = approach(userPitch, 0, 1.1 * strength, dt);
            }
        }

        // The ambient drift fades out while the reactor is being held, and
        // back in once it has returned to rest -- two motions at once reads as
        // the object fighting the cursor.
        const drift = held ? 0 : Math.min(idleFor / 1.5, 1);
        driftWeight = approach(driftWeight, drift, 3, dt);

        rig.rotation.y =
            userYaw + (Math.sin(time * 0.23) * 0.16 + 0.08) * driftWeight;
        rig.rotation.x =
            userPitch + (Math.sin(time * 0.31) * 0.07 + 0.05) * driftWeight;

        // Zoom rides on whatever distance `resize` computed for the current
        // window, so it stays correct across a resize instead of being an
        // absolute position that a resize would overwrite.
        zoom = approach(zoom, zoomTarget, 6, dt);
        camera.position.z = baseDistance * zoom;

        // The core breathes, and spikes with the microphone.
        const breath = 1 + Math.sin(time * 1.7) * 0.045;
        const spike = 1 + level * 0.55;
        pip.scale.setScalar(breath * spike);
        bloomShell.scale.setScalar(breath * (1 + level * 0.25));
        halo.scale.setScalar(breath * (1 + level * 0.3));

        emissive.setHSL(hue / 360, 0.85, 0.6);
        // Kept low deliberately. Emissive above roughly 1.5 saturates every
        // channel and the plasma renders white instead of blue -- the apparent
        // brightness has to come from the bloom pass, not from driving the
        // material harder.
        // The usable band is narrow. Below the bloom threshold the core reads as
        // painted plastic; much above 1.5 every channel saturates and the plasma
        // renders white, losing the hue that is the whole point of it. These sit
        // deliberately just over the threshold, and the bloom does the rest.
        plasma.emissive.copy(emissive);
        plasma.emissiveIntensity = 1.6 * glow * themeGlow;
        coreLight.color.copy(emissive);
        coreLight.intensity = (2.4 + level * 2.2) * glow * themeGlow;
        haloMaterial.color.copy(emissive);
        haloMaterial.opacity = 0.05 * themeGlow;

        // The pip is what actually reads as the light source, so it tracks the
        // hue but stays close to white -- a hot core is white at its centre
        // whatever colour it throws.
        pipMaterial.color.copy(emissive).lerp(WHITE, 0.55);
        pipMaterial.opacity = Math.min(0.95 * glow * themeGlow, 1);
        bloomShellMaterial.color.copy(emissive);
        bloomShellMaterial.opacity = 0.45 * glow * themeGlow;

        // The pressure wave. Driven by a clock that only advances while
        // `drive.pulse` is up, so it always starts from the core.
        if (drive.pulse > 0.01) {
            waveClock += dt * 1.4;
            const phase = waveClock % 1;
            wave.scale.setScalar(0.9 + phase * 1.5);
            waveMaterial.opacity = (1 - phase) * 0.4 * drive.pulse;
        } else {
            waveClock = 0;
            waveMaterial.opacity = 0;
        }

        composer.render();
    }

    frame = requestAnimationFrame(tick);

    // The loop is stopped rather than throttled when the window is hidden:
    // `requestAnimationFrame` already pauses, but the clock does not, and
    // resetting it on return is what prevents a jump.
    function onVisibility() {
        if (document.hidden) {
            running = false;
            cancelAnimationFrame(frame);
        } else if (!running) {
            running = true;
            clock.getDelta();
            frame = requestAnimationFrame(tick);
        }
    }
    document.addEventListener("visibilitychange", onVisibility);

    // -- Teardown ---------------------------------------------------------

    return {
        drive,
        canvas,
        dispose() {
            running = false;
            cancelAnimationFrame(frame);
            document.removeEventListener("visibilitychange", onVisibility);
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointermove", onPointerMove);
            canvas.removeEventListener("pointerup", endDrag);
            canvas.removeEventListener("pointercancel", endDrag);
            canvas.removeEventListener("wheel", onWheel);
            canvas.removeEventListener("dblclick", onDoubleClick);
            observer.disconnect();
            themeObserver.disconnect();
            target.dispose();

            // Three does not free GPU memory on garbage collection; every
            // geometry, material and texture has to be released by hand or the
            // buffers leak for the life of the process.
            scene.traverse((object) => {
                const mesh = object as THREE.Mesh;
                mesh.geometry?.dispose();
                const material = mesh.material;
                if (Array.isArray(material)) material.forEach((m) => m.dispose());
                else material?.dispose();
            });
            // The environment map and the generator that produced it are one
            // allocation: the generator owns the render target the texture lives
            // in, which is why it could not be released at build time.
            env.texture.dispose();
            env.pmrem.dispose();
            composer.dispose();
            renderer.dispose();
            renderer.domElement.remove();
        },
    };
}


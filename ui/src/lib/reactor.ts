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
 * Ring of segmented blocks around the housing.
 *
 * One `InstancedMesh` rather than N meshes: this is drawn every frame and
 * the difference is one draw call against forty.
 */
function segmentRing(
  count: number,
  radius: number,
  material: THREE.Material,
  box: [number, number, number],
): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(...box);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const axis = new THREE.Vector3(0, 0, 1);

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    // Each block is rotated to face outward, so the ring reads as machined
    // segments rather than scattered cubes.
    quaternion.setFromAxisAngle(axis, angle);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
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
  });

  /**
   * The core sphere.
   *
   * Emissive intensity is kept near 1 rather than pushed high. ACES tone
   * mapping desaturates as it rolls off, so an over-driven emissive does not
   * read as "brighter blue" -- it clips to white and the plasma loses its
   * colour entirely. The brightness comes from the bloom pass instead, which
   * spreads the light without washing out the source.
   */
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d1420,
    metalness: 0,
    roughness: 1,
    emissive: new THREE.Color(0x6cc0ff),
    emissiveIntensity: 1.1,
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

  // Outer housing: a wide, shallow torus, the frontmost part. The high
  // segment count matters -- this is the silhouette, and a coarse torus
  // shows facets against the dark background.
  const housing = new THREE.Mesh(
    new THREE.TorusGeometry(2.15, 0.16, 24, 160),
    trim,
  );
  housing.position.z = 0.16;
  rig.add(housing);

  // Inner housing, thicker and darker, set well back so the outer ring
  // visibly floats in front of it.
  const innerHousing = new THREE.Mesh(
    new THREE.TorusGeometry(1.55, 0.22, 20, 140),
    shell,
  );
  innerHousing.position.z = -0.22;
  rig.add(innerHousing);

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
    new THREE.CylinderGeometry(1.72, 1.72, 0.18, 96),
    plateMaterial,
  );
  // The cylinder is built standing up the Y axis; the reactor faces Z.
  backPlate.rotation.x = Math.PI / 2;
  backPlate.position.z = -0.42;
  rig.add(backPlate);

  // Segmented rings. The outer one turns with the rotor, the inner one
  // against it.
  const outerSegments = segmentRing(36, 1.9, shell, [0.13, 0.2, 0.34]);
  outerSegments.position.z = 0.04;
  rotor.add(outerSegments);

  const innerSegments = segmentRing(24, 1.22, trim, [0.1, 0.14, 0.26]);
  innerSegments.position.z = -0.1;
  counter.add(innerSegments);

  // The coils: glowing blocks set into the inner ring. These are what makes
  // it a reactor rather than a wheel. Recessed behind the rings, so their
  // light is partly occluded as the assembly turns -- a glow that is
  // sometimes hidden reads as coming from inside the object.
  const coils = segmentRing(12, 0.95, plasma, [0.14, 0.3, 0.2]);
  coils.position.z = -0.16;
  rotor.add(coils);

  // Spokes from the core out to the inner housing.
  const spokeGeometry = new THREE.BoxGeometry(0.055, 0.62, 0.1);
  const spokes = new THREE.InstancedMesh(spokeGeometry, trim, 8);
  {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const axis = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 0.62;
      position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      quaternion.setFromAxisAngle(axis, angle + Math.PI / 2);
      matrix.compose(position, quaternion, scale);
      spokes.setMatrixAt(i, matrix);
    }
    spokes.instanceMatrix.needsUpdate = true;
  }
  counter.add(spokes);

  // The core: a sphere, plus a larger transparent shell around it that
  // fakes the volume of glowing gas.
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 32), coreMaterial);
  rig.add(core);

  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x5cb8ff,
    transparent: true,
    opacity: 0.07,
    // Back side only, so the front does not wash out the core behind it.
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 24), haloMaterial);
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
    coreMaterial.color.set(light ? 0x3f8bcc : 0x0d1420);

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

  // -- Sizing -----------------------------------------------------------

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

    camera.position.z = THREE.MathUtils.clamp(distance, 5.5, 16);

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
  let waveClock = 0;
  let frame = 0;
  let running = true;

  const clock = new THREE.Clock();
  const emissive = new THREE.Color();

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

    // A slow drift on the whole assembly. This is not only life -- it is what
    // makes the staggered depth legible: dead-on, the rings still project
    // onto one plane, and only the parallax from turning shows that they are
    // at different distances. The angles are large enough to reveal the side
    // of the housing without ever showing the back.
    rig.rotation.y = Math.sin(time * 0.23) * 0.16 + 0.08;
    rig.rotation.x = Math.sin(time * 0.31) * 0.07 + 0.05;

    // The core breathes, and spikes with the microphone.
    const breath = 1 + Math.sin(time * 1.7) * 0.045;
    const spike = 1 + level * 0.55;
    core.scale.setScalar(breath * spike);
    halo.scale.setScalar(breath * (1 + level * 0.3));

    emissive.setHSL(hue / 360, 0.85, 0.6);
    coreMaterial.emissive.copy(emissive);
    // Kept low deliberately. Emissive above roughly 1.5 saturates every
    // channel and the plasma renders white instead of blue -- the apparent
    // brightness has to come from the bloom pass, not from driving the
    // material harder.
    // The usable band is narrow. Below the bloom threshold the core reads as
    // painted plastic; much above 1.5 every channel saturates and the plasma
    // renders white, losing the hue that is the whole point of it. These sit
    // deliberately just over the threshold, and the bloom does the rest.
    coreMaterial.emissiveIntensity = (1.25 + level * 0.6) * glow * themeGlow;
    plasma.emissive.copy(emissive);
    plasma.emissiveIntensity = 1.05 * glow * themeGlow;
    coreLight.color.copy(emissive);
    coreLight.intensity = (3.2 + level * 3) * glow * themeGlow;
    haloMaterial.color.copy(emissive);
    haloMaterial.opacity = 0.07 * themeGlow;

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
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
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


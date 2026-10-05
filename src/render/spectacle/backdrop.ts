import * as THREE from 'three';
import type { SpectacleQuality } from '../../../data/spectacle-quality';
import { createRng } from '../../core/rng/rng';
import type { BackdropDef, Structure } from '../spectacle-contract';
import { createPaletteBlend, lerpHex, wrapOffset, type PaletteBlend } from './backdrop-logic';
import { createGlowBatch, toLinear } from './glow-batch';

/**
 * The living backdrop: gas-cloud shader layers, twinkling star layers, one big far structure per
 * battle (a cel-shaded planet, a colony ring or a carrier), drifting rocks and distant battle
 * flashes, in the palette of the current battle (eased between battles). Render only: its own
 * seeded stream, fixed pools, everything parked at the camera and wrapped to the view.
 */

export interface BackdropFrame {
  camX: number;
  camY: number;
  /** Visible world size, u. */
  viewW: number;
  viewH: number;
  /** Wall-clock seconds (animation) and the seconds since the last frame. */
  time: number;
  dt: number;
  /** 1-based battle number (0 in practice mode). */
  battle: number;
  /** Enemy fighters alive: a busier fight means more distant flashes. */
  enemies: number;
}

export interface Backdrop {
  readonly object: THREE.Group;
  /** The sky colour right now (the renderer sets the scene background to it while this is on). */
  skyColor(): number;
  /** A kill excites the distant battle for a moment. */
  excite(amount: number): void;
  update(frame: BackdropFrame, def: BackdropDef, enabled: boolean): void;
  stats(): BackdropStats;
  dispose(): void;
}

export interface BackdropStats {
  nebulaLayers: number;
  starLayers: number;
  rocks: number;
  flashes: number;
  flashCap: number;
}

const SEED = 0x6a09e667;
const Z_BASE = -4;
/** Render orders: far to near (negative: before the ships' own transparent parts). */
const ORDER = { nebula: -20, structure: -19, stars: -18, rocks: -17, flashes: -16 } as const;
const STAR_LAYER = [
  { depth: 0.22, count: 60, size: 4.5 },
  { depth: 0.42, count: 40, size: 6 },
  { depth: 0.68, count: 26, size: 8 },
] as const;
const FLASH_LIFE = [0.35, 1] as const;
/** Flashes per second get this boost per unit of excitement, which decays at this rate (1/s). */
const EXCITE_GAIN = 2.4;
const EXCITE_DECAY = 0.6;
const FLASH_DEPTH = 0.15;

const NOISE = /* glsl */ `
  float hsh(vec2 p) { p = fract(p * vec2(123.34, 456.21) + uSeed); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }`;

const QUAD_VERT = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vP;
  varying vec2 vQ;
  void main() {
    vP = position.xy * uSize;
    vQ = position.xy * 2.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

function shader(
  fragment: string,
  uniforms: Record<string, THREE.IUniform>,
  blending: THREE.Blending,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: QUAD_VERT,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending,
  });
}

const NEBULA_FRAG = /* glsl */ `
  uniform vec3 uColA, uColB;
  uniform vec2 uOff;
  uniform float uScale, uAlpha, uTime, uSeed;
  varying vec2 vP;
  ${NOISE}
  void main() {
    vec2 p = (vP + uOff) / uScale;
    vec2 q = vec2(fbm(p + uTime * 0.01), fbm(p + vec2(5.2, 1.3) - uTime * 0.008));
    float d = fbm(p + 1.6 * q);
    float band = smoothstep(0.42, 0.8, d);
    float cel = mix(band, floor(band * 4.0 + 0.5) / 4.0, 0.5);
    vec3 col = mix(uColA, uColB, fbm(p * 0.7 + 9.0));
    float rim = smoothstep(0.0, 0.2, band) - smoothstep(0.2, 0.6, band);
    gl_FragColor = vec4(col * (0.55 + 0.9 * rim), cel * uAlpha);
    #include <colorspace_fragment>
  }`;

/** A cel-shaded planet with bands and a tilted ring: two tones cut by a hard terminator. */
const PLANET_FRAG = /* glsl */ `
  uniform vec3 uCol, uSky;
  uniform float uAlpha, uSeed;
  varying vec2 vQ;
  void main() {
    vec2 p = vQ / 0.55;
    float r = length(p);
    vec3 L = normalize(vec3(-0.6, 0.55, 0.55));
    // The ring: an ellipse tilted by 0.35 rad, drawn in front of the planet on its lower half only.
    float ca = cos(0.35), sa = sin(0.35);
    vec2 rp = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y);
    float rr = length(vec2(rp.x, rp.y / 0.26));
    float ring = step(1.22, rr) * step(rr, 1.75) * (1.0 - step(1.46, rr) * step(rr, 1.52));
    float front = step(rp.y, 0.0);
    vec4 outc = vec4(0.0);
    if (r < 1.0) {
      vec3 n = vec3(p, sqrt(max(0.0, 1.0 - r * r)));
      float lit = dot(n, L);
      float stripes = floor(p.y * 6.0 + sin(p.x * 2.5) * 0.35);
      float tone = 0.9 + 0.1 * mod(stripes, 2.0);
      vec3 day = uCol * tone * 0.85;
      vec3 night = mix(uSky, uCol, 0.18);
      vec3 col = lit > 0.12 ? day : (lit > -0.1 ? mix(day, night, 0.65) * 0.8 : night);
      float limb = smoothstep(0.93, 1.0, r) * step(0.0, lit + 0.25);
      col += uCol * 0.9 * limb;
      outc = vec4(col, 1.0);
    }
    if (ring > 0.0 && (front > 0.5 || r >= 1.0)) {
      vec3 rc = mix(uCol, vec3(1.0), 0.25) * (0.55 + 0.35 * step(1.0, mod(floor(rr * 14.0), 2.0)));
      outc = vec4(rc, 1.0);
    }
    gl_FragColor = vec4(outc.rgb, outc.a * uAlpha);
    #include <colorspace_fragment>
  }`;

/** A colony ring: a flattened wheel with spokes, a hub and lit windows. */
const RING_FRAG = /* glsl */ `
  uniform vec3 uCol, uSky;
  uniform float uAlpha, uSeed, uTime;
  varying vec2 vQ;
  float hsh(float x) { return fract(sin(x * 91.3458 + uSeed) * 47453.5453); }
  void main() {
    vec2 p = vQ / 0.9;
    float ca = cos(-0.5), sa = sin(-0.5);
    vec2 q = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
    q.y /= 0.5;
    float r = length(q);
    float a = atan(q.y, q.x);
    vec4 o = vec4(0.0);
    float band = step(0.72, r) * step(r, 0.9);
    float rim = step(0.9, r) * step(r, 0.935);
    float inner = step(0.68, r) * step(r, 0.72);
    float hub = step(r, 0.16);
    float spoke = step(r, 0.72) * step(0.16, r) * step(abs(sin(a * 3.0)), 0.045);
    float lit = step(0.0, dot(normalize(q + 1e-4), normalize(vec2(-0.6, 0.5)))) ;
    vec3 base = uCol * mix(0.45, 1.0, lit);
    if (band > 0.5) {
      float w = step(0.72, hsh(floor(a * 40.0))) * step(0.78, r) * step(r, 0.84);
      o = vec4(mix(base, vec3(1.6, 1.35, 0.8), w * (0.6 + 0.4 * sin(uTime * 1.3 + floor(a * 40.0)))), 1.0);
    }
    if (rim > 0.5) o = vec4(mix(base, uCol * 1.5, 0.7), 1.0);
    if (inner > 0.5) o = vec4(uCol * 0.3, 1.0);
    if (spoke > 0.5) o = vec4(base * 0.8, 1.0);
    if (hub > 0.5) o = vec4(mix(base, vec3(1.0, 0.95, 0.8), 0.45), 1.0);
    gl_FragColor = vec4(o.rgb, o.a * uAlpha);
    #include <colorspace_fragment>
  }`;

function rockGeometry(rng: ReturnType<typeof createRng>): THREE.BufferGeometry {
  const n = 8;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.62 + rng.next() * 0.38;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  return new THREE.ShapeGeometry(new THREE.Shape(pts));
}

export function createBackdrop(quality: SpectacleQuality, worldSeed: number): Backdrop {
  const rng = createRng((worldSeed ^ SEED) >>> 0);
  const group = new THREE.Group();
  group.position.z = Z_BASE;
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(o: T): T => {
    owned.push(o);
    return o;
  };
  const blend: PaletteBlend = createPaletteBlend();
  let excitement = 0;
  let flashAcc = 0;

  const quadGeo = own(new THREE.PlaneGeometry(1, 1));

  // Gas clouds: one full-view quad per layer, parallax by shifting the noise coordinates.
  const nebula = Array.from({ length: quality.nebulaLayers }, (_, i) => {
    const u = {
      uColA: { value: new THREE.Color() },
      uColB: { value: new THREE.Color() },
      uOff: { value: new THREE.Vector2() },
      uScale: { value: 2000 },
      uAlpha: { value: 0 },
      uTime: { value: 0 },
      uSeed: { value: 3.7 + i * 11.3 },
      uSize: { value: new THREE.Vector2(1, 1) },
    };
    const mesh = new THREE.Mesh(quadGeo, own(shader(NEBULA_FRAG, u, THREE.AdditiveBlending)));
    mesh.frustumCulled = false;
    mesh.renderOrder = ORDER.nebula + i * 0.1;
    mesh.position.z = -0.4 + i * 0.01;
    group.add(mesh);
    return { mesh, u, depth: 0.1 + i * 0.1 };
  });

  // Far structures: one of each kind exists; the one the battle's palette names is faded in.
  const structureDefs: Record<
    Exclude<Structure, 'none'>,
    { frag: string; at: [number, number]; size: number; depth: number }
  > = {
    planet: { frag: PLANET_FRAG, at: [0.28, 0.2], size: 0.8, depth: 0.03 },
    ring: { frag: RING_FRAG, at: [-0.26, 0.17], size: 1.05, depth: 0.045 },
    carrier: { frag: '', at: [0.2, -0.22], size: 0.85, depth: 0.07 },
  };
  const structures = (['planet', 'ring'] as const).map((kind) => {
    const u = {
      uCol: { value: new THREE.Color() },
      uSky: { value: new THREE.Color() },
      uAlpha: { value: 0 },
      uSeed: { value: kind === 'planet' ? 1.3 : 7.9 },
      uTime: { value: 0 },
      uSize: { value: new THREE.Vector2(1, 1) },
    };
    const mesh = new THREE.Mesh(
      quadGeo,
      own(shader(structureDefs[kind].frag, u, THREE.NormalBlending)),
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = ORDER.structure;
    mesh.position.z = -0.3;
    group.add(mesh);
    return { kind, mesh, u };
  });

  // The carrier: a tapered hull seen from above with sponsons, an island, panel lines, a lit deck
  // stripe, rows of lights and engine glow. Flat colours, a lighter edge facing the light.
  const carrierGroup = new THREE.Group();
  const poly = (pts: number[][]): THREE.ShapeGeometry =>
    own(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))));
  const carrierMat = (): THREE.MeshBasicMaterial =>
    own(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  const hullMat = carrierMat();
  const edgeMat = carrierMat();
  const islandMat = carrierMat();
  const panelMat = carrierMat();
  const deckMat = carrierMat();
  const mat = (m: THREE.Material, z: number, g: THREE.BufferGeometry): THREE.Mesh => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.z = z;
    return mesh;
  };
  const hullPts = [
    [-0.5, 0.06],
    [-0.46, 0.078],
    [0.2, 0.078],
    [0.36, 0.05],
    [0.5, 0.015],
    [0.5, -0.015],
    [0.36, -0.05],
    [0.2, -0.078],
    [-0.46, -0.078],
    [-0.5, -0.06],
  ];
  const hullGeo = poly(hullPts);
  const edge = mat(edgeMat, 0, hullGeo);
  edge.scale.set(1.012, 1.04, 1);
  edge.position.set(-0.004, 0.003, -0.001);
  carrierGroup.add(
    edge,
    mat(hullMat, 0.001, hullGeo),
    mat(
      hullMat,
      0.002,
      poly([
        [-0.3, 0.078],
        [-0.25, 0.108],
        [0.05, 0.108],
        [0.1, 0.078],
      ]),
    ),
    mat(
      hullMat,
      0.002,
      poly([
        [-0.3, -0.078],
        [-0.25, -0.108],
        [0.05, -0.108],
        [0.1, -0.078],
      ]),
    ),
    mat(
      islandMat,
      0.003,
      poly([
        [-0.14, 0.078],
        [-0.11, 0.128],
        [0.07, 0.128],
        [0.11, 0.078],
      ]),
    ),
    mat(
      islandMat,
      0.004,
      poly([
        [-0.07, 0.128],
        [-0.05, 0.158],
        [0.03, 0.158],
        [0.05, 0.128],
      ]),
    ),
    mat(deckMat, 0.003, own(new THREE.PlaneGeometry(0.78, 0.01)))
      .translateX(-0.05)
      .translateY(-0.02),
  );
  const panelGeo = own(new THREE.PlaneGeometry(0.004, 0.15));
  for (let i = 0; i < 12; i++)
    carrierGroup.add(mat(panelMat, 0.0035, panelGeo).translateX(-0.44 + i * 0.058));
  const lightGeo = own(new THREE.BufferGeometry());
  const lights: number[] = [];
  for (let i = 0; i < 28; i++)
    lights.push(-0.46 + i * 0.03, 0.045, 0.005, -0.46 + i * 0.03, -0.05, 0.005);
  lightGeo.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
  const lightMat = own(
    new THREE.PointsMaterial({
      size: 4,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const engineMat = own(
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  carrierGroup.add(new THREE.Points(lightGeo, lightMat));
  for (const y of [0.045, 0, -0.045]) {
    const m = new THREE.Mesh(quadGeo, engineMat);
    m.scale.set(0.07, 0.028, 1);
    m.position.set(-0.535, y, 0.004);
    carrierGroup.add(m);
  }
  carrierGroup.position.z = -0.3;
  group.add(carrierGroup);
  carrierGroup.traverse((o) => (o.renderOrder = ORDER.structure));

  // Extra twinkling star layers, wrapped to the view.
  const starLayers = Array.from({ length: quality.extraStars }, (_, i) => {
    const spec = STAR_LAYER[i]!;
    const count = spec.count;
    const u = new Float32Array(count * 2);
    const phase = new Float32Array(count);
    const pos = new Float32Array(count * 3);
    for (let k = 0; k < count; k++) {
      u[k * 2] = rng.next();
      u[k * 2 + 1] = rng.next();
      phase[k] = rng.next();
    }
    const geo = own(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aU', new THREE.BufferAttribute(u, 2));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const uniforms = {
      uShift: { value: new THREE.Vector2() },
      uBox: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uSize: { value: spec.size },
      uTwinkle: { value: 0.5 },
      uColor: { value: new THREE.Color() },
    };
    const mat = own(
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform vec2 uShift, uBox; uniform float uTime, uSize, uTwinkle;
          attribute vec2 aU; attribute float aPhase;
          varying float vA;
          void main() {
            vec2 f = fract(aU - uShift / uBox + 0.5) - 0.5;
            vA = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (1.5 + aPhase * 3.0) + aPhase * 40.0));
            gl_PointSize = uSize * (0.7 + 0.6 * fract(aPhase * 7.0));
            gl_Position = projectionMatrix * modelViewMatrix * vec4(f * uBox, 0.0, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(uColor * (0.8 + 1.4 * a), a * vA);
            #include <colorspace_fragment>
          }`,
      }),
    );
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = ORDER.stars;
    pts.position.z = 0.2;
    group.add(pts);
    return { pts, uniforms, depth: spec.depth };
  });

  // Drifting rocks and wreckage: two instanced polygons (dark body, lighter rim) sharing a pose.
  const ROCKS = quality.debris;
  const rockGeo = own(rockGeometry(rng));
  const rockBody = own(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const rockRim = own(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const bodyMesh = new THREE.InstancedMesh(rockGeo, rockBody, Math.max(1, ROCKS));
  const rimMesh = new THREE.InstancedMesh(rockGeo, rockRim, Math.max(1, ROCKS));
  for (const m of [bodyMesh, rimMesh]) {
    m.frustumCulled = false;
    m.count = 0;
    group.add(m);
  }
  bodyMesh.position.z = 0.1;
  rimMesh.position.z = 0.09;
  const rock = {
    u: new Float32Array(ROCKS * 2),
    size: new Float32Array(ROCKS),
    stretch: new Float32Array(ROCKS),
    rot: new Float32Array(ROCKS),
    spin: new Float32Array(ROCKS),
    drift: new Float32Array(ROCKS * 2),
  };
  for (let i = 0; i < ROCKS; i++) {
    rock.u[i * 2] = rng.next();
    rock.u[i * 2 + 1] = rng.next();
    rock.size[i] = rng.next(); // 0..1 within the size range
    rock.stretch[i] = rng.range(0.6, 1.9);
    rock.rot[i] = rng.range(0, Math.PI * 2);
    rock.spin[i] = rng.range(-0.25, 0.25);
    rock.drift[i * 2] = rng.range(-1, 1);
    rock.drift[i * 2 + 1] = rng.range(-1, 1);
  }
  const dummy = new THREE.Object3D();

  // Distant flashes.
  const FC = quality.flashes;
  const fl = {
    x: new Float32Array(FC),
    y: new Float32Array(FC),
    age: new Float32Array(FC),
    life: new Float32Array(FC),
    size: new Float32Array(FC),
    spin: new Float32Array(FC),
  };
  let flashCount = 0;
  const flashBatch = createGlowBatch(
    FC * (12 * 3 + 28 * 6 + 12 * 3 + 24) + 24,
    ORDER.flashes,
    'add',
    -0.2,
    true,
  );
  group.add(flashBatch.mesh);
  const glowRgb = [0, 0, 0, 1];
  const inner = [0, 0, 0, 1];
  const outer = [0, 0, 0, 0];

  const tmpSky = new THREE.Color();
  const tmpBase = new THREE.Color();

  return {
    object: group,
    skyColor: () => blend.colors.sky,
    excite(amount) {
      excitement = Math.min(3, excitement + amount);
    },
    update(f, def, enabled) {
      group.visible = enabled;
      blend.step(enabled ? f.dt : 0, f.battle, def);
      if (!enabled) return;
      const c = blend.colors;
      group.position.x = f.camX;
      group.position.y = f.camY;
      tmpSky.setHex(c.sky);

      // Gas clouds.
      const layers = Math.min(nebula.length, def.nebula.layers);
      nebula.forEach((l, i) => {
        l.mesh.visible = i < layers;
        if (i >= layers) return;
        l.mesh.scale.set(f.viewW, f.viewH, 1);
        l.u.uSize.value.set(f.viewW, f.viewH);
        l.u.uScale.value = def.nebula.scale * (1 - i * 0.28);
        const drift = f.time * def.nebula.drift * (1 + i * 0.4);
        l.u.uOff.value.set(f.camX * l.depth + drift, f.camY * l.depth + drift * 0.35);
        l.u.uColA.value.setHex(i % 2 === 0 ? c.nebulaA : c.nebulaB);
        l.u.uColB.value.setHex(i % 2 === 0 ? c.nebulaB : c.nebulaA);
        l.u.uAlpha.value = def.nebula.strength * (1 - i * 0.22);
        l.u.uTime.value = f.time;
      });

      // Far structures (matte-painting style: sized and placed by view fractions, tiny parallax).
      for (const s of structures) {
        const a = blend.structureAlpha(s.kind);
        s.mesh.visible = a > 0.01;
        if (!s.mesh.visible) continue;
        const d = structureDefs[s.kind];
        const size = d.size * f.viewH;
        s.mesh.scale.set(size, size, 1);
        s.mesh.position.x = d.at[0] * f.viewW - f.camX * d.depth;
        s.mesh.position.y = d.at[1] * f.viewH - f.camY * d.depth;
        s.u.uCol.value.setHex(c.structureColor);
        s.u.uSky.value.setHex(c.sky);
        s.u.uAlpha.value = a;
        s.u.uTime.value = f.time;
      }
      const ca = blend.structureAlpha('carrier');
      carrierGroup.visible = ca > 0.01;
      if (carrierGroup.visible) {
        const d = structureDefs.carrier;
        const len = d.size * f.viewH;
        carrierGroup.scale.set(len, len, 1);
        // The carrier creeps along its length: a slow drift on top of the parallax.
        carrierGroup.position.x =
          d.at[0] * f.viewW - f.camX * d.depth + Math.sin(f.time * 0.02) * 0.03 * f.viewW;
        carrierGroup.position.y = d.at[1] * f.viewH - f.camY * d.depth;
        carrierGroup.rotation.z = 0.28;
        tmpBase.setHex(c.structureColor);
        hullMat.color.copy(tmpBase).multiplyScalar(0.32).lerp(tmpSky, 0.3);
        edgeMat.color.copy(tmpBase).multiplyScalar(0.95);
        islandMat.color.copy(tmpBase).multiplyScalar(0.55).lerp(tmpSky, 0.15);
        panelMat.color.copy(tmpBase).multiplyScalar(0.2).lerp(tmpSky, 0.4);
        deckMat.color.copy(tmpBase).multiplyScalar(0.8);
        engineMat.color.setRGB(1.6, 1.2, 0.8);
        lightMat.color.setRGB(1.4, 1.3, 0.9);
        hullMat.opacity =
          edgeMat.opacity =
          islandMat.opacity =
          panelMat.opacity =
          deckMat.opacity =
            ca;
        engineMat.opacity = ca * (0.8 + 0.2 * Math.sin(f.time * 3));
        lightMat.opacity = ca * (0.55 + 0.45 * Math.sin(f.time * 2.1));
      }

      // Star layers.
      const stars = Math.min(starLayers.length, def.stars.extraLayers);
      starLayers.forEach((s, i) => {
        s.pts.visible = i < stars;
        if (i >= stars) return;
        s.uniforms.uShift.value.set(f.camX * s.depth, f.camY * s.depth);
        s.uniforms.uBox.value.set(f.viewW * 1.1, f.viewH * 1.1);
        s.uniforms.uTime.value = f.time;
        s.uniforms.uTwinkle.value = def.stars.twinkle;
        s.uniforms.uColor.value.setHex(lerpHex(c.star, 0xffffff, 0.35));
      });

      // Rocks.
      const count = Math.min(ROCKS, def.debris.count);
      const boxW = f.viewW * 1.15;
      const boxH = f.viewH * 1.15;
      const shiftX = f.camX * def.debris.depth;
      const shiftY = f.camY * def.debris.depth;
      rockBody.color.setHex(lerpHex(c.sky, c.star, 0.14));
      rockRim.color.setHex(lerpHex(c.sky, c.structureColor, 0.55));
      const [minS, maxS] = def.debris.size;
      for (let i = 0; i < count; i++) {
        const s = minS + (maxS - minS) * rock.size[i]! * rock.size[i]!;
        const x = wrapOffset(rock.u[i * 2]!, shiftX - f.time * rock.drift[i * 2]! * 6, boxW);
        const y = wrapOffset(
          rock.u[i * 2 + 1]!,
          shiftY - f.time * rock.drift[i * 2 + 1]! * 6,
          boxH,
        );
        const a = rock.rot[i]! + f.time * rock.spin[i]!;
        dummy.position.set(x, y, 0);
        dummy.rotation.z = a;
        dummy.scale.set(s * rock.stretch[i]!, s, 1);
        dummy.updateMatrix();
        bodyMesh.setMatrixAt(i, dummy.matrix);
        // The rim is the same rock, a bit smaller and nudged towards the light (upper left).
        dummy.position.set(x - s * 0.12, y + s * 0.1, 0);
        dummy.scale.set(s * rock.stretch[i]! * 1.04, s * 1.04, 1);
        dummy.updateMatrix();
        rimMesh.setMatrixAt(i, dummy.matrix);
      }
      bodyMesh.count = rimMesh.count = count;
      bodyMesh.instanceMatrix.needsUpdate = true;
      rimMesh.instanceMatrix.needsUpdate = true;

      // Distant battle flashes: age, spawn (a busier fight and recent kills spawn more), draw.
      excitement = Math.max(0, excitement - EXCITE_DECAY * f.dt);
      const cap = Math.min(FC, Math.round(quality.flashes));
      const activity = 0.35 + Math.min(1.4, f.enemies * 0.12) + excitement * EXCITE_GAIN * 0.3;
      flashAcc += def.flashes.rate * activity * f.dt;
      while (flashAcc >= 1) {
        flashAcc -= 1;
        if (flashCount >= cap) continue;
        const i = flashCount++;
        fl.x[i] = f.camX * FLASH_DEPTH + rng.range(-0.55, 0.55) * f.viewW;
        fl.y[i] = f.camY * FLASH_DEPTH + rng.range(-0.55, 0.55) * f.viewH;
        fl.age[i] = 0;
        fl.life[i] = rng.range(FLASH_LIFE[0], FLASH_LIFE[1]);
        fl.size[i] = def.flashes.size * rng.range(0.5, 1.4) * (f.viewH / 2000 + 0.5);
        fl.spin[i] = rng.range(0, Math.PI);
      }
      toLinear(c.glow, glowRgb);
      flashBatch.reset();
      for (let i = flashCount - 1; i >= 0; i--) {
        fl.age[i]! += f.dt;
        const t = fl.age[i]! / fl.life[i]!;
        if (t >= 1) {
          const last = --flashCount;
          if (i !== last) {
            fl.x[i] = fl.x[last]!;
            fl.y[i] = fl.y[last]!;
            fl.age[i] = fl.age[last]!;
            fl.life[i] = fl.life[last]!;
            fl.size[i] = fl.size[last]!;
            fl.spin[i] = fl.spin[last]!;
          }
          continue;
        }
        // A quick bright pop that swells and fades, with a ring and a cross glint at the start.
        const k = 1 - t;
        const x = fl.x[i]! - f.camX * FLASH_DEPTH;
        const y = fl.y[i]! - f.camY * FLASH_DEPTH;
        const size = fl.size[i]! * (0.4 + 0.9 * (1 - k * k));
        inner[0] = glowRgb[0]! * 1.6;
        inner[1] = glowRgb[1]! * 1.6;
        inner[2] = glowRgb[2]! * 1.6;
        inner[3] = 0.85 * k * k;
        outer[0] = glowRgb[0]!;
        outer[1] = glowRgb[1]!;
        outer[2] = glowRgb[2]!;
        outer[3] = 0;
        flashBatch.disc(x, y, size, 12, 0, inner, outer);
        inner[3] = 0.5 * k;
        outer[3] = 0.5 * k;
        flashBatch.ring(x, y, size * (0.8 + t), size * 0.08 * k, 28, inner, outer);
        if (t < 0.4) {
          inner[3] = 0.9 * (1 - t / 0.4);
          outer[3] = 0;
          flashBatch.star(x, y, size * 1.7, size * 0.06, fl.spin[i]!, inner, outer);
        }
      }
      flashBatch.finish();
    },
    stats: () => ({
      nebulaLayers: nebula.filter((l) => l.mesh.visible).length,
      starLayers: starLayers.filter((l) => l.pts.visible).length,
      rocks: bodyMesh.count,
      flashes: flashCount,
      flashCap: FC,
    }),
    dispose() {
      for (const o of owned) o.dispose();
      flashBatch.dispose();
      bodyMesh.dispose();
      rimMesh.dispose();
    },
  };
}

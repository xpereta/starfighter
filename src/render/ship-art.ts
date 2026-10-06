import * as THREE from 'three';
import { discTriangles, ringOutline, shadowFor } from './shape-geometry';
import { buildParts } from './shape-parts';
import { SHAPE_FALLBACK, type Point, type ShapeKind } from './style';
import { activeStyle, styleRevision } from './style-active';

/** Hard shadow tone: the fill colour times this. */
const SHADOW_TONE = 0.55;
/** Engine glow disc radius (radius units), and the halo around it as a multiple. */
const GLOW_RADIUS = 0.14;
const HALO_SCALE = 2.2;
const HALO_OPACITY = 0.45;
const GLOW_SEGMENTS = 12;
/** How much white the glow core mixes into the faction colour. */
const GLOW_WHITE = 0.7;
/** The glow never goes fully dark at idle: this share of full at zero thrust. */
const GLOW_IDLE = 0.35;
/** Layer offsets inside one ship, so the parts never z-fight. */
const Z_OUTLINE = 0;
const Z_GLOW = 0.01;
const Z_FILL = 0.02;
const Z_SHADOW = 0.03;
const Z_EYE = 0.04;
/** Layered parts: below the shadow, and (glass and glow roles) above it but under the eye. */
const Z_PARTS = 0.0205;
const Z_LIGHTS = 0.0305;

/** The player's shape is authored in radius units; this is its drawn size (about 100 u long). */
export const PLAYER_SCALE = 60;

/** Narrowest a ship gets mid-roll, so it never vanishes. */
export const MIN_ROLL_WIDTH = 0.15;

export interface ShipPose {
  x: number;
  y: number;
  /** Heading, radians; the shape's nose points along +x at heading 0. */
  heading: number;
  /** Drawn size: world units per shape unit. */
  scale: number;
  /** Wingspan squash 0..1 (evade roll); 1 = flat on. */
  squash?: number;
  /** Thrust 0..1: brightness of the engine glow. */
  thrust?: number;
}

export interface ShipArt {
  readonly object: THREE.Group;
  /** Places and shows the ship; rebuilds its meshes if the style changed. */
  update(pose: ShipPose): void;
  hide(): void;
  dispose(): void;
}

function shapeOf(points: readonly Point[], hole?: readonly Point[]): THREE.Shape {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  if (hole) s.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}

function trianglesGeometry(positions: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  return g;
}

/** A mesh of vertex-coloured triangles (x, y, z triples and linear RGB triples). */
function partsMesh(
  own: <T extends { dispose(): void }>(o: T) => T,
  positions: number[],
  colors: number[],
  z: number,
): THREE.Mesh {
  const g = own(new THREE.BufferGeometry());
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  const m = own(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const out = new THREE.Mesh(g, m);
  out.position.z = z;
  return out;
}

const mesh = (g: THREE.BufferGeometry, m: THREE.Material, z: number): THREE.Mesh => {
  const out = new THREE.Mesh(g, m);
  out.position.z = z;
  return out;
};

/**
 * One drawn ship: outline, glow, fill, hard shadow and eye, all built from the active style's
 * shape for `kind` and its theme (outline width and colour, shadow share, glow). The meshes are
 * rebuilt when the style revision or the drawn size changes (a theme edit in the panel), never per
 * frame otherwise. `color` gives the fill colour (faction colour from the palette).
 */
export function createShipArt(kind: ShapeKind, color: () => number): ShipArt {
  const group = new THREE.Group();
  group.visible = false;
  let built = '';
  let glowMaterial: THREE.MeshBasicMaterial | null = null;
  let haloMaterial: THREE.MeshBasicMaterial | null = null;
  const owned: { dispose(): void }[] = [];

  const clear = (): void => {
    for (const o of owned) o.dispose();
    owned.length = 0;
    group.clear();
    glowMaterial = null;
    haloMaterial = null;
  };

  const build = (scale: number): void => {
    clear();
    const style = activeStyle();
    const fallback = SHAPE_FALLBACK[kind];
    const def = style.ships[kind] ?? (fallback ? style.ships[fallback] : undefined);
    if (!def) return; // an optional kind this pack has no shape for: nothing to draw
    const theme = style.theme;
    const own = <T extends { dispose(): void }>(o: T): T => {
      owned.push(o);
      return o;
    };
    const fill = color();
    const flat = (c: number, extra?: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial =>
      own(new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, ...extra }));
    const glowParams = {
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    };

    const layered = !!def.parts?.length;
    // A layered ship is one vertex-coloured mesh: outline, fill, parts, lights and eye together
    // (depth orders them), so it costs one draw call plus the shadow and the glow.
    const solid: { positions: number[]; colors: number[] } = { positions: [], colors: [] };
    const addSolid = (tris: ArrayLike<number>, hex: number, z: number): void => {
      const c = new THREE.Color(hex);
      for (let i = 0; i < tris.length; i += 3) {
        solid.positions.push(tris[i]!, tris[i + 1]!, z);
        solid.colors.push(c.r, c.g, c.b);
      }
    };
    const addShape = (
      points: readonly Point[],
      hole: readonly Point[] | undefined,
      hex: number,
      z: number,
    ): void => {
      const g = new THREE.ShapeGeometry(shapeOf(points, hole));
      const pos = g.getAttribute('position');
      const idx = g.getIndex();
      const flatTris: number[] = [];
      const count = idx ? idx.count : pos.count;
      for (let i = 0; i < count; i++) {
        const v = idx ? idx.getX(i) : i;
        flatTris.push(pos.getX(v), pos.getY(v), 0);
      }
      g.dispose();
      addSolid(flatTris, hex, z);
    };
    if (theme.outlineWidth > 0) {
      // Width is in world units: divide by the drawn size to get shape units.
      const w = theme.outlineWidth / Math.max(scale, 1e-6);
      const tris = ringOutline(def.polygon, w, true);
      if (def.hole) tris.push(...ringOutline(def.hole, w, false));
      if (layered) addSolid(tris, theme.outlineColor, Z_OUTLINE);
      else group.add(mesh(own(trianglesGeometry(tris)), flat(theme.outlineColor), Z_OUTLINE));
    }
    if (theme.glow > 0 && def.glow?.length) {
      const core: number[] = [];
      const halo: number[] = [];
      for (const [x, y] of def.glow) {
        core.push(...discTriangles(x, y, GLOW_RADIUS, GLOW_SEGMENTS));
        halo.push(...discTriangles(x, y, GLOW_RADIUS * HALO_SCALE, GLOW_SEGMENTS));
      }
      const tint = def.glowColor ?? fill;
      const bright = new THREE.Color(tint).lerp(new THREE.Color(0xffffff), GLOW_WHITE).getHex();
      haloMaterial = flat(tint, glowParams);
      glowMaterial = flat(bright, glowParams);
      group.add(mesh(own(trianglesGeometry(halo)), haloMaterial, Z_GLOW));
      group.add(mesh(own(trianglesGeometry(core)), glowMaterial, Z_GLOW + 0.001));
    }
    if (layered) {
      addShape(def.polygon, def.hole, fill, Z_FILL);
      const built = buildParts(def, fill, theme.partColors, Z_PARTS, Z_LIGHTS);
      for (const part of [built.body, built.lights]) {
        solid.positions.push(...part.positions);
        solid.colors.push(...part.colors);
      }
    } else {
      const body = new THREE.ShapeGeometry(shapeOf(def.polygon, def.hole));
      group.add(mesh(own(body), flat(fill), Z_FILL));
    }
    if (def.shadow && theme.shadowShare > 0) {
      const cut = shadowFor(def.shadow, theme.shadowShare);
      if (cut.length >= 3) {
        if (layered) {
          // Parts carry their own colours, so the shade is a translucent darkening over all of them.
          group.add(
            mesh(
              own(new THREE.ShapeGeometry(shapeOf(cut))),
              flat(0x000000, { transparent: true, opacity: 1 - SHADOW_TONE, depthWrite: false }),
              Z_SHADOW,
            ),
          );
        } else {
          const tone = new THREE.Color(fill).multiplyScalar(SHADOW_TONE).getHex();
          group.add(mesh(own(new THREE.ShapeGeometry(shapeOf(cut))), flat(tone), Z_SHADOW));
        }
      }
    }
    if (def.eye) {
      if (layered) addShape(def.eye, undefined, theme.eyeColor, Z_EYE);
      else
        group.add(
          mesh(own(new THREE.ShapeGeometry(shapeOf(def.eye))), flat(theme.eyeColor), Z_EYE),
        );
    }
    if (layered && solid.positions.length)
      group.add(partsMesh(own, solid.positions, solid.colors, 0));
  };

  return {
    object: group,
    update(pose) {
      const key = `${styleRevision()}|${pose.scale.toFixed(3)}`;
      if (key !== built) {
        built = key;
        build(pose.scale);
      }
      group.visible = true;
      group.position.x = pose.x;
      group.position.y = pose.y;
      group.rotation.z = pose.heading;
      group.scale.set(pose.scale, pose.scale * (pose.squash ?? 1), 1);
      if (glowMaterial && haloMaterial) {
        const strength = activeStyle().theme.glow;
        const thrust = GLOW_IDLE + (1 - GLOW_IDLE) * (pose.thrust ?? 1);
        glowMaterial.opacity = strength * thrust;
        haloMaterial.opacity = strength * thrust * HALO_OPACITY;
      }
    },
    hide() {
      group.visible = false;
    },
    dispose() {
      clear();
    },
  };
}

/** Wingspan squash of an evade roll, like a barrel roll seen from above. */
export function rollSquash(roll: number): number {
  return roll === 0 ? 1 : Math.max(MIN_ROLL_WIDTH, Math.abs(Math.cos(roll)));
}

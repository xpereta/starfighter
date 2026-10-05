import * as THREE from 'three';
import { discTriangles, ringOutline, shadowFor } from './shape-geometry';
import type { Point, ShipKind } from './style';
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
export function createShipArt(kind: ShipKind, color: () => number): ShipArt {
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
    const def = style.ships[kind]!;
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

    if (theme.outlineWidth > 0) {
      // Width is in world units: divide by the drawn size to get shape units.
      const w = theme.outlineWidth / Math.max(scale, 1e-6);
      const tris = ringOutline(def.polygon, w, true);
      if (def.hole) tris.push(...ringOutline(def.hole, w, false));
      group.add(mesh(own(trianglesGeometry(tris)), flat(theme.outlineColor), Z_OUTLINE));
    }
    if (theme.glow > 0 && def.glow?.length) {
      const core: number[] = [];
      const halo: number[] = [];
      for (const [x, y] of def.glow) {
        core.push(...discTriangles(x, y, GLOW_RADIUS, GLOW_SEGMENTS));
        halo.push(...discTriangles(x, y, GLOW_RADIUS * HALO_SCALE, GLOW_SEGMENTS));
      }
      const bright = new THREE.Color(fill).lerp(new THREE.Color(0xffffff), GLOW_WHITE).getHex();
      haloMaterial = flat(fill, glowParams);
      glowMaterial = flat(bright, glowParams);
      group.add(mesh(own(trianglesGeometry(halo)), haloMaterial, Z_GLOW));
      group.add(mesh(own(trianglesGeometry(core)), glowMaterial, Z_GLOW + 0.001));
    }
    const body = new THREE.ShapeGeometry(shapeOf(def.polygon, def.hole));
    group.add(mesh(own(body), flat(fill), Z_FILL));
    if (def.shadow && theme.shadowShare > 0) {
      const cut = shadowFor(def.shadow, theme.shadowShare);
      if (cut.length >= 3) {
        const tone = new THREE.Color(fill).multiplyScalar(SHADOW_TONE).getHex();
        group.add(mesh(own(new THREE.ShapeGeometry(shapeOf(cut))), flat(tone), Z_SHADOW));
      }
    }
    if (def.eye) {
      group.add(mesh(own(new THREE.ShapeGeometry(shapeOf(def.eye))), flat(theme.eyeColor), Z_EYE));
    }
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

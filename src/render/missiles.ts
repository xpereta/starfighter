import * as THREE from 'three';
import type { World } from '../core/world/world';
import { createBulletRenderer, type BulletRenderer } from './bullets';
import { createTrailStore, TRAIL_POINTS, type TrailStore } from './missile-trails';
import { palette } from './palette';

const BODY = { length: 26, width: 8 };
/** Trail ribbon width at the missile, in world units; it tapers to nothing at the tail. */
const TRAIL_WIDTH = 9;
const TRAIL_ALPHA = 0.85;
const VERTICES_PER_SEGMENT = 6; // two triangles

export interface MissileRenderer {
  readonly object: THREE.Group;
  /** Draws the missiles and their trails. `frameDt` is wall-clock seconds (it ages fading trails). */
  update(world: World, frameDt: number): void;
  dispose(): void;
}

/**
 * Missile bodies (one instanced draw, like bullets) and fading trails (one mesh of tapered
 * ribbons). Wingman missiles are in the same pool, so they look identical to the player's.
 */
export function createMissileRenderer(capacity: number): MissileRenderer {
  const group = new THREE.Group();
  group.position.z = 0.55;

  const bodies: BulletRenderer = createBulletRenderer(capacity, palette.missile, BODY);
  bodies.object.position.z = 0;
  group.add(bodies.object);

  const trails: TrailStore = createTrailStore(capacity);
  const maxVertices = capacity * (TRAIL_POINTS - 1) * VERTICES_PER_SEGMENT;
  const positions = new Float32Array(maxVertices * 3);
  const colors = new Float32Array(maxVertices * 4); // RGBA: alpha fades the tail out
  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  const colorAttr = new THREE.BufferAttribute(colors, 4);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  colorAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttr);
  geometry.setAttribute('color', colorAttr);
  geometry.setDrawRange(0, 0);
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.frustumCulled = false;
  ribbon.position.z = -0.01;
  group.add(ribbon);

  const color = new THREE.Color(palette.missile);
  let vertices = 0;

  const put = (x: number, y: number, alpha: number): void => {
    const p = vertices * 3;
    positions[p] = x;
    positions[p + 1] = y;
    const c = vertices * 4;
    colors[c] = color.r;
    colors[c + 1] = color.g;
    colors[c + 2] = color.b;
    colors[c + 3] = alpha * TRAIL_ALPHA;
    vertices++;
  };

  /** One ribbon segment from (x1,y1) to (x2,y2): the tail end is narrower and fainter than the head end. */
  const writeSegment = (x1: number, y1: number, x2: number, y2: number, alpha: number): void => {
    if (vertices + VERTICES_PER_SEGMENT > maxVertices) return;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) return;
    const tailAlpha = alpha * 0.5;
    const nx = -dy / len;
    const ny = dx / len;
    const hw1 = (TRAIL_WIDTH / 2) * tailAlpha;
    const hw2 = (TRAIL_WIDTH / 2) * alpha;
    const ax = x1 + nx * hw1;
    const ay = y1 + ny * hw1;
    const bx = x1 - nx * hw1;
    const by = y1 - ny * hw1;
    const cx = x2 + nx * hw2;
    const cy = y2 + ny * hw2;
    const ex = x2 - nx * hw2;
    const ey = y2 - ny * hw2;
    put(ax, ay, tailAlpha);
    put(bx, by, tailAlpha);
    put(cx, cy, alpha);
    put(bx, by, tailAlpha);
    put(ex, ey, alpha);
    put(cx, cy, alpha);
  };

  return {
    object: group,
    update(world, frameDt) {
      const m = world.missiles;
      bodies.update(m);
      trails.update(m.data.uid, m.data.x, m.data.y, m.count, world.tick, frameDt);
      vertices = 0;
      trails.forEachSegment(writeSegment);
      geometry.setDrawRange(0, vertices);
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    },
    dispose() {
      bodies.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}

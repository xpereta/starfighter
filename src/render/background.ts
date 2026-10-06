import * as THREE from 'three';
import { createRng } from '../core/rng/rng';
import { cameraParams } from '../../data/tuning/camera';
import { glowGeometry, isSoftGlow } from './backdrop';
import { palette } from './palette';
import { activeStyle, styleRevision } from './style-active';
import { coverTile, layerShift, streak } from './view';

/** Star counts below are per BASE_TILE x BASE_TILE area; the tile grows with the largest allowed view. */
const BASE_TILE = 2400;
const TILE = coverTile(cameraParams.viewMax.max);
const DENSITY = (TILE / BASE_TILE) ** 2;
const BACKGROUND_SEED = 90210;

/** Far to near. depth < 1 scrolls slower than the world, giving parallax. */
const STAR_LAYERS = [
  { depth: 0.1, count: 110, size: 1.5, opacity: 0.35 },
  { depth: 0.3, count: 70, size: 2, opacity: 0.55 },
  { depth: 0.55, count: 45, size: 2.5, opacity: 0.8 },
] as const;
const DUST = { depth: 1.2, count: 40 } as const;
/** Film grain (a style's `backdrop.grain`) scrolls a little against the world, like very distant dust. */
const GRAIN_DEPTH = 0.2;
const GRAIN_SEED = 31337;

/** Base pattern in [-TILE/2, TILE/2)^2 repeated over 3x3 tiles so one group always covers the view. */
function tiledPositions(count: number, rng: ReturnType<typeof createRng>): Float32Array {
  const base: [number, number][] = [];
  for (let i = 0; i < count; i++)
    base.push([rng.range(-TILE / 2, TILE / 2), rng.range(-TILE / 2, TILE / 2)]);
  const out = new Float32Array(count * 9 * 3);
  let k = 0;
  for (let ty = -1; ty <= 1; ty++) {
    for (let tx = -1; tx <= 1; tx++) {
      for (const [x, y] of base) {
        out[k++] = x + tx * TILE;
        out[k++] = y + ty * TILE;
        out[k++] = 0;
      }
    }
  }
  return out;
}

export interface Background {
  readonly object: THREE.Group;
  /**
   * Camera position, ship velocity and 0..1 speed factor; `view` is the visible area in world units
   * (the style's backdrop glows are sized and placed as fractions of it; omitted = no backdrop glows).
   */
  update(
    camX: number,
    camY: number,
    vx: number,
    vy: number,
    speedFactor: number,
    view?: { width: number; height: number },
  ): void;
  dispose(): void;
}

export function createBackground(): Background {
  const rng = createRng(BACKGROUND_SEED);
  const group = new THREE.Group();
  group.position.z = -5;
  const disposables: { dispose(): void }[] = [];

  const starGroups = STAR_LAYERS.map((layer) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(tiledPositions(Math.round(layer.count * DENSITY), rng), 3),
    );
    const material = new THREE.PointsMaterial({
      color: palette.star,
      size: layer.size,
      sizeAttenuation: false,
      transparent: true,
      opacity: layer.opacity,
      depthWrite: false,
    });
    disposables.push(geometry, material);
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    group.add(points);
    return points;
  });

  // Dust streaks: fixed anchor points; the far end is moved along the velocity each frame.
  const anchors = tiledPositions(Math.round(DUST.count * DENSITY), rng);
  const dustCount = anchors.length / 3;
  const segmentPositions = new Float32Array(dustCount * 2 * 3);
  const dustGeometry = new THREE.BufferGeometry();
  const segmentAttr = new THREE.BufferAttribute(segmentPositions, 3);
  segmentAttr.setUsage(THREE.DynamicDrawUsage);
  dustGeometry.setAttribute('position', segmentAttr);
  const dustMaterial = new THREE.LineBasicMaterial({
    color: palette.dust,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  disposables.push(dustGeometry, dustMaterial);
  const dust = new THREE.LineSegments(dustGeometry, dustMaterial);
  dust.frustumCulled = false;
  dust.position.z = 1;
  group.add(dust);

  // The style's backdrop: soft glows and planets (one mesh each, placed per frame) and grain.
  // Built from the active style and rebuilt when it changes (panel edit, peek).
  const backdrop = new THREE.Group();
  group.add(backdrop);
  const glowMeshes: { mesh: THREE.Mesh; x: number; y: number; radius: number; drift: number }[] =
    [];
  let grain: THREE.Points | null = null;
  let backdropOwned: { dispose(): void }[] = [];
  let builtRevision = -1;

  const rebuildBackdrop = (): void => {
    for (const d of backdropOwned) d.dispose();
    backdropOwned = [];
    backdrop.clear();
    glowMeshes.length = 0;
    grain = null;
    builtRevision = styleRevision();
    for (const points of starGroups)
      (points.material as THREE.PointsMaterial).color.setHex(palette.star);
    dustMaterial.color.setHex(palette.dust);
    const def = activeStyle().theme.backdrop;
    if (!def) return;
    def.glows.forEach((g, i) => {
      const geometry = glowGeometry(g);
      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: isSoftGlow(g) ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      backdropOwned.push(geometry, material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = -1 + i * 0.01;
      mesh.frustumCulled = false;
      backdrop.add(mesh);
      glowMeshes.push({ mesh, x: g.x, y: g.y, radius: g.radius, drift: g.drift });
    });
    if (def.grain && def.grain.count > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
          tiledPositions(Math.round(def.grain.count * DENSITY), createRng(GRAIN_SEED)),
          3,
        ),
      );
      const material = new THREE.PointsMaterial({
        color: def.grain.color,
        size: def.grain.size,
        sizeAttenuation: false,
        transparent: true,
        opacity: def.grain.opacity,
        depthWrite: false,
      });
      backdropOwned.push(geometry, material);
      grain = new THREE.Points(geometry, material);
      grain.frustumCulled = false;
      grain.position.z = -0.5;
      backdrop.add(grain);
    }
  };
  rebuildBackdrop();

  return {
    object: group,
    update(camX, camY, vx, vy, speedFactor, view) {
      if (styleRevision() !== builtRevision) rebuildBackdrop();
      if (grain) {
        grain.position.x = layerShift(camX, GRAIN_DEPTH, TILE) - camX;
        grain.position.y = layerShift(camY, GRAIN_DEPTH, TILE) - camY;
      }
      for (const g of glowMeshes) {
        g.mesh.visible = view !== undefined;
        if (!view) continue;
        // The group sits at the camera: a glow is placed on the screen, sliding against the camera by its drift.
        g.mesh.position.x = (g.x * view.width) / 2 - camX * g.drift;
        g.mesh.position.y = (g.y * view.width) / 2 - camY * g.drift;
        g.mesh.scale.setScalar(g.radius * view.width);
      }
      // The group is parked at the camera; each layer shifts inside it.
      starGroups.forEach((points, i) => {
        const depth = STAR_LAYERS[i]!.depth;
        points.position.set(
          layerShift(camX, depth, TILE) - camX,
          layerShift(camY, depth, TILE) - camY,
          0,
        );
      });
      group.position.x = camX;
      group.position.y = camY;
      dust.position.x = layerShift(camX, DUST.depth, TILE) - camX;
      dust.position.y = layerShift(camY, DUST.depth, TILE) - camY;

      const { length, opacity } = streak(speedFactor);
      dustMaterial.opacity = opacity;
      dust.visible = opacity > 0;
      if (dust.visible) {
        const speed = Math.hypot(vx, vy) || 1;
        const dx = (vx / speed) * length;
        const dy = (vy / speed) * length;
        for (let i = 0; i < dustCount; i++) {
          const ax = anchors[i * 3]!;
          const ay = anchors[i * 3 + 1]!;
          const o = i * 6;
          segmentPositions[o] = ax;
          segmentPositions[o + 1] = ay;
          segmentPositions[o + 3] = ax + dx;
          segmentPositions[o + 4] = ay + dy;
        }
        segmentAttr.needsUpdate = true;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
      for (const d of backdropOwned) d.dispose();
    },
  };
}

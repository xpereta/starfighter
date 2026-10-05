import * as THREE from 'three';

/** Linear RGB of a 0xRRGGBB colour (what vertex colours need, like `Color.setHex`). */
const tmp = new THREE.Color();
export function linearRgb(hex: number, out: Float32Array | number[], at = 0): void {
  tmp.setHex(hex);
  out[at] = tmp.r;
  out[at + 1] = tmp.g;
  out[at + 2] = tmp.b;
}

export interface TriBatch {
  readonly mesh: THREE.Mesh;
  /** Vertices written since the last `reset()`. */
  readonly count: number;
  readonly capacity: number;
  /** Starts a frame: forgets everything written. */
  reset(): void;
  /** One flat-coloured triangle; ignored when the batch is full. Colour is linear RGB 0..1. */
  tri(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    r: number,
    g: number,
    b: number,
  ): void;
  /** A flat disc (a fan of `segments` triangles). */
  disc(
    cx: number,
    cy: number,
    radius: number,
    segments: number,
    rot: number,
    r: number,
    g: number,
    b: number,
  ): void;
  /** A flat ring of the given thickness (centred on `radius`). */
  ring(
    cx: number,
    cy: number,
    radius: number,
    thickness: number,
    segments: number,
    r: number,
    g: number,
    b: number,
  ): void;
  /** Uploads what was written. Call once per frame after drawing. */
  finish(): void;
  dispose(): void;
}

/**
 * One dynamic triangle mesh with per-vertex colours and a fixed vertex budget: the flat-shaded,
 * hard-edged drawing surface of the death effects. No allocation after creation. Drawn over the
 * ships (no depth test) in `renderOrder` order.
 */
export function createTriBatch(maxVertices: number, renderOrder: number): TriBatch {
  const cap = Math.max(3, Math.floor(maxVertices / 3) * 3);
  const positions = new Float32Array(cap * 3);
  const colors = new Float32Array(cap * 3);
  const geometry = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(positions, 3);
  const col = new THREE.BufferAttribute(colors, 3);
  pos.setUsage(THREE.DynamicDrawUsage);
  col.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', pos);
  geometry.setAttribute('color', col);
  geometry.setDrawRange(0, 0);
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  mesh.position.z = 0.5;
  let n = 0;

  const vert = (x: number, y: number, r: number, g: number, b: number): void => {
    const o = n * 3;
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = 0;
    colors[o] = r;
    colors[o + 1] = g;
    colors[o + 2] = b;
    n++;
  };
  const tri: TriBatch['tri'] = (x1, y1, x2, y2, x3, y3, r, g, b) => {
    if (n + 3 > cap) return;
    vert(x1, y1, r, g, b);
    vert(x2, y2, r, g, b);
    vert(x3, y3, r, g, b);
  };

  return {
    mesh,
    get count() {
      return n;
    },
    capacity: cap,
    reset() {
      n = 0;
    },
    tri,
    disc(cx, cy, radius, segments, rot, r, g, b) {
      if (radius <= 0) return;
      for (let k = 0; k < segments; k++) {
        const a0 = rot + (k / segments) * Math.PI * 2;
        const a1 = rot + ((k + 1) / segments) * Math.PI * 2;
        tri(
          cx,
          cy,
          cx + Math.cos(a0) * radius,
          cy + Math.sin(a0) * radius,
          cx + Math.cos(a1) * radius,
          cy + Math.sin(a1) * radius,
          r,
          g,
          b,
        );
      }
    },
    ring(cx, cy, radius, thickness, segments, r, g, b) {
      if (thickness <= 0 || radius <= 0) return;
      const inner = Math.max(0, radius - thickness / 2);
      const outer = radius + thickness / 2;
      for (let k = 0; k < segments; k++) {
        const a0 = (k / segments) * Math.PI * 2;
        const a1 = ((k + 1) / segments) * Math.PI * 2;
        const c0 = Math.cos(a0);
        const s0 = Math.sin(a0);
        const c1 = Math.cos(a1);
        const s1 = Math.sin(a1);
        tri(
          cx + c0 * inner,
          cy + s0 * inner,
          cx + c0 * outer,
          cy + s0 * outer,
          cx + c1 * outer,
          cy + s1 * outer,
          r,
          g,
          b,
        );
        tri(
          cx + c0 * inner,
          cy + s0 * inner,
          cx + c1 * outer,
          cy + s1 * outer,
          cx + c1 * inner,
          cy + s1 * inner,
          r,
          g,
          b,
        );
      }
    },
    finish() {
      geometry.setDrawRange(0, n);
      pos.needsUpdate = true;
      col.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

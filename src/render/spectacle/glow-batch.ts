import * as THREE from 'three';

/** Linear RGB of a 0xRRGGBB colour, into `out` (what vertex colours need). */
const tmp = new THREE.Color();
export function toLinear(hex: number, out: Float32Array | number[], at = 0): void {
  tmp.setHex(hex);
  out[at] = tmp.r;
  out[at + 1] = tmp.g;
  out[at + 2] = tmp.b;
}

export type BatchBlend = 'add' | 'alpha';

export interface GlowBatch {
  readonly mesh: THREE.Mesh;
  /** Vertices written since the last `reset()`. */
  readonly count: number;
  readonly capacity: number;
  reset(): void;
  /** A triangle with its own colour and alpha at each corner (linear RGB, may exceed 1 to bloom). */
  tri(
    x1: number,
    y1: number,
    r1: number,
    g1: number,
    b1: number,
    a1: number,
    x2: number,
    y2: number,
    r2: number,
    g2: number,
    b2: number,
    a2: number,
    x3: number,
    y3: number,
    r3: number,
    g3: number,
    b3: number,
    a3: number,
  ): void;
  /** A disc fading from the centre colour to the edge colour (a soft glow when the edge alpha is 0). */
  disc(
    cx: number,
    cy: number,
    radius: number,
    segments: number,
    rot: number,
    inner: ArrayLike<number>,
    outer: ArrayLike<number>,
  ): void;
  /** A ring (centred on `radius`) fading from the inner to the outer edge. */
  ring(
    cx: number,
    cy: number,
    radius: number,
    thickness: number,
    segments: number,
    inner: ArrayLike<number>,
    outer: ArrayLike<number>,
  ): void;
  /**
   * A tapered ribbon from (x1,y1) to (x2,y2): `w1`/`w2` are the full widths at each end, `c1`/`c2`
   * the RGBA there (the quad blends between them).
   */
  streak(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    w1: number,
    w2: number,
    c1: ArrayLike<number>,
    c2: ArrayLike<number>,
  ): void;
  /** A four-point star (two crossed thin diamonds). */
  star(
    cx: number,
    cy: number,
    len: number,
    half: number,
    rot: number,
    c: ArrayLike<number>,
    edge: ArrayLike<number>,
  ): void;
  finish(): void;
  dispose(): void;
}

/**
 * One dynamic triangle mesh with per-vertex RGBA and a fixed vertex budget, no allocation after
 * creation: the drawing surface of the spectacle effects. `add` blends additively (glows, flashes,
 * sparks: black or zero alpha is invisible, values above 1 feed the bloom), `alpha` is ordinary
 * transparency (smoke). Drawn over the ships, in `renderOrder` order.
 */
export function createGlowBatch(
  maxVertices: number,
  renderOrder: number,
  blend: BatchBlend,
  z = 0.6,
  /** True for things far behind the ships (they are hidden by them); false draws over everything. */
  behind = false,
): GlowBatch {
  const cap = Math.max(3, Math.floor(maxVertices / 3) * 3);
  const positions = new Float32Array(cap * 3);
  const colors = new Float32Array(cap * 4);
  const geometry = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(positions, 3);
  const col = new THREE.BufferAttribute(colors, 4);
  pos.setUsage(THREE.DynamicDrawUsage);
  col.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', pos);
  geometry.setAttribute('color', col);
  geometry.setDrawRange(0, 0);
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: blend === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    depthTest: behind,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  mesh.position.z = z;
  let n = 0;

  const vert = (x: number, y: number, r: number, g: number, b: number, a: number): void => {
    const o = n * 3;
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = 0;
    const c = n * 4;
    colors[c] = r;
    colors[c + 1] = g;
    colors[c + 2] = b;
    colors[c + 3] = a;
    n++;
  };

  const tri: GlowBatch['tri'] = (
    x1,
    y1,
    r1,
    g1,
    b1,
    a1,
    x2,
    y2,
    r2,
    g2,
    b2,
    a2,
    x3,
    y3,
    r3,
    g3,
    b3,
    a3,
  ) => {
    if (n + 3 > cap) return;
    vert(x1, y1, r1, g1, b1, a1);
    vert(x2, y2, r2, g2, b2, a2);
    vert(x3, y3, r3, g3, b3, a3);
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
    disc(cx, cy, radius, segments, rot, inner, outer) {
      if (radius <= 0) return;
      for (let k = 0; k < segments; k++) {
        const a0 = rot + (k / segments) * Math.PI * 2;
        const a1 = rot + ((k + 1) / segments) * Math.PI * 2;
        tri(
          cx,
          cy,
          inner[0]!,
          inner[1]!,
          inner[2]!,
          inner[3]!,
          cx + Math.cos(a0) * radius,
          cy + Math.sin(a0) * radius,
          outer[0]!,
          outer[1]!,
          outer[2]!,
          outer[3]!,
          cx + Math.cos(a1) * radius,
          cy + Math.sin(a1) * radius,
          outer[0]!,
          outer[1]!,
          outer[2]!,
          outer[3]!,
        );
      }
    },
    ring(cx, cy, radius, thickness, segments, inner, outer) {
      if (thickness <= 0 || radius <= 0) return;
      const r0 = Math.max(0, radius - thickness / 2);
      const r1 = radius + thickness / 2;
      for (let k = 0; k < segments; k++) {
        const a0 = (k / segments) * Math.PI * 2;
        const a1 = ((k + 1) / segments) * Math.PI * 2;
        const c0 = Math.cos(a0);
        const s0 = Math.sin(a0);
        const c1 = Math.cos(a1);
        const s1 = Math.sin(a1);
        const I = inner;
        const O = outer;
        tri(
          cx + c0 * r0,
          cy + s0 * r0,
          I[0]!,
          I[1]!,
          I[2]!,
          I[3]!,
          cx + c0 * r1,
          cy + s0 * r1,
          O[0]!,
          O[1]!,
          O[2]!,
          O[3]!,
          cx + c1 * r1,
          cy + s1 * r1,
          O[0]!,
          O[1]!,
          O[2]!,
          O[3]!,
        );
        tri(
          cx + c0 * r0,
          cy + s0 * r0,
          I[0]!,
          I[1]!,
          I[2]!,
          I[3]!,
          cx + c1 * r1,
          cy + s1 * r1,
          O[0]!,
          O[1]!,
          O[2]!,
          O[3]!,
          cx + c1 * r0,
          cy + s1 * r0,
          I[0]!,
          I[1]!,
          I[2]!,
          I[3]!,
        );
      }
    },
    streak(x1, y1, x2, y2, w1, w2, c1, c2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 1e-4) return;
      const nx = (-dy / len) * 0.5;
      const ny = (dx / len) * 0.5;
      const ax = x1 + nx * w1;
      const ay = y1 + ny * w1;
      const bx = x1 - nx * w1;
      const by = y1 - ny * w1;
      const cx = x2 + nx * w2;
      const cy = y2 + ny * w2;
      const ex = x2 - nx * w2;
      const ey = y2 - ny * w2;
      tri(
        ax,
        ay,
        c1[0]!,
        c1[1]!,
        c1[2]!,
        c1[3]!,
        bx,
        by,
        c1[0]!,
        c1[1]!,
        c1[2]!,
        c1[3]!,
        cx,
        cy,
        c2[0]!,
        c2[1]!,
        c2[2]!,
        c2[3]!,
      );
      tri(
        bx,
        by,
        c1[0]!,
        c1[1]!,
        c1[2]!,
        c1[3]!,
        ex,
        ey,
        c2[0]!,
        c2[1]!,
        c2[2]!,
        c2[3]!,
        cx,
        cy,
        c2[0]!,
        c2[1]!,
        c2[2]!,
        c2[3]!,
      );
    },
    star(cx, cy, len, half, rot, c, edge) {
      for (let k = 0; k < 2; k++) {
        const a = rot + (k * Math.PI) / 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        // One long diamond along the axis: tips transparent, middle bright.
        tri(
          cx + ca * len,
          cy + sa * len,
          edge[0]!,
          edge[1]!,
          edge[2]!,
          edge[3]!,
          cx - sa * half,
          cy + ca * half,
          c[0]!,
          c[1]!,
          c[2]!,
          c[3]!,
          cx + sa * half,
          cy - ca * half,
          c[0]!,
          c[1]!,
          c[2]!,
          c[3]!,
        );
        tri(
          cx - ca * len,
          cy - sa * len,
          edge[0]!,
          edge[1]!,
          edge[2]!,
          edge[3]!,
          cx - sa * half,
          cy + ca * half,
          c[0]!,
          c[1]!,
          c[2]!,
          c[3]!,
          cx + sa * half,
          cy - ca * half,
          c[0]!,
          c[1]!,
          c[2]!,
          c[3]!,
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

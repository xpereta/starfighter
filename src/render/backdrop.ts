import * as THREE from 'three';
import type { BackdropGlow } from './style';

/** Segments around a glow disc, and rings from the centre out (one more at the hard edge). */
const SEGMENTS = 48;
const RINGS = 24;

/** Opacity share (0..1) at `r` (0 = centre, 1 = rim): solid up to `hardness`, then a squared fall-off to nothing at the rim. */
export function glowProfile(r: number, hardness: number): number {
  if (r <= hardness) return 1;
  const t = (1 - r) / (1 - hardness);
  return Math.max(0, t * t);
}

/** Brightness share of a lit sphere at (x, y) on the unit disc, with light from `lightAngle` degrees (0 = right, 90 = up). */
export function sphereLight(x: number, y: number, lightAngle: number, shade: number): number {
  const a = (lightAngle * Math.PI) / 180;
  const lx = Math.cos(a) * 0.8;
  const ly = Math.sin(a) * 0.8;
  const lz = 0.6;
  const nz = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  const lambert = Math.max(0, x * lx + y * ly + nz * lz);
  return 1 - shade * (1 - lambert);
}

/** A unit disc (radius 1) as indexed triangles with RGBA vertex colours (linear RGB, alpha = opacity). */
export interface GlowMeshData {
  positions: Float32Array;
  colors: Float32Array;
  index: Uint16Array;
}

export function glowMeshData(g: BackdropGlow): GlowMeshData {
  const radii = new Set<number>();
  for (let k = 1; k <= RINGS; k++) radii.add(k / RINGS);
  if (g.hardness > 0 && g.hardness < 1) radii.add(g.hardness);
  const rings = [0, ...[...radii].sort((a, b) => a - b)];
  const vertexCount = 1 + (rings.length - 1) * SEGMENTS;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 4);
  const base = new THREE.Color(g.color);
  const put = (v: number, x: number, y: number, r: number): void => {
    positions[v * 3] = x;
    positions[v * 3 + 1] = y;
    const light = g.shade > 0 ? sphereLight(x, y, g.lightAngle, g.shade) : 1;
    colors[v * 4] = base.r * light;
    colors[v * 4 + 1] = base.g * light;
    colors[v * 4 + 2] = base.b * light;
    colors[v * 4 + 3] = g.strength * glowProfile(r, g.hardness);
  };
  put(0, 0, 0, 0);
  for (let i = 1; i < rings.length; i++) {
    const r = rings[i]!;
    for (let s = 0; s < SEGMENTS; s++) {
      const a = (s / SEGMENTS) * Math.PI * 2;
      put(1 + (i - 1) * SEGMENTS + s, Math.cos(a) * r, Math.sin(a) * r, r);
    }
  }
  const tris: number[] = [];
  const at = (ring: number, s: number): number => 1 + (ring - 1) * SEGMENTS + (s % SEGMENTS);
  for (let s = 0; s < SEGMENTS; s++) tris.push(0, at(1, s), at(1, s + 1));
  for (let i = 1; i + 1 < rings.length; i++)
    for (let s = 0; s < SEGMENTS; s++) {
      tris.push(at(i, s), at(i + 1, s), at(i + 1, s + 1));
      tris.push(at(i, s), at(i + 1, s + 1), at(i, s + 1));
    }
  return { positions, colors, index: new Uint16Array(tris) };
}

/** Builds the Three.js geometry for one backdrop glow. */
export function glowGeometry(g: BackdropGlow): THREE.BufferGeometry {
  const d = glowMeshData(g);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(d.positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(d.colors, 4));
  geo.setIndex(new THREE.BufferAttribute(d.index, 1));
  return geo;
}

/** Soft glows add light; hard-edged spheres (planets) are drawn over what is behind them. */
export const isSoftGlow = (g: BackdropGlow): boolean => g.hardness < 0.5;

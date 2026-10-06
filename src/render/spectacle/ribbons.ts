import type { GlowBatch } from './glow-batch';

/**
 * Trail ribbons: a fixed pool of emitters (one per wingtip, engine or missile), each a short ring
 * of points that age and fall off the tail. Pure data, no three; drawn into a `GlowBatch` by
 * `drawRibbon`. Keys are stable identities (a missile's `uid`, a ship's slot), never pool indexes.
 */
export interface RibbonSet {
  readonly maxEmitters: number;
  readonly maxPoints: number;
  /** Live emitters (some may be fading out with no new points). */
  emitterCount(): number;
  /** Adds a point to emitter `key` (created when new, skipped when the pool is full or the ship has barely moved). */
  push(key: number, x: number, y: number, r: number, g: number, b: number): void;
  /** Ages every point by `dt` seconds; points older than `life` fall off, and empty emitters are freed. */
  step(dt: number, life: number): void;
  /** Slot of emitter `key`, or -1. */
  slotOf(key: number): number;
  /** The key of the emitter in a slot. */
  keyOf(slot: number): number;
  /** Visits each emitter slot with at least two points. */
  forEach(visit: (slot: number) => void): void;
  clear(): void;
  count(slot: number): number;
  /** Position, age (s) of point `i` of a slot (0 = oldest). */
  x(slot: number, i: number): number;
  y(slot: number, i: number): number;
  age(slot: number, i: number): number;
  color(slot: number): readonly [number, number, number];
}

/** A new point is only added once the ship has moved this far (u), so a parked ship does not pile up points. */
const MIN_STEP = 3;

export function createRibbonSet(maxEmitters: number, maxPoints: number): RibbonSet {
  const E = Math.max(0, Math.floor(maxEmitters));
  const P = Math.max(2, Math.floor(maxPoints));
  const keys = new Float64Array(E).fill(NaN);
  const used = new Uint8Array(E);
  const n = new Uint16Array(E);
  const xs = new Float32Array(E * P);
  const ys = new Float32Array(E * P);
  const ages = new Float32Array(E * P);
  const rgb = new Float32Array(E * 3);
  const colors: [number, number, number][] = Array.from({ length: E }, () => [0, 0, 0]);
  let live = 0;

  const find = (key: number): number => {
    for (let i = 0; i < E; i++) if (used[i] && keys[i] === key) return i;
    return -1;
  };

  return {
    maxEmitters: E,
    maxPoints: P,
    emitterCount: () => live,
    push(key, x, y, r, g, b) {
      let s = find(key);
      if (s < 0) {
        for (let i = 0; i < E; i++)
          if (!used[i]) {
            s = i;
            break;
          }
        if (s < 0) return;
        used[s] = 1;
        keys[s] = key;
        n[s] = 0;
        live++;
      }
      rgb[s * 3] = r;
      rgb[s * 3 + 1] = g;
      rgb[s * 3 + 2] = b;
      const base = s * P;
      const c = n[s]!;
      if (c > 0) {
        const lx = xs[base + c - 1]!;
        const ly = ys[base + c - 1]!;
        if (Math.hypot(x - lx, y - ly) < MIN_STEP) return;
      }
      if (c === P) {
        xs.copyWithin(base, base + 1, base + P);
        ys.copyWithin(base, base + 1, base + P);
        ages.copyWithin(base, base + 1, base + P);
        n[s] = P - 1;
      }
      const at = base + n[s]!;
      xs[at] = x;
      ys[at] = y;
      ages[at] = 0;
      n[s]!++;
    },
    step(dt, life) {
      for (let s = 0; s < E; s++) {
        if (!used[s]) continue;
        const base = s * P;
        let c = n[s]!;
        for (let i = 0; i < c; i++) ages[base + i]! += dt;
        let drop = 0;
        while (drop < c && ages[base + drop]! > life) drop++;
        if (drop > 0) {
          if (drop >= c) {
            used[s] = 0;
            n[s] = 0;
            live--;
            continue;
          }
          xs.copyWithin(base, base + drop, base + c);
          ys.copyWithin(base, base + drop, base + c);
          ages.copyWithin(base, base + drop, base + c);
          c -= drop;
          n[s] = c;
        }
      }
    },
    slotOf: find,
    keyOf: (s) => keys[s]!,
    forEach(visit) {
      for (let s = 0; s < E; s++) if (used[s] && n[s]! >= 2) visit(s);
    },
    clear() {
      used.fill(0);
      n.fill(0);
      live = 0;
    },
    count: (s) => n[s]!,
    x: (s, i) => xs[s * P + i]!,
    y: (s, i) => ys[s * P + i]!,
    age: (s, i) => ages[s * P + i]!,
    color(s) {
      const c = colors[s]!;
      c[0] = rgb[s * 3]!;
      c[1] = rgb[s * 3 + 1]!;
      c[2] = rgb[s * 3 + 2]!;
      return c;
    },
  };
}

export interface StrandStyle {
  /** Seconds a point lasts (older points are not drawn; fade runs over this). */
  life: number;
  /** Width at the head, world units, and the factor it has at the tail. */
  width: number;
  tailWidth: number;
  /** Opacity at the head. */
  alpha: number;
  /** Brightness multiplier on the stored colour (above 1 blooms). */
  gain: number;
  /** Spiral: strands twisting round the path (0 = a straight ribbon), swing in u, turns per second of age. */
  strands?: number;
  amplitude?: number;
  turns?: number;
  /** Phase offset (radians), e.g. per missile, so neighbouring spirals differ. */
  phase?: number;
}

const c1 = [0, 0, 0, 0];
const c2 = [0, 0, 0, 0];

/**
 * Draws one emitter as a tapered ribbon, or as `strands` helixes twisting round its path whose
 * swing grows with age (smoke curling away, the missile-swarm look). No allocation.
 */
export function drawRibbon(
  batch: GlowBatch,
  set: RibbonSet,
  slot: number,
  style: StrandStyle,
): void {
  const count = set.count(slot);
  if (count < 2) return;
  const [r, g, b] = set.color(slot);
  const strands = style.strands ?? 0;
  const lanes = strands > 0 ? strands : 1;
  for (let lane = 0; lane < lanes; lane++) {
    const lanePhase = (lane / lanes) * Math.PI * 2 + (style.phase ?? 0);
    let px = 0;
    let py = 0;
    let pa = 0;
    let pw = 0;
    for (let i = 0; i < count; i++) {
      const age = set.age(slot, i);
      const u = Math.min(1, age / style.life); // 0 = fresh (head) .. 1 = about to vanish
      let x = set.x(slot, i);
      let y = set.y(slot, i);
      if (strands > 0) {
        // Normal of the path at this point, from its neighbours.
        const a = set.x(slot, Math.max(0, i - 1));
        const bb = set.y(slot, Math.max(0, i - 1));
        const cx = set.x(slot, Math.min(count - 1, i + 1));
        const cy = set.y(slot, Math.min(count - 1, i + 1));
        const dx = cx - a;
        const dy = cy - bb;
        const len = Math.hypot(dx, dy) || 1;
        const swing =
          (style.amplitude ?? 0) *
          (0.25 + 0.75 * Math.min(1, u * 1.6)) *
          Math.sin(lanePhase + age * (style.turns ?? 1) * Math.PI * 2);
        x += (-dy / len) * swing;
        y += (dx / len) * swing;
      }
      const alpha = style.alpha * (1 - u) * (1 - u * 0.5);
      const w = style.width * (1 - u) + style.tailWidth * u;
      if (i > 0 && alpha > 0.003 && pa > 0.003) {
        c1[0] = r * style.gain;
        c1[1] = g * style.gain;
        c1[2] = b * style.gain;
        c1[3] = pa;
        c2[0] = c1[0]!;
        c2[1] = c1[1]!;
        c2[2] = c1[2]!;
        c2[3] = alpha;
        // Segments run oldest -> newest, so the earlier point is the tail.
        batch.streak(px, py, x, y, pw, w, c1, c2);
      }
      px = x;
      py = y;
      pa = alpha;
      pw = w;
    }
  }
}

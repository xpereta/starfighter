/** Trails behind missiles. Pure data (no THREE), so the identity and fade logic can be unit-tested. */

/** Points kept per trail, one per simulation step: about a quarter of a second of flight. */
export const TRAIL_POINTS = 14;
/** A trail keeps fading this long (seconds) after its missile is gone. */
export const TRAIL_FADE_SECONDS = 0.35;

export interface TrailStore {
  /** Number of trails currently held (flying or fading). */
  readonly active: number;
  /**
   * Records this frame's missiles. `uids` identify missiles across pool slots moving around;
   * a point is added only when `tick` advanced since the last call. `frameDt` is wall-clock seconds.
   */
  update(
    uids: Float32Array,
    xs: Float32Array,
    ys: Float32Array,
    count: number,
    tick: number,
    frameDt: number,
  ): void;
  /** Visits every segment, oldest to newest, with `alpha` rising toward the missile (0 at the tail). */
  forEachSegment(
    visit: (x1: number, y1: number, x2: number, y2: number, alpha: number) => void,
  ): void;
  clear(): void;
}

export function createTrailStore(capacity: number, points = TRAIL_POINTS): TrailStore {
  const xs = new Float32Array(capacity * points);
  const ys = new Float32Array(capacity * points);
  const counts = new Uint16Array(capacity); // points held (<= points)
  const heads = new Uint16Array(capacity); // next write position in the ring
  const owner = new Int32Array(capacity).fill(-1); // missile uid, or -1 for a free slot
  const age = new Float32Array(capacity); // seconds since the missile vanished; -1 while it flies
  const stamp = new Int32Array(capacity); // frame that last saw the slot's missile
  const slotOf = new Map<number, number>();
  const free: number[] = [];
  for (let i = capacity - 1; i >= 0; i--) free.push(i);
  let frame = 0;
  let lastTick = -1;
  let active = 0;

  const push = (slot: number, x: number, y: number): void => {
    const at = slot * points + heads[slot]!;
    xs[at] = x;
    ys[at] = y;
    heads[slot] = (heads[slot]! + 1) % points;
    counts[slot] = Math.min(counts[slot]! + 1, points);
  };

  return {
    get active() {
      return active;
    },
    update(uids, mx, my, count, tick, frameDt) {
      frame++;
      const advanced = tick !== lastTick;
      for (let i = 0; i < count; i++) {
        const uid = uids[i]!;
        let slot = slotOf.get(uid);
        if (slot === undefined) {
          const taken = free.pop();
          if (taken === undefined) continue; // out of trails: this missile just goes without one
          slot = taken;
          slotOf.set(uid, slot);
          owner[slot] = uid;
          counts[slot] = 0;
          heads[slot] = 0;
          active++;
          push(slot, mx[i]!, my[i]!);
        } else if (advanced) {
          push(slot, mx[i]!, my[i]!);
        }
        age[slot] = -1;
        stamp[slot] = frame;
      }
      lastTick = tick;
      // Trails whose missile is gone keep fading, then free their slot.
      for (let slot = 0; slot < capacity; slot++) {
        if (owner[slot]! < 0 || stamp[slot] === frame) continue;
        age[slot] = (age[slot]! < 0 ? 0 : age[slot]!) + frameDt;
        if (age[slot]! > TRAIL_FADE_SECONDS) {
          slotOf.delete(owner[slot]!);
          owner[slot] = -1;
          free.push(slot);
          active--;
        }
      }
    },
    forEachSegment(visit) {
      for (let slot = 0; slot < capacity; slot++) {
        if (owner[slot]! < 0) continue;
        const n = counts[slot]!;
        if (n < 2) continue;
        const fade = age[slot]! < 0 ? 1 : 1 - age[slot]! / TRAIL_FADE_SECONDS;
        const start = (heads[slot]! - n + points) % points;
        for (let j = 1; j < n; j++) {
          const a = slot * points + ((start + j - 1) % points);
          const b = slot * points + ((start + j) % points);
          visit(xs[a]!, ys[a]!, xs[b]!, ys[b]!, (j / (n - 1)) * fade);
        }
      }
    },
    clear() {
      slotOf.clear();
      free.length = 0;
      for (let i = capacity - 1; i >= 0; i--) free.push(i);
      owner.fill(-1);
      counts.fill(0);
      heads.fill(0);
      active = 0;
      lastTick = -1;
    },
  };
}

/** Fixed-size ring of recent ship positions for the debug trail. Allocation-free after creation. */
export interface Trail {
  readonly capacity: number;
  readonly count: number;
  /** Total positions ever pushed since the last clear (used to place time marks). */
  readonly pushed: number;
  push(x: number, y: number, flag: boolean): void;
  clear(): void;
  /** Visits points from oldest to newest. */
  forEach(visit: (x: number, y: number, flag: boolean, index: number) => void): void;
}

export function createTrail(capacity: number): Trail {
  const xs = new Float32Array(capacity);
  const ys = new Float32Array(capacity);
  const flags = new Uint8Array(capacity);
  let head = 0; // next slot to write
  let count = 0;
  let pushed = 0;
  return {
    capacity,
    get count() {
      return count;
    },
    get pushed() {
      return pushed;
    },
    push(x, y, flag) {
      xs[head] = x;
      ys[head] = y;
      flags[head] = flag ? 1 : 0;
      head = (head + 1) % capacity;
      count = Math.min(count + 1, capacity);
      pushed++;
    },
    clear() {
      head = 0;
      count = 0;
      pushed = 0;
    },
    forEach(visit) {
      const start = (head - count + capacity) % capacity;
      for (let i = 0; i < count; i++) {
        const slot = (start + i) % capacity;
        visit(xs[slot]!, ys[slot]!, flags[slot] === 1, i);
      }
    },
  };
}

/** A move bigger than this in one step is a respawn/restart, not flight: start a fresh trail. */
export const TRAIL_JUMP = 1000;

export interface TrailSampler {
  /** Call every frame; records one point per simulation tick and clears on restarts or jumps. */
  sample(tick: number, x: number, y: number, flag: boolean): void;
}

export function createTrailSampler(trail: Trail): TrailSampler {
  let lastTick = -1;
  let lastX = 0;
  let lastY = 0;
  return {
    sample(tick, x, y, flag) {
      if (tick === lastTick) return; // already recorded this step
      if (tick < lastTick || (trail.count > 0 && Math.hypot(x - lastX, y - lastY) > TRAIL_JUMP)) {
        trail.clear();
      }
      lastTick = tick;
      lastX = x;
      lastY = y;
      trail.push(x, y, flag);
    },
  };
}

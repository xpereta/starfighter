import { DEG, wrapAngle } from '../math';
import { livingWingmen } from '../squadron/squadron';
import { forEachLockable, getLockable, PART_ID_BASE } from '../world/lockable';
import type { World } from '../world/world';

/**
 * Lock-on state (spec section 1). Contract: `locks` holds lockable ids (see core/world/lockable.ts)
 * in acquisition order, which is also the missile priority.
 */
export interface LockOn {
  locks: number[];
  /** Seconds each lock has been outside the cone (parallel to `locks`); 0 while inside. */
  graces: number[];
  /** Lockable id being acquired, or -1. */
  acquiringId: number;
  /** Seconds the acquiring target has spent in the cone, 0..lockTime. */
  progress: number;
  /** Seconds the acquiring target has been outside the cone. */
  acquiringGrace: number;
}

export function createLockOn(): LockOn {
  return { locks: [], graces: [], acquiringId: -1, progress: 0, acquiringGrace: 0 };
}

/** How many locks the player may hold: 1 + living wingmen, capped by `lockCap`. */
export function lockLimit(world: World): number {
  return Math.min(world.tuning.lockon.lockCap, 1 + livingWingmen(world.squadron));
}

/**
 * Angle from the nose to the edge of a body, radians (0 when the nose points inside the body).
 * Big targets are easier to hold in the cone, as they should be.
 */
export function angleOffNose(
  heading: number,
  fromX: number,
  fromY: number,
  x: number,
  y: number,
  radius: number,
): number {
  const dx = x - fromX;
  const dy = y - fromY;
  const dist = Math.hypot(dx, dy);
  if (dist <= radius) return 0;
  const off = Math.abs(wrapAngle(Math.atan2(dy, dx) - heading));
  return Math.max(0, off - Math.asin(radius / dist));
}

type LostReason = 'dead' | 'range' | 'cone';

/** Reusable scan state, so choosing a candidate does not allocate (`forEachLockable` takes a callback). */
const scan = {
  fromX: 0,
  fromY: 0,
  heading: 0,
  halfAngle: 0,
  range: 0,
  bestId: -1,
  bestAngle: Infinity,
  locks: [] as number[],
  /** Whether the lock set already holds `lockPartCap` parts of the capital ship (no more part may be taken). */
  partsFull: false,
};

function considerCandidate(
  id: number,
  x: number,
  y: number,
  _vx: number,
  _vy: number,
  radius: number,
): void {
  if (scan.locks.includes(id)) return;
  if (scan.partsFull && id >= PART_ID_BASE) return;
  if (Math.hypot(x - scan.fromX, y - scan.fromY) - radius > scan.range) return;
  const angle = angleOffNose(scan.heading, scan.fromX, scan.fromY, x, y, radius);
  if (angle > scan.halfAngle) return;
  // Nearest to the nose axis wins; ties go to the lower id so the choice is deterministic.
  if (angle < scan.bestAngle || (angle === scan.bestAngle && id < scan.bestId)) {
    scan.bestAngle = angle;
    scan.bestId = id;
  }
}

/** Why a held or acquiring target must go, or null if it stays (it may be in its grace period). */
function lossReason(world: World, id: number, graceUsed: number): LostReason | null {
  const { ship } = world;
  const cfg = world.tuning.lockon;
  const body = getLockable(world, id);
  if (!body || !body.alive) return 'dead';
  if (Math.hypot(body.x - ship.x, body.y - ship.y) - body.radius > cfg.lockRange) return 'range';
  const outside =
    angleOffNose(ship.heading, ship.x, ship.y, body.x, body.y, body.radius) >
    cfg.coneHalfAngle * DEG;
  return outside && graceUsed > cfg.lockGrace ? 'cone' : null;
}

/** True while the body is outside the cone (it may still be within its grace period). */
function outsideCone(world: World, id: number): boolean {
  const { ship } = world;
  const body = getLockable(world, id);
  if (!body) return true;
  return (
    angleOffNose(ship.heading, ship.x, ship.y, body.x, body.y, body.radius) >
    world.tuning.lockon.coneHalfAngle * DEG
  );
}

/** Runs after the squadron and before guns/missiles each step. */
export function stepLockOn(world: World): void {
  const { lockon, ship, events } = world;
  const cfg = world.tuning.lockon;
  const dt = 1 / 60;

  // Held locks: drop the dead, the out of range, and those out of the cone longer than the grace.
  for (let i = lockon.locks.length - 1; i >= 0; i--) {
    const id = lockon.locks[i]!;
    lockon.graces[i] = outsideCone(world, id) ? lockon.graces[i]! + dt : 0;
    const lost = lossReason(world, id, lockon.graces[i]!);
    if (lost) {
      lockon.locks.splice(i, 1);
      lockon.graces.splice(i, 1);
      events.emit({ type: 'LockLost', targetId: id, reason: lost });
    }
  }

  // The target being acquired fills while it stays in the cone, and pauses during the grace.
  if (lockon.acquiringId >= 0) {
    const id = lockon.acquiringId;
    const outside = outsideCone(world, id);
    lockon.acquiringGrace = outside ? lockon.acquiringGrace + dt : 0;
    const lost = lossReason(world, id, lockon.acquiringGrace);
    if (lost) {
      lockon.acquiringId = -1;
      lockon.progress = 0;
      lockon.acquiringGrace = 0;
      events.emit({ type: 'LockLost', targetId: id, reason: lost });
    } else if (!outside) {
      lockon.progress += dt;
      if (lockon.progress >= cfg.lockTime) {
        lockon.locks.push(id);
        lockon.graces.push(0);
        lockon.acquiringId = -1;
        lockon.progress = 0;
        events.emit({ type: 'LockAcquired', targetId: id });
      }
    }
  }

  // Start acquiring the candidate nearest the nose axis, unless the lock set is full.
  if (lockon.acquiringId < 0 && lockon.locks.length < lockLimit(world)) {
    scan.fromX = ship.x;
    scan.fromY = ship.y;
    scan.heading = ship.heading;
    scan.halfAngle = cfg.coneHalfAngle * DEG;
    scan.range = cfg.lockRange;
    scan.bestId = -1;
    scan.bestAngle = Infinity;
    scan.locks = lockon.locks;
    // A salvo may lock at most `lockPartCap` parts of the capital ship, so it is not wasted on small parts.
    let heldParts = 0;
    for (const held of lockon.locks) if (held >= PART_ID_BASE) heldParts++;
    scan.partsFull = heldParts >= world.tuning.capital.lockPartCap;
    forEachLockable(world, considerCandidate);
    if (scan.bestId >= 0) {
      lockon.acquiringId = scan.bestId;
      lockon.progress = 0;
      lockon.acquiringGrace = 0;
      events.emit({ type: 'LockAcquiring', targetId: scan.bestId });
    }
  }
}

/** Feeds the lock state into the replay hash. Add every field you add to `LockOn`. */
export function mixLockOn(mix: (n: number) => void, lockon: LockOn): void {
  mix(lockon.locks.length);
  for (const id of lockon.locks) mix(id);
  for (const g of lockon.graces) mix(g);
  mix(lockon.acquiringId);
  mix(lockon.progress);
  mix(lockon.acquiringGrace);
}

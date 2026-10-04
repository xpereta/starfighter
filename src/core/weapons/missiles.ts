import type { MissilesConfig } from '../../../data/tuning/missiles';
import { clamp, DEG, TAU, wrapAngle } from '../math';
import { livingWingmen } from '../squadron/squadron';
import { forEachLockable, getLockable } from '../world/lockable';
import { createPool, type Pool } from '../world/pool';
import type { World } from '../world/world';

type MissileFields =
  'uid' | 'x' | 'y' | 'vx' | 'vy' | 'heading' | 'speed' | 'phase' | 'life' | 'targetId';

/** The salvo being launched (spec section 2). Lives on the missile pool so the world contract stays unchanged. */
export interface SalvoState {
  /** Seconds until the next salvo may launch; counts down from `salvoCooldown`. */
  cooldown: number;
  /** Target ids of the missiles still waiting to leave, in launch order. */
  pending: number[];
  /**
   * Who fires each pending missile, parallel to `pending`: `PLAYER` or the index of a wingman in
   * `world.squadron.wingmen`. A missing entry means the player.
   */
  pilots: number[];
  /** Seconds until the next pending missile leaves. */
  nextIn: number;
  /** How many slots of the current salvo have come up (missiles launched plus skipped ones). */
  launched: number;
  /** The `uid` the next missile gets: a stable identity (pool slots move when missiles are removed). */
  nextUid: number;
}

/**
 * Missile pool (flat arrays, fixed cap) plus the salvo state. `vx`/`vy` are the current velocity
 * (heading + wobble); `heading` is the steered direction without the wobble.
 */
export interface MissilePool extends Pool<MissileFields> {
  readonly salvo: SalvoState;
}

/** Pilot marker for the player's own ship (wingmen are their index in `squadron.wingmen`). */
export const PLAYER = -1;

function createSalvo(): SalvoState {
  return { cooldown: 0, pending: [], pilots: [], nextIn: 0, launched: 0, nextUid: 0 };
}

export function createMissilePool(cfg: MissilesConfig): MissilePool {
  const base = createPool<MissileFields>(cfg.missileCap, [
    'uid',
    'x',
    'y',
    'vx',
    'vy',
    'heading',
    'speed',
    'phase',
    'life',
    'targetId',
  ]);
  const baseClear = base.clear;
  const salvo = createSalvo();
  // A respawn clears the pool; it must also drop a salvo in progress and its cooldown.
  return Object.assign(base, {
    salvo,
    clear: () => {
      baseClear();
      Object.assign(salvo, createSalvo());
    },
  });
}

/** Number of pilots in a salvo: the player plus every living wingman. */
export function salvoSize(world: World): number {
  return 1 + livingWingmen(world.squadron);
}

/** The pilots of a salvo in priority order: the player first, then each living wingman. */
export function salvoPilots(world: World, out: number[]): number[] {
  out.length = 0;
  out.push(PLAYER);
  world.squadron.wingmen.forEach((w, i) => {
    if (w.alive) out.push(i);
  });
  return out;
}

/**
 * Assigns one target per pilot, round-robin in lock order: more pilots than locks double up from the
 * top, fewer pilots use only the first locks, no locks gives an empty list (no launch).
 */
export function assignSalvo(locks: readonly number[], pilots: number, out: number[]): number[] {
  out.length = 0;
  if (locks.length === 0) return out;
  for (let k = 0; k < pilots; k++) out.push(locks[k % locks.length]!);
  return out;
}

/** Where and how fast a missile leaves its launcher. */
export interface LaunchOrigin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
}

const origin: LaunchOrigin = { x: 0, y: 0, vx: 0, vy: 0, heading: 0 };

/**
 * Where a pilot's missile leaves from: the nose of that pilot's own ship (`PLAYER`, or the index of
 * a wingman in `world.squadron.wingmen`), with that ship's velocity and heading.
 */
export function launchOrigin(world: World, pilot: number): LaunchOrigin {
  const ship = pilot === PLAYER ? world.ship : (world.squadron.wingmen[pilot]?.ship ?? world.ship);
  const offset = world.tuning.weapons.muzzleOffset;
  origin.x = ship.x + Math.cos(ship.heading) * offset;
  origin.y = ship.y + Math.sin(ship.heading) * offset;
  origin.vx = ship.vx;
  origin.vy = ship.vy;
  origin.heading = ship.heading;
  return origin;
}

const assignment: number[] = [];
const pilotOrder: number[] = [];

function launchOne(world: World, cfg: MissilesConfig, targetId: number, pilot: number): void {
  const m = world.missiles;
  const i = m.spawn();
  if (i < 0) return; // pool full: the missile is dropped, no event
  const o = launchOrigin(world, pilot);
  const forward = o.vx * Math.cos(o.heading) + o.vy * Math.sin(o.heading);
  const speed = cfg.launchSpeed + Math.max(0, forward);
  m.data.uid[i] = m.salvo.nextUid++;
  m.data.x[i] = o.x;
  m.data.y[i] = o.y;
  m.data.heading[i] = o.heading;
  m.data.speed[i] = speed;
  m.data.phase[i] = world.rng.range(0, TAU);
  m.data.vx[i] = Math.cos(o.heading) * speed;
  m.data.vy[i] = Math.sin(o.heading) * speed;
  m.data.life[i] = cfg.missileLife;
  m.data.targetId[i] = targetId;
  world.events.emit({ type: 'MissileLaunched', x: o.x, y: o.y, angle: o.heading, targetId });
}

/** Closest enemy a missile touches this step (reusable state, so the scan allocates nothing). */
const hit = { x: 0, y: 0, radius: 0, bestId: -1, bestDist: Infinity };

function considerHit(
  id: number,
  x: number,
  y: number,
  _vx: number,
  _vy: number,
  radius: number,
): void {
  const reach = radius + hit.radius;
  const d2 = (x - hit.x) * (x - hit.x) + (y - hit.y) * (y - hit.y);
  if (d2 <= reach * reach && d2 < hit.bestDist) {
    hit.bestDist = d2;
    hit.bestId = id;
  }
}

/** Runs after guns each step: launch, stagger, motion and hits. */
export function stepMissiles(world: World): void {
  const { missiles: m, events, actions, prev } = world;
  const cfg = world.tuning.missiles;
  const dt = 1 / 60;
  const salvo = m.salvo;

  salvo.cooldown = Math.max(0, salvo.cooldown - dt);

  // Launch on a fresh press, with at least one lock and the salvo ready.
  if (
    actions.launch &&
    !prev.launch &&
    salvo.cooldown <= 0 &&
    salvo.pending.length === 0 &&
    world.lockon.locks.length > 0
  ) {
    salvoPilots(world, pilotOrder);
    assignSalvo(world.lockon.locks, pilotOrder.length, assignment);
    salvo.pending.push(...assignment);
    salvo.pilots.push(...pilotOrder);
    // Firing spends the locks (Xavi's call): the salvo keeps the targets it was assigned, but the
    // lock set empties, so the next salvo needs fresh locks. A target mid-acquisition keeps filling.
    world.lockon.locks.length = 0;
    world.lockon.graces.length = 0;
    salvo.launched = 0;
    salvo.nextIn = 0;
    salvo.cooldown = cfg.salvoCooldown;
    events.emit({ type: 'SalvoFired', count: assignment.length });
  }

  // The ripple: pending missiles leave `salvoStagger` apart.
  if (salvo.pending.length > 0) {
    salvo.nextIn -= dt;
    while (salvo.pending.length > 0 && salvo.nextIn <= 0) {
      const targetId = salvo.pending.shift()!;
      const pilot = salvo.pilots.shift() ?? PLAYER;
      // A wingman shot down before their turn in the ripple does not fire.
      if (pilot === PLAYER || world.squadron.wingmen[pilot]?.alive) {
        launchOne(world, cfg, targetId, pilot);
      }
      salvo.launched++;
      salvo.nextIn += cfg.salvoStagger;
    }
  }

  // Motion and hits. Backwards, because removal swaps the last missile into the gap.
  const d = m.data;
  for (let i = m.count - 1; i >= 0; i--) {
    d.life[i]! -= dt;
    if (d.life[i]! <= 0) {
      m.remove(i);
      continue;
    }

    // Home on the target if it is still alive; otherwise fly straight.
    const id = d.targetId[i]!;
    if (id >= 0) {
      const target = getLockable(world, id);
      if (!target || !target.alive) d.targetId[i] = -1;
      else {
        const want = Math.atan2(target.y - d.y[i]!, target.x - d.x[i]!);
        const limit = cfg.missileTurnRate * DEG * dt;
        d.heading[i] = d.heading[i]! + clamp(wrapAngle(want - d.heading[i]!), -limit, limit);
      }
    }

    d.speed[i] = Math.min(cfg.missileMaxSpeed, d.speed[i]! + cfg.missileAccel * dt);
    d.phase[i]! += TAU * cfg.wobbleHz * dt;
    const flight = d.heading[i]! + Math.sin(d.phase[i]!) * cfg.wobbleAmount * DEG;
    d.vx[i] = Math.cos(flight) * d.speed[i]!;
    d.vy[i] = Math.sin(flight) * d.speed[i]!;
    d.x[i]! += d.vx[i]! * dt;
    d.y[i]! += d.vy[i]! * dt;

    hit.x = d.x[i]!;
    hit.y = d.y[i]!;
    hit.radius = cfg.missileRadius;
    hit.bestId = -1;
    hit.bestDist = Infinity;
    forEachLockable(world, considerHit);
    if (hit.bestId >= 0) {
      const body = getLockable(world, hit.bestId)!;
      body.hp -= cfg.missileDamage;
      const speed = Math.hypot(d.vx[i]!, d.vy[i]!) || 1;
      events.emit({
        type: 'Hit',
        x: d.x[i]!,
        y: d.y[i]!,
        dirX: d.vx[i]! / speed,
        dirY: d.vy[i]! / speed,
        impulse: cfg.missileHitImpulse,
      });
      m.remove(i);
    }
  }
}

/** Feeds the missiles and the salvo into the replay hash. Add every field you add to the pool or the salvo. */
export function mixMissiles(mix: (n: number) => void, missiles: MissilePool): void {
  mix(missiles.count);
  for (const field of Object.keys(missiles.data) as (keyof typeof missiles.data)[]) {
    const arr = missiles.data[field];
    for (let i = 0; i < missiles.count; i++) mix(arr[i]!);
  }
  const { salvo } = missiles;
  mix(salvo.cooldown);
  mix(salvo.nextIn);
  mix(salvo.launched);
  mix(salvo.nextUid);
  mix(salvo.pending.length);
  for (const id of salvo.pending) mix(id);
  mix(salvo.pilots.length);
  for (const p of salvo.pilots) mix(p);
}

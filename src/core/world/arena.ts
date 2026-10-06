import type { ArenaConfig } from '../../../data/tuning/arena';
import type { EventQueue } from '../events/events';
import type { Ship } from '../flight/flight';
import { TAU } from '../math';
import type { Rng } from '../rng/rng';
import type { Pod } from './pods';
import { createPool, type Pool } from './pool';
import type { Target, TargetKind } from './target';

export type EnemyShotPool = Pool<'x' | 'y' | 'vx' | 'vy' | 'life'>;

export function createEnemyShotPool(cfg: ArenaConfig): EnemyShotPool {
  return createPool(cfg.enemyShotCap, ['x', 'y', 'vx', 'vy', 'life']);
}

/** Random point in a ring around the arena center. */
function place(rng: Rng, min: number, max: number): [number, number] {
  const angle = rng.range(0, TAU);
  const r = rng.range(min, Math.max(min, max));
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

function makeTarget(kind: TargetKind, x: number, y: number, hp: number, radius: number): Target {
  return {
    kind,
    mode: 'static',
    x,
    y,
    radius,
    hp,
    maxHp: hp,
    alive: true,
    homeX: x,
    homeY: y,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 0,
    orbitX: 0,
    orbitY: 0,
    orbitRadius: 0,
    omega: 0,
    cooldown: 0,
    respawnTimer: 0,
    lastHitBy: 0,
  };
}

/**
 * One target of a kind at a position, built from the arena config without touching the RNG (used by
 * the dev panel's spawn buttons). Drones fly straight along `heading`; static ones and turrets stay put.
 */
export function createTargetAt(
  kind: TargetKind,
  cfg: ArenaConfig,
  x: number,
  y: number,
  heading: number,
): Target {
  if (kind === 'static') return makeTarget('static', x, y, cfg.staticHp, cfg.staticRadius);
  if (kind === 'turret') {
    const t = makeTarget('turret', x, y, cfg.turretHp, cfg.turretRadius);
    t.cooldown = 1.5;
    return t;
  }
  const t = makeTarget('drone', x, y, cfg.droneHp, cfg.droneRadius);
  t.mode = 'straight';
  t.angle = heading;
  t.speed = cfg.droneSpeedMin;
  return t;
}

/** Builds the arena layout from the seeded RNG: static drones, moving drones, turrets. */
export function createTargets(cfg: ArenaConfig, rng: Rng): Target[] {
  const targets: Target[] = [];
  for (let i = 0; i < cfg.staticCount; i++) {
    const [x, y] = place(rng, cfg.staticSpawnMin, cfg.staticSpawnMax);
    targets.push(makeTarget('static', x, y, cfg.staticHp, cfg.staticRadius));
  }
  const circling = Math.round(cfg.droneCount * cfg.droneCircleShare);
  for (let i = 0; i < cfg.droneCount; i++) {
    const [cx, cy] = place(rng, cfg.droneSpawnMin, cfg.droneSpawnMax);
    const speed = rng.range(cfg.droneSpeedMin, Math.max(cfg.droneSpeedMin, cfg.droneSpeedMax));
    if (i < cfg.droneCount - circling) {
      const t = makeTarget('drone', cx, cy, cfg.droneHp, cfg.droneRadius);
      t.mode = 'straight';
      t.angle = rng.range(0, TAU);
      t.speed = speed;
      targets.push(t);
    } else {
      const radius = rng.range(cfg.droneOrbitMin, Math.max(cfg.droneOrbitMin, cfg.droneOrbitMax));
      const angle = rng.range(0, TAU);
      const t = makeTarget(
        'drone',
        cx + Math.cos(angle) * radius,
        cy + Math.sin(angle) * radius,
        cfg.droneHp,
        cfg.droneRadius,
      );
      t.mode = 'circle';
      t.orbitX = cx;
      t.orbitY = cy;
      t.orbitRadius = radius;
      t.angle = angle;
      t.speed = speed;
      t.omega = speed / radius;
      targets.push(t);
    }
  }
  for (let i = 0; i < cfg.turretCount; i++) {
    const [x, y] = place(rng, cfg.turretSpawnMin, cfg.turretSpawnMax);
    const t = makeTarget('turret', x, y, cfg.turretHp, cfg.turretRadius);
    t.cooldown = 1 + rng.next();
    targets.push(t);
  }
  return targets;
}

/** Returns a destroyed target to its starting state. */
export function reviveTarget(t: Target): void {
  t.alive = true;
  t.hp = t.maxHp;
  t.respawnTimer = 0;
  t.lastHitBy = 0;
  t.x = t.homeX;
  t.y = t.homeY;
  if (t.mode === 'circle') {
    t.angle = Math.atan2(t.homeY - t.orbitY, t.homeX - t.orbitX);
  }
}

function spawnEnemyShot(
  shots: EnemyShotPool,
  cfg: ArenaConfig,
  t: Target,
  at: { x: number; y: number },
  events?: EventQueue,
): void {
  const i = shots.spawn();
  if (i < 0) return;
  const dx = at.x - t.x;
  const dy = at.y - t.y;
  const d = Math.hypot(dx, dy) || 1;
  shots.data.x[i] = t.x;
  shots.data.y[i] = t.y;
  shots.data.vx[i] = (dx / d) * cfg.enemyShotSpeed;
  shots.data.vy[i] = (dy / d) * cfg.enemyShotSpeed;
  shots.data.life[i] = cfg.enemyShotLife;
  events?.emit({
    type: 'EnemyShotFired',
    x: t.x,
    y: t.y,
    angle: Math.atan2(dy, dx),
    from: 'turret',
  });
}

/** The nearest living pod within `range` of (x, y), or null. */
function nearestPodAt(pods: readonly Pod[], x: number, y: number, range: number): Pod | null {
  let best: Pod | null = null;
  let bestSq = range * range;
  for (const p of pods) {
    if (!p.alive) continue;
    const sq = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (sq <= bestSq) {
      best = p;
      bestSq = sq;
    }
  }
  return best;
}

/**
 * Moves targets, fires turrets, and brings destroyed targets back after `respawnDelay`.
 * While `holdDrones` is true (time trial), destroyed drones stay destroyed. Turrets also shoot at a rescue
 * pod within `podRange` of them (the nearest one, preferred over the player); `pods` is empty in practice mode.
 */
export function stepTargets(
  targets: readonly Target[],
  ship: Ship,
  cfg: ArenaConfig,
  arenaRadius: number,
  shots: EnemyShotPool,
  rng: Rng,
  holdDrones: boolean,
  dt: number,
  pods: readonly Pod[] = [],
  podRange = 0,
  events?: EventQueue,
): void {
  for (const t of targets) {
    if (!t.alive) {
      t.respawnTimer -= dt;
      if (t.respawnTimer <= 0 && !(holdDrones && t.kind === 'drone')) reviveTarget(t);
      continue;
    }
    if (t.mode === 'straight') {
      if (Math.hypot(t.x, t.y) > arenaRadius) {
        // Turn back toward the arena with a little scatter so paths do not repeat.
        t.angle = Math.atan2(-t.y, -t.x) + rng.range(-0.5, 0.5);
      }
      t.vx = Math.cos(t.angle) * t.speed;
      t.vy = Math.sin(t.angle) * t.speed;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
    } else if (t.mode === 'circle') {
      t.angle += t.omega * dt;
      const nx = t.orbitX + Math.cos(t.angle) * t.orbitRadius;
      const ny = t.orbitY + Math.sin(t.angle) * t.orbitRadius;
      t.vx = (nx - t.x) / dt;
      t.vy = (ny - t.y) / dt;
      t.x = nx;
      t.y = ny;
    } else if (t.kind === 'turret') {
      t.cooldown -= dt;
      if (t.cooldown <= 0) {
        const pod = podRange > 0 ? nearestPodAt(pods, t.x, t.y, podRange) : null;
        if (pod) {
          spawnEnemyShot(shots, cfg, t, pod, events);
          t.cooldown = cfg.turretFireInterval * rng.range(0.8, 1.2);
        } else if (Math.hypot(ship.x - t.x, ship.y - t.y) <= cfg.turretRange) {
          spawnEnemyShot(shots, cfg, t, ship, events);
          t.cooldown = cfg.turretFireInterval * rng.range(0.8, 1.2);
        }
      }
    }
  }
}

/** Marks targets at 0 hp as destroyed and emits `Killed`. Returns how many died. */
export function resolveKills(
  targets: readonly Target[],
  cfg: ArenaConfig,
  events: EventQueue,
): number {
  let kills = 0;
  targets.forEach((t, id) => {
    if (!t.alive || t.hp > 0) return;
    t.alive = false;
    t.respawnTimer = cfg.respawnDelay;
    kills++;
    events.emit({ type: 'Killed', entityId: id, kind: t.kind, x: t.x, y: t.y, radius: t.radius });
  });
  return kills;
}

/**
 * Moves enemy shots and resolves hits on the ship. Returns how many hit the player.
 * Shots pass through an invulnerable ship (evade i-frames).
 */
export function stepEnemyShots(
  shots: EnemyShotPool,
  ship: Ship,
  cfg: ArenaConfig,
  events: EventQueue,
  dt: number,
  /** The hull before this step's hits, only used to say how much is left in `PlayerDamaged` (0 in practice mode). */
  hullBefore = 0,
  /** True while the player is inside the post-hit protection window: bullets pass through like during an evade roll. */
  guarded = false,
  /** True when the first hit of this step starts a protection window: no further bullet hits the ship this step. */
  guardAfterHit = false,
): number {
  const { x, y, vx, vy, life } = shots.data;
  const reach = cfg.playerRadius + cfg.enemyShotRadius;
  let hits = 0;
  for (let i = shots.count - 1; i >= 0; i--) {
    x[i]! += vx[i]! * dt;
    y[i]! += vy[i]! * dt;
    life[i]! -= dt;
    if (life[i]! <= 0) {
      shots.remove(i);
      continue;
    }
    if (ship.invulnerable || guarded || (guardAfterHit && hits > 0)) continue;
    const dx = x[i]! - ship.x;
    const dy = y[i]! - ship.y;
    if (dx * dx + dy * dy > reach * reach) continue;
    const speed = Math.hypot(vx[i]!, vy[i]!) || 1;
    events.emit({
      type: 'Hit',
      x: ship.x,
      y: ship.y,
      dirX: vx[i]! / speed,
      dirY: vy[i]! / speed,
      impulse: 1,
    });
    events.emit({
      type: 'PlayerDamaged',
      x: ship.x,
      y: ship.y,
      hull: Math.max(0, hullBefore - hits - 1),
    });
    shots.remove(i);
    hits++;
  }
  return hits;
}

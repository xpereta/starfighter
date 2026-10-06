import { clamp, DEG, wrapAngle } from '../math';
import { stepSeconds } from '../world/clock';
import type { World } from '../world/world';

/**
 * Enemy missiles (spec section 4, track B). They live in `world.enemies.missiles`, home on the
 * PLAYER ONLY (never a wingman, never a pod: the spec's decision, so wingmen are neither chased nor
 * hit), turn at a limited rate, speed up from a slow launch and burn out after `missileLife`.
 * Fields per missile: `phase` is its age (s), `owner` the index of the launching lancer in
 * `world.fighters`, `damage` the hull points it takes from the player.
 */

/** New heading when turning from `heading` toward `want` by at most `maxTurn` radians. */
export function steerHeading(heading: number, want: number, maxTurn: number): number {
  return heading + clamp(wrapAngle(want - heading), -maxTurn, maxTurn);
}

/** Speed after one step of acceleration, capped at the top speed. */
export function accelerate(speed: number, accel: number, top: number, dt: number): number {
  return Math.min(top, speed + accel * dt);
}

/**
 * Launches one missile from (x, y) along `heading` (the launcher's nose). Returns false when the
 * pool is full (the missile is dropped, no event). Emits `EnemyMissileFired`.
 */
export function launchEnemyMissile(
  world: World,
  x: number,
  y: number,
  heading: number,
  owner: number,
): boolean {
  const cfg = world.tuning.lancer;
  const pool = world.enemies.missiles;
  const i = pool.spawn();
  if (i < 0) return false;
  const d = pool.data;
  d.uid[i] = world.enemies.nextMissileUid++;
  d.x[i] = x;
  d.y[i] = y;
  d.heading[i] = heading;
  d.speed[i] = cfg.launchSpeed;
  d.vx[i] = Math.cos(heading) * cfg.launchSpeed;
  d.vy[i] = Math.sin(heading) * cfg.launchSpeed;
  d.phase[i] = 0;
  d.life[i] = cfg.missileLife;
  d.damage[i] = cfg.missileDamage;
  d.owner[i] = owner;
  world.events.emit({ type: 'EnemyMissileFired', x, y, angle: heading });
  return true;
}

/**
 * Moves every enemy missile one step and resolves it: it expires (`EnemyMissileHit{expired}`), is
 * spent on the player's evade i-frames (`{immune}`, the roll beats it) or hits the player
 * (`{player}`: `Hit` and `PlayerDamaged`, plus a speed knock in practice mode, which has no hull).
 * Returns the hull points taken from the player this step (for `stats.hitsTaken`, which the run
 * charges to the hull; one point per bullet, `missileDamage` per missile). Runs after the player's
 * flight, so `ship.invulnerable` is this step's. Allocation-free.
 */
export function stepEnemyMissiles(world: World): number {
  const pool = world.enemies.missiles;
  const dt = stepSeconds(world);
  if (pool.count === 0 || dt <= 0) return 0;
  const cfg = world.tuning.lancer;
  const { ship, events } = world;
  const reach = world.tuning.arena.playerRadius + cfg.missileRadius;
  const inRun = world.run.mode === 'run';
  // Hull not yet charged by the run (it charges late in the step), so the event says what is left.
  const pending = inRun ? world.stats.hitsTaken - world.run.hitsSeen : 0;
  const hullBefore = inRun ? world.run.hull - pending : 0;
  const d = pool.data;
  let damage = 0;
  for (let i = pool.count - 1; i >= 0; i--) {
    d.life[i]! -= dt;
    d.phase[i]! += dt;
    if (d.life[i]! <= 0) {
      events.emit({ type: 'EnemyMissileHit', x: d.x[i]!, y: d.y[i]!, hit: 'expired' });
      pool.remove(i);
      continue;
    }
    const want = Math.atan2(ship.y - d.y[i]!, ship.x - d.x[i]!);
    d.heading[i] = steerHeading(d.heading[i]!, want, cfg.missileTurnRate * DEG * dt);
    d.speed[i] = accelerate(d.speed[i]!, cfg.missileAccel, cfg.missileMaxSpeed, dt);
    d.vx[i] = Math.cos(d.heading[i]!) * d.speed[i]!;
    d.vy[i] = Math.sin(d.heading[i]!) * d.speed[i]!;
    d.x[i]! += d.vx[i]! * dt;
    d.y[i]! += d.vy[i]! * dt;

    const dx = d.x[i]! - ship.x;
    const dy = d.y[i]! - ship.y;
    if (dx * dx + dy * dy > reach * reach) continue;
    if (ship.invulnerable) {
      // The roll's i-frames beat it: the missile is spent (unlike the player's, which fly on).
      events.emit({ type: 'EnemyMissileHit', x: d.x[i]!, y: d.y[i]!, hit: 'immune' });
      pool.remove(i);
      continue;
    }
    const speed = d.speed[i]! || 1;
    damage += d.damage[i]!;
    events.emit({
      type: 'Hit',
      x: ship.x,
      y: ship.y,
      dirX: d.vx[i]! / speed,
      dirY: d.vy[i]! / speed,
      impulse: cfg.hitImpulse,
    });
    events.emit({
      type: 'PlayerDamaged',
      x: ship.x,
      y: ship.y,
      hull: Math.max(0, hullBefore - damage),
    });
    events.emit({ type: 'EnemyMissileHit', x: d.x[i]!, y: d.y[i]!, hit: 'player' });
    if (!inRun) {
      // Practice has no hull: the hit still counts and shoves, by costing speed (it never stops the ship).
      ship.speed = Math.max(world.tuning.flight.minSpeed, ship.speed - cfg.practiceKnock);
    }
    pool.remove(i);
  }
  return damage;
}

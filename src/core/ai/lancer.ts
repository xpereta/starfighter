import type { FighterConfig } from '../../../data/tuning/fighter';
import type { FlightConfig } from '../../../data/tuning/flight';
import type { LancerConfig } from '../../../data/tuning/lancer';
import { LANCER_RAMP, lancerKind } from '../../../data/content/kinds/lancer';
import { launchEnemyMissile } from '../enemies/enemy-missiles';
import { DEG, wrapAngle } from '../math';
import type { World } from '../world/world';
import { createFighter, type Fighter } from './fighter';
import { createLancerState } from './lancer-state';
import { deriveFlight } from './steering';

export { createLancerState, mixLancer, type LancerState } from './lancer-state';

/** How a lancer moves this step (see `lancerMove`). */
export type LancerMode = 'pursue' | 'flee' | 'aim' | 'circle';

export interface LancerMove {
  /** Heading it wants (rad). */
  desired: number;
  /** -1..1, fed to the flight model. */
  throttle: number;
  mode: LancerMode;
}

/** Angle off the line to the player when it circles in the band (rad). */
export const CIRCLE_ANGLE = 75 * DEG;
/** Angle off the line to the player when it backs away from too close (rad): nearly straight away. */
export const FLEE_ANGLE = 150 * DEG;

/**
 * Where a lancer steers (pure). It keeps the player between `rangeMin` and `rangeMax`: farther
 * out it pursues flat out, closer in it flees flat out (it cannot stop, so it opens the distance
 * by turning away), in the band it points its nose at the player while a missile is due (`ready`:
 * that is the line-up the player can read) and otherwise circles at cruise, `side` picking the way.
 * `bearing` is the heading from the lancer to the player.
 */
export function lancerMove(
  out: LancerMove,
  bearing: number,
  dist: number,
  side: -1 | 1,
  ready: boolean,
  cfg: Pick<LancerConfig, 'rangeMin' | 'rangeMax'>,
): LancerMove {
  // A band edited the wrong way round (max below min) collapses to a line instead of breaking.
  const rangeMax = Math.max(cfg.rangeMax, cfg.rangeMin);
  if (dist > rangeMax) {
    out.mode = 'pursue';
    out.desired = bearing;
    out.throttle = 1;
  } else if (dist < cfg.rangeMin) {
    out.mode = 'flee';
    out.desired = bearing + side * FLEE_ANGLE;
    out.throttle = 1;
  } else if (ready) {
    out.mode = 'aim';
    out.desired = bearing;
    out.throttle = 0;
  } else {
    out.mode = 'circle';
    out.desired = bearing + side * CIRCLE_ANGLE;
    out.throttle = 0;
  }
  return out;
}

/** Missiles per launch in the current battle: pairs from `burstFromBattle` on in runs, single shots otherwise. */
export function burstSizeFor(cfg: LancerConfig, runMode: boolean, battle: number): number {
  return runMode && battle >= cfg.burstFromBattle ? Math.max(1, Math.round(cfg.burstSize)) : 1;
}

/**
 * May a lancer launch now? In the firing band, nose within `launchCone` of the player and not
 * evading or breaking away (it cannot fire while evading). `error` is the angle between its nose
 * and the player.
 */
export function canLaunch(
  cfg: Pick<LancerConfig, 'rangeMin' | 'rangeMax' | 'launchCone'>,
  dist: number,
  error: number,
  evading: boolean,
): boolean {
  return (
    !evading &&
    dist >= cfg.rangeMin &&
    dist <= Math.max(cfg.rangeMax, cfg.rangeMin) &&
    Math.abs(error) <= cfg.launchCone * DEG
  );
}

/** How many fighters of wave `wave` (1-based) of run battle `battle` (1-based) are lancers (`LANCER_RAMP`). */
export function lancersInWave(battle: number, wave: number): number {
  const row = LANCER_RAMP[battle - 1];
  if (!row || row.length === 0 || wave < 1) return 0;
  return row[Math.min(wave, row.length) - 1]!;
}

const moveScratch: LancerMove = { desired: 0, throttle: 0, mode: 'circle' };

/**
 * One lancer's decisions for this step, called from the fighter AI after its break-away and
 * missile-evasion logic (so those behave exactly as for a fighter): writes `f.actions` and may
 * launch. It has no guns. `breaking` = the fighter AI is in a break-away this step.
 */
export function thinkLancer(
  world: World,
  f: Fighter,
  index: number,
  fighterCfg: FighterConfig,
  flight: FlightConfig,
  dt: number,
  breaking: boolean,
): void {
  const l = f.lancer!;
  const cfg = world.tuning.lancer;
  const a = f.actions;
  const ship = f.ship;
  const target = world.ship; // the player only: missiles never go for wingmen
  l.missileTimer = Math.max(0, l.missileTimer - dt);
  l.burstTimer = Math.max(0, l.burstTimer - dt);
  const toX = target.x - ship.x;
  const toY = target.y - ship.y;
  const dist = Math.hypot(toX, toY);
  const bearing = Math.atan2(toY, toX);

  const evading = a.evade || ship.evadeTimer > 0 || breaking;
  if (evading) l.burstLeft = 0; // the rest of a burst is lost: it cannot fire while evading
  const due = l.burstLeft > 0 ? l.burstTimer <= 0 : l.missileTimer <= 0;

  let desired: number;
  let throttle: number;
  if (breaking) {
    // Same break-away as a fighter: hard turn off the line to the player, flat out.
    desired = bearing + f.breakSide * fighterCfg.breakAngle * DEG;
    throttle = 1;
  } else {
    lancerMove(moveScratch, bearing, dist, l.side, due, cfg);
    desired = moveScratch.desired;
    throttle = moveScratch.throttle;
    const off = Math.abs(wrapAngle(desired - ship.heading));
    // Pursuing or circling far off the nose: slow to corner speed so the turn is tighter.
    if (
      moveScratch.mode !== 'flee' &&
      off > fighterCfg.hardTurnAngle * DEG &&
      ship.speed > flight.cornerSpeed
    ) {
      throttle = -1;
    }
  }
  a.steerX = Math.cos(desired);
  a.steerY = Math.sin(desired);
  a.throttle = throttle;

  if (!due || !canLaunch(cfg, dist, wrapAngle(bearing - ship.heading), evading)) return;
  const nx = ship.x + Math.cos(ship.heading) * fighterCfg.muzzleOffset;
  const ny = ship.y + Math.sin(ship.heading) * fighterCfg.muzzleOffset;
  launchEnemyMissile(world, nx, ny, ship.heading, index);
  if (l.burstLeft > 0) {
    l.burstLeft--;
  } else {
    l.missileTimer = cfg.missileInterval;
    l.burstLeft = burstSizeFor(cfg, world.run.mode === 'run', world.run.battle) - 1;
  }
  l.burstTimer = cfg.burstGap;
}

/** Builds a lancer (not yet in `world.fighters`): hull and radius from its kind, speed and turn from `tuning.lancer`. */
export function createLancer(world: World, x: number, y: number, heading: number): Fighter {
  const cfg = world.tuning.lancer;
  const flight = deriveFlight({} as FlightConfig, world.tuning.flight, {
    speedScale: cfg.speedScale,
    turnRateScale: cfg.turnRateScale,
  });
  const f = createFighter(flight, x, y, heading, lancerKind.hull, lancerKind.radius, 0);
  // A staggered first launch, so a pair of lancers does not fire in the same step.
  f.lancer = createLancerState(
    cfg.missileInterval * world.rng.range(0.4, 1),
    world.rng.next() < 0.5 ? -1 : 1,
  );
  return f;
}

/** Adds one lancer, reusing a dead slot in `world.fighters` first (like fighters). Returns its index. */
export function spawnLancer(world: World, x: number, y: number, heading: number): number {
  const lancer = createLancer(world, x, y, heading);
  const dead = world.fighters.findIndex((f) => !f.alive);
  if (dead >= 0) {
    world.fighters[dead] = lancer;
    return dead;
  }
  world.fighters.push(lancer);
  return world.fighters.length - 1;
}

/**
 * Right after a run battle's wave has been spawned: turns `lancersInWave` of its fighters into
 * lancers in place (same slot, position and heading, so the wave size and layout are unchanged).
 * Behind `tuning.lancer.inBattles`; see `LANCER_RAMP`.
 */
export function convertWaveToLancers(world: World): void {
  let n = lancersInWave(world.run.battle, world.run.wave);
  for (let i = 0; i < world.fighters.length && n > 0; i++) {
    const f = world.fighters[i]!;
    if (!f.alive || f.lancer) continue;
    world.fighters[i] = createLancer(world, f.x, f.y, f.ship.heading);
    n--;
  }
}

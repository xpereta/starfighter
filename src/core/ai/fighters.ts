import type { FighterConfig } from '../../../data/tuning/fighter';
import { createFlightConfig } from '../../../data/tuning/flight';
import { stepFlight } from '../flight/flight';
import { DEG, wrapAngle } from '../math';
import { stepSeconds } from '../world/clock';
import { FIGHTER_ID_BASE } from '../world/lockable';
import type { World } from '../world/world';
import { NO_HIT, type Fighter } from './fighter';
import { deriveFlight, leadPoint, noEvents, type Point } from './steering';

export type { Fighter } from './fighter';
export { mixFighters } from './fighter';
export { stepWaves } from './waves';

// Scratch objects, fully overwritten before each use, so stepping allocates nothing.
const flightScratch = createFlightConfig();
const leadScratch: Point = { x: 0, y: 0 };

interface Mover {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Target index for rescue pod `i` (indexes -1 and up are the player and the wingmen). */
export const podTargetIndex = (i: number): number => -2 - i;

/**
 * What a fighter is chasing: the player (-1), a living wingman (0 and up), or a rescue pod
 * (`podTargetIndex`); null if that wingman or pod is gone.
 */
export function targetOf(world: World, index: number): Mover | null {
  if (index === -1) return world.ship;
  if (index <= -2) {
    const pod = world.pods[-2 - index];
    return pod && pod.alive ? pod : null;
  }
  const wingman = world.squadron.wingmen[index];
  return wingman && wingman.alive ? wingman.ship : null;
}

/**
 * The nearest of the player (-1), the living wingmen and the rescue pods within `podThreatRange`
 * to (x, y).
 */
export function chooseTarget(world: World, x: number, y: number): number {
  let best = -1;
  let bestSq = (world.ship.x - x) ** 2 + (world.ship.y - y) ** 2;
  const wingmen = world.squadron.wingmen;
  for (let i = 0; i < wingmen.length; i++) {
    const w = wingmen[i]!;
    if (!w.alive) continue;
    const sq = (w.ship.x - x) ** 2 + (w.ship.y - y) ** 2;
    if (sq < bestSq) {
      best = i;
      bestSq = sq;
    }
  }
  const range = world.tuning.rescue.podThreatRange;
  for (let i = 0; i < world.pods.length; i++) {
    const p = world.pods[i]!;
    if (!p.alive) continue;
    const sq = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (sq < bestSq && sq <= range * range) {
      best = podTargetIndex(i);
      bestSq = sq;
    }
  }
  return best;
}

function startBreak(world: World, f: Fighter, cfg: FighterConfig): void {
  f.breakTimer = cfg.breakTime;
  f.breakCooldown = cfg.breakTime + cfg.breakCooldown;
  f.breakSide = world.rng.next() < 0.5 ? -1 : 1;
  f.hitTimeA = NO_HIT; // the hits that triggered it are spent
  f.hitTimeB = NO_HIT;
  f.actions.evade = true; // one step of "pressed": the flight model edge-triggers the evade roll
}

function shoot(world: World, f: Fighter, cfg: FighterConfig): void {
  f.fireCooldown = 1 / cfg.fireRate;
  const shots = world.enemyShots;
  const k = shots.spawn();
  if (k < 0) return; // pool full: the shot is dropped
  const ship = f.ship;
  const angle = ship.heading + world.rng.range(-cfg.spread, cfg.spread) * DEG;
  shots.data.x[k] = ship.x + Math.cos(ship.heading) * cfg.muzzleOffset;
  shots.data.y[k] = ship.y + Math.sin(ship.heading) * cfg.muzzleOffset;
  shots.data.vx[k] = ship.vx + Math.cos(angle) * cfg.bulletSpeed;
  shots.data.vy[k] = ship.vy + Math.sin(angle) * cfg.bulletSpeed;
  shots.data.life[k] = cfg.bulletLife;
  world.events.emit({
    type: 'EnemyShotFired',
    x: shots.data.x[k]!,
    y: shots.data.y[k]!,
    angle,
    from: 'fighter',
  });
}

/** One fighter's decisions for this step: writes `f.actions` and may fire. */
function think(world: World, f: Fighter, index: number, cfg: FighterConfig, dt: number): void {
  // Notice new hits (hp dropped since last step).
  if (f.hp < f.lastHp) {
    f.hitTimeA = f.hitTimeB;
    f.hitTimeB = world.time;
  }
  f.lastHp = f.hp;
  f.breakTimer = Math.max(0, f.breakTimer - dt);
  f.breakCooldown = Math.max(0, f.breakCooldown - dt);
  f.fireCooldown = Math.max(0, f.fireCooldown - dt);

  // Target: nearest of the player and wingmen, re-picked every retargetInterval.
  f.retargetTimer -= dt;
  let target = targetOf(world, f.targetIndex);
  if (!target || f.retargetTimer <= 0) {
    f.targetIndex = chooseTarget(world, f.ship.x, f.ship.y);
    f.retargetTimer = cfg.retargetInterval;
    target = targetOf(world, f.targetIndex)!;
  }

  // Break away after two hits in a short window, or when the player has it locked.
  const a = f.actions;
  a.evade = false;
  if (f.breakTimer <= 0 && f.breakCooldown <= 0) {
    const hitTwice = f.hitTimeA > NO_HIT / 2 && f.hitTimeB - f.hitTimeA <= cfg.breakHitWindow;
    if (hitTwice || world.lockon.locks.includes(FIGHTER_ID_BASE + index)) startBreak(world, f, cfg);
  }

  const ship = f.ship;
  const toX = target.x - ship.x;
  const toY = target.y - ship.y;
  const dist = Math.hypot(toX, toY);
  const breaking = f.breakTimer > 0;
  let desired: number;
  let throttle = 0;
  if (breaking) {
    // Hard turn away from the line to the target, flat out.
    desired = Math.atan2(toY, toX) + f.breakSide * cfg.breakAngle * DEG;
    throttle = 1;
  } else {
    leadPoint(leadScratch, ship, target, cfg.bulletSpeed, cfg.leadTimeMax);
    desired = Math.atan2(leadScratch.y - ship.y, leadScratch.x - ship.x);
    if (dist > cfg.fireRange) throttle = 1;
    else if (dist < cfg.minRange) throttle = -0.5;
  }
  const error = wrapAngle(desired - ship.heading);
  // Far off the nose: slow to corner speed so the turn is tighter.
  if (
    !breaking &&
    Math.abs(error) > cfg.hardTurnAngle * DEG &&
    ship.speed > flightScratch.cornerSpeed
  ) {
    throttle = -1;
  }
  a.steerX = Math.cos(desired);
  a.steerY = Math.sin(desired);
  a.throttle = throttle;

  if (
    !breaking &&
    f.fireCooldown <= 0 &&
    dist <= cfg.fireRange &&
    Math.abs(error) <= cfg.fireCone * DEG
  ) {
    shoot(world, f, cfg);
  }
}

/**
 * Enemy fighters (spec section 3): each picks a target, flies at a lead point on the same flight
 * model as the player (with its own derived config), shoots, and breaks away when hit or locked.
 * Runs after the player's flight each step.
 */
export function stepFighters(world: World): void {
  const dt = stepSeconds(world);
  if (dt <= 0) return;
  if (world.tuning.arena.enemiesFrozen) {
    // Debug freeze: fighters hold their place and do not think, fly or shoot.
    for (const f of world.fighters) {
      f.vx = 0;
      f.vy = 0;
    }
    return;
  }
  const cfg = world.tuning.fighter;
  deriveFlight(flightScratch, world.tuning.flight, cfg);
  for (let i = 0; i < world.fighters.length; i++) {
    const f = world.fighters[i]!;
    if (!f.alive) continue;
    think(world, f, i, cfg, dt);
    stepFlight(f.ship, f.actions, flightScratch, noEvents, dt);
    f.x = f.ship.x;
    f.y = f.ship.y;
    f.vx = f.ship.vx;
    f.vy = f.ship.vy;
    f.immune = f.ship.invulnerable;
  }
}

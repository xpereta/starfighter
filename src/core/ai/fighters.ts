import type { FighterConfig } from '../../../data/tuning/fighter';
import { createFlightConfig } from '../../../data/tuning/flight';
import { stepFlight } from '../flight/flight';
import { clamp, DEG, wrapAngle } from '../math';
import { boostFlight, catchUpFactor } from '../squadron/formation';
import type { WingState } from '../enemies/state';
import { stepSeconds } from '../world/clock';
import { FIGHTER_ID_BASE } from '../world/lockable';
import type { World } from '../world/world';
import { NO_HIT, SHIP_GUNSHIP, type Fighter } from './fighter';
import { gunshipFlight, thinkGunship } from './gunship';
import { inFormation, isLeader, slotOffset, slotWorld, stepWings } from './wings';
import {
  awarenessChance,
  PLAN_DONE,
  PLAN_IGNORE,
  PLAN_REACT,
  reactionTrigger,
  timeToImpact,
} from './missile-evasion';
import { thinkLancer } from './lancer';
import { deriveFlight, leadPoint, noEvents, type Point } from './steering';

export type { Fighter } from './fighter';
export { mixFighters } from './fighter';
export { stepWaves } from './waves';

// Scratch objects, fully overwritten before each use, so stepping allocates nothing.
const flightScratch = createFlightConfig();
const gunshipScratch = createFlightConfig();
const followerScratch = createFlightConfig();
const slotOffsetScratch = { x: 0, y: 0 };
const slotScratch = { x: 0, y: 0 };

/** Speed error (u/s) at which a wing follower uses full throttle or brake to hold its slot. */
const SPEED_BAND = 100;
/** Angle off the slot direction (rad) beyond which a follower limits itself to corner speed to turn. */
const TURN_FIRST_ANGLE = 60 * DEG;
/** How quickly a speed mismatch with the leader (as a fraction of the speed range) turns on the catch-up boost. */
const SPEED_MISMATCH_BOOST_GAIN = 4;
const lancerFlightScratch = createFlightConfig();
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

/**
 * Missile evasion. Tracks the nearest missile homing on this fighter inside `missileDetectRange`;
 * the first time it sees a given missile it rolls awareness once (`awarenessChance`) and a
 * reaction error once, then fires the evade roll (plus a hard turn) when the estimated time to
 * impact drops to the trigger. The roll needs `missileEvadeCooldown` to have run out and no roll
 * in progress (which is also what lets a salvo at one fighter land hits); a mistimed or blocked
 * roll is simply hit. All randomness is the world rng, all state is on the fighter (and in the hash).
 */
function evadeMissiles(
  world: World,
  f: Fighter,
  index: number,
  cfg: FighterConfig,
  flight: typeof flightScratch,
): void {
  f.missileCooldown = Math.max(0, f.missileCooldown - stepSeconds(world));
  const m = world.missiles;
  const d = m.data;
  const id = FIGHTER_ID_BASE + index;
  const rangeSq = cfg.missileDetectRange * cfg.missileDetectRange;
  let best = -1;
  let bestSq = rangeSq;
  for (let i = 0; i < m.count; i++) {
    if (d.targetId[i] !== id) continue;
    const sq = (d.x[i]! - f.x) ** 2 + (d.y[i]! - f.y) ** 2;
    if (sq <= bestSq) {
      best = i;
      bestSq = sq;
    }
  }
  if (best < 0) {
    f.missileUid = -1;
    f.missilePlan = PLAN_IGNORE;
    return;
  }
  const uid = d.uid[best]!;
  if (uid !== f.missileUid) {
    // A new missile: decide once whether to react and how well it will time it.
    f.missileUid = uid;
    const aware = world.rng.next() < awarenessChance(cfg, Math.sqrt(bestSq));
    const error = world.rng.range(-cfg.missileReactionError, cfg.missileReactionError);
    f.missilePlan = aware ? PLAN_REACT : PLAN_IGNORE;
    f.missileTrigger = reactionTrigger(flight.evadeIFrames, error);
  }
  if (f.missilePlan !== PLAN_REACT) return;
  const eta = timeToImpact(
    d.x[best]! - f.x,
    d.y[best]! - f.y,
    d.vx[best]! - f.vx,
    d.vy[best]! - f.vy,
  );
  if (eta > f.missileTrigger) return;
  f.missilePlan = PLAN_DONE; // one attempt per missile, on time or not
  const ship = f.ship;
  if (f.missileCooldown > 0 || ship.evadeTimer > 0) return; // still recovering: this one lands
  f.missileCooldown = cfg.missileEvadeCooldown;
  ship.evadeCooldown = 0; // the missile roll has its own cooldown, not the break-away's
  f.actions.evade = true;
}

/** One fighter's decisions for this step: writes `f.actions` and may fire. */
function think(
  world: World,
  f: Fighter,
  index: number,
  cfg: FighterConfig,
  flight: typeof flightScratch,
  dt: number,
): void {
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
  if (f.lancer) {
    // A lancer only ever goes for the player: its missiles never chase wingmen (spec section 11).
    f.targetIndex = -1;
    target = world.ship;
  } else if (!target || f.retargetTimer <= 0) {
    f.targetIndex = chooseTarget(world, f.ship.x, f.ship.y);
    f.retargetTimer = cfg.retargetInterval;
    target = targetOf(world, f.targetIndex)!;
  }

  // Break away after two hits in a short window, or when the player has it locked.
  const a = f.actions;
  a.evade = false;
  if (f.breakTimer <= 0 && f.breakCooldown <= 0) {
    const hitTwice = f.hitTimeA > NO_HIT / 2 && f.hitTimeB - f.hitTimeA <= cfg.breakHitWindow;
    // A wing leader keeps its course while its formation holds (a lock does not scare it off).
    const locked =
      !isLeader(world, f, index) && world.lockon.locks.includes(FIGHTER_ID_BASE + index);
    if (hitTwice || locked) startBreak(world, f, cfg);
  }

  if (cfg.enemiesEvadeMissiles) evadeMissiles(world, f, index, cfg, flight);

  if (f.lancer) {
    // Same break-away and missile evasion as above; its own range keeping and launching (lancer.ts).
    thinkLancer(world, f, index, cfg, flight, dt, f.breakTimer > 0);
    return;
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
  if (!breaking && Math.abs(error) > cfg.hardTurnAngle * DEG && ship.speed > flight.cornerSpeed) {
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
 * A wing follower's decisions for this step (spec section 2): fly to its slot on the leader (the
 * squadron's slot logic: hold radius, lead time, catch-up boost), match the leader's speed, and
 * shoot the leader's target when it is under the nose. Returns the catch-up factor for the flight
 * model (0 in the slot, up to 1 when far or going the wrong speed).
 */
function thinkFollower(
  world: World,
  f: Fighter,
  wing: WingState,
  leader: Fighter,
  cfg: FighterConfig,
  dt: number,
): number {
  f.lastHp = f.hp;
  f.fireCooldown = Math.max(0, f.fireCooldown - dt);
  f.targetIndex = leader.targetIndex;
  const target = targetOf(world, f.targetIndex) ?? world.ship;

  const sq = world.tuning.squadron;
  const ship = f.ship;
  const lship = leader.ship;
  slotWorld(
    slotScratch,
    lship,
    slotOffset(slotOffsetScratch, wing.shape, f.wingSlot, world.tuning.wings.slotRadius),
  );
  const sx = slotScratch.x - ship.x;
  const sy = slotScratch.y - ship.y;
  const slotDist = Math.hypot(sx, sy);
  const toTarget = Math.hypot(target.x - ship.x, target.y - ship.y);
  leadPoint(leadScratch, ship, target, cfg.bulletSpeed, cfg.leadTimeMax);
  const aim = Math.atan2(leadScratch.y - ship.y, leadScratch.x - ship.x);
  // At the slot: point at the target once it is in range (so the whole wing fires together, the
  // slot hold keeps the shape), else match the leader's heading. Otherwise fly to the slot, aiming a little ahead of it.
  const desired =
    slotDist < sq.slotHoldRadius
      ? toTarget <= cfg.fireRange
        ? aim
        : lship.heading
      : Math.atan2(sy + lship.vy * sq.slotLeadTime, sx + lship.vx * sq.slotLeadTime);
  const along = sx * Math.cos(ship.heading) + sy * Math.sin(ship.heading);
  const range = flightScratch.maxSpeed - flightScratch.minSpeed;
  const speedGap = (lship.speed - ship.speed) / Math.max(range, 1e-6);
  const catchUp = Math.max(
    catchUpFactor(slotDist, sq),
    clamp(Math.abs(speedGap) * SPEED_MISMATCH_BOOST_GAIN, 0, 1),
  );
  let targetSpeed = lship.speed + along * sq.slotSpeedGain;
  const off = Math.abs(wrapAngle(desired - ship.heading));
  const straight = clamp(1 - off / TURN_FIRST_ANGLE, 0, 1);
  targetSpeed = Math.min(
    targetSpeed,
    flightScratch.cornerSpeed + (targetSpeed - flightScratch.cornerSpeed) * straight,
  );
  const a = f.actions;
  a.evade = false;
  a.steerX = Math.cos(desired);
  a.steerY = Math.sin(desired);
  a.throttle = clamp((targetSpeed - ship.speed) / SPEED_BAND, -1, 1);

  if (
    f.fireCooldown <= 0 &&
    toTarget <= cfg.fireRange &&
    Math.abs(wrapAngle(aim - ship.heading)) <= cfg.fireCone * DEG
  ) {
    shoot(world, f, cfg);
  }
  return catchUp;
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
  gunshipFlight(gunshipScratch, world);
  deriveFlight(lancerFlightScratch, world.tuning.flight, {
    speedScale: world.tuning.lancer.speedScale,
    turnRateScale: world.tuning.lancer.turnRateScale,
  });
  stepWings(world);
  for (let i = 0; i < world.fighters.length; i++) {
    const f = world.fighters[i]!;
    if (!f.alive) continue;
    if (f.shipType === SHIP_GUNSHIP) {
      thinkGunship(world, f, i, dt);
      stepFlight(f.ship, f.actions, gunshipScratch, noEvents, dt);
    } else if (inFormation(world, f) && !isLeader(world, f, i)) {
      const wing = world.enemies.wings[f.wingId]!;
      const leader = world.fighters[wing.leader]!; // alive, or stepWings would have broken the wing
      const catchUp = thinkFollower(world, f, wing, leader, cfg, dt);
      boostFlight(followerScratch, flightScratch, world.tuning.squadron, catchUp);
      stepFlight(f.ship, f.actions, followerScratch, noEvents, dt);
    } else {
      const flight = f.lancer ? lancerFlightScratch : flightScratch;
      think(world, f, i, cfg, flight, dt);
      stepFlight(f.ship, f.actions, flight, noEvents, dt);
    }
    f.x = f.ship.x;
    f.y = f.ship.y;
    f.vx = f.ship.vx;
    f.vy = f.ship.vy;
    f.immune = f.ship.invulnerable;
  }
}

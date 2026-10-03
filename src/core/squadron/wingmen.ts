import type { SquadronConfig } from '../../../data/tuning/squadron';
import { createFlightConfig } from '../../../data/tuning/flight';
import { leadPoint, noEvents, type Point } from '../ai/steering';
import { createShip, stepFlight } from '../flight/flight';
import { clamp, DEG, wrapAngle } from '../math';
import { createActions } from '../world/actions';
import { stepSeconds } from '../world/clock';
import { FIGHTER_ID_BASE } from '../world/lockable';
import type { World } from '../world/world';
import { slotPosition } from './formation';
import type { Wingman } from './squadron';

/** A wingman keeps closing in until it is this fraction of its fire range from its target. */
const CLOSE_IN_FRACTION = 0.8;
/** An engaged enemy is only dropped once it is this much beyond the engage range (no flicker at the edge). */
const ENGAGE_HYSTERESIS = 1.25;
/** Speed difference over the full speed range, doubled so a large gap saturates the throttle. */
const SPEED_MATCH_GAIN = 2;
/** Every enemy bullet that hits a wingman takes this many hit points. */
const ENEMY_SHOT_DAMAGE = 1;

// Scratch values, overwritten before each use, so stepping allocates nothing.
const flightScratch = createFlightConfig();
const slot: Point = { x: 0, y: 0 };
const lead: Point = { x: 0, y: 0 };
let pushX = 0;
let pushY = 0;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
}

/** The enemy behind a lockable id (see core/world/lockable.ts), or null. */
export function bodyOf(world: World, id: number): Body | null {
  if (id < 0) return null;
  const body = id >= FIGHTER_ID_BASE ? world.fighters[id - FIGHTER_ID_BASE] : world.targets[id];
  return body ?? null;
}

/** Fighters, drones and turrets are worth chasing; static targets are only practice dummies. */
function engageable(
  world: World,
  w: Wingman,
  id: number,
  body: Body,
  cfg: SquadronConfig,
  slack: number,
): boolean {
  if (!body.alive) return false;
  if (id < FIGHTER_ID_BASE && world.targets[id]!.kind === 'static') return false;
  if (world.squadron.formation === 'tight') {
    // Tight: only what threatens the player, measured from the player.
    const range = cfg.tightEngageRange * slack;
    return (body.x - world.ship.x) ** 2 + (body.y - world.ship.y) ** 2 <= range * range;
  }
  const range = cfg.spreadEngageRange * slack;
  return (body.x - w.ship.x) ** 2 + (body.y - w.ship.y) ** 2 <= range * range;
}

/**
 * Keeps the current enemy while it stays valid, otherwise picks the nearest engageable one (-1 for
 * none). Under an attack order every wingman goes for the order's target, whatever the range.
 */
function pickEngaged(world: World, w: Wingman, cfg: SquadronConfig): number {
  if (world.squadron.order === 'attack') return world.squadron.orderTargetId;
  const current = bodyOf(world, w.engagedId);
  if (current && engageable(world, w, w.engagedId, current, cfg, ENGAGE_HYSTERESIS)) {
    return w.engagedId;
  }
  let best = -1;
  let bestSq = Infinity;
  const consider = (id: number, body: Body): void => {
    if (!engageable(world, w, id, body, cfg, 1)) return;
    const sq = (body.x - w.ship.x) ** 2 + (body.y - w.ship.y) ** 2;
    if (sq < bestSq) {
      best = id;
      bestSq = sq;
    }
  };
  world.fighters.forEach((f, i) => consider(FIGHTER_ID_BASE + i, f));
  world.targets.forEach((t, i) => consider(i, t));
  return best;
}

/** Puts a wingman on its formation slot, flying the player's velocity. */
function place(w: Wingman, world: World, index: number, count: number): void {
  const player = world.ship;
  slotPosition(slot, world.squadron.formation, index, count, player, world.tuning.squadron);
  const s = w.ship;
  s.x = slot.x;
  s.y = slot.y;
  s.heading = player.heading;
  s.omega = 0;
  s.speed = player.speed;
  s.vx = player.vx;
  s.vy = player.vy;
}

export function createWingman(world: World, index: number, count: number): Wingman {
  const wingman: Wingman = {
    ship: createShip(world.tuning.flight),
    hp: world.tuning.squadron.health,
    alive: true,
    actions: createActions(),
    fireCooldown: 0,
    engagedId: -1,
    respawnTimer: 0,
  };
  place(wingman, world, index, count);
  return wingman;
}

/** Grows or shrinks the wingman list to `wingmanCount` (this also re-creates them after a respawn). */
function syncCount(world: World): number {
  const wingmen = world.squadron.wingmen;
  const count = world.tuning.squadron.wingmanCount;
  while (wingmen.length < count) wingmen.push(createWingman(world, wingmen.length, count));
  if (wingmen.length > count) wingmen.length = count;
  return count;
}

function revive(w: Wingman, world: World, index: number, count: number): void {
  Object.assign(w.ship, createShip(world.tuning.flight));
  w.hp = world.tuning.squadron.health;
  w.alive = true;
  w.fireCooldown = 0;
  w.engagedId = -1;
  w.respawnTimer = 0;
  place(w, world, index, count);
}

/** Enemy bullets that reach a wingman hit it; at 0 hp it is shot down and returns after `respawnDelay`. */
function takeEnemyFire(world: World, w: Wingman, index: number, cfg: SquadronConfig): void {
  const shots = world.enemyShots;
  const { x, y, vx, vy } = shots.data;
  const reach = cfg.radius + world.tuning.arena.enemyShotRadius;
  for (let k = shots.count - 1; k >= 0; k--) {
    const dx = x[k]! - w.ship.x;
    const dy = y[k]! - w.ship.y;
    if (dx * dx + dy * dy > reach * reach) continue;
    const speed = Math.hypot(vx[k]!, vy[k]!) || 1;
    world.events.emit({
      type: 'Hit',
      x: w.ship.x,
      y: w.ship.y,
      dirX: vx[k]! / speed,
      dirY: vy[k]! / speed,
      impulse: 1,
    });
    shots.remove(k);
    w.hp -= ENEMY_SHOT_DAMAGE;
    if (w.hp <= 0) {
      w.alive = false;
      w.respawnTimer = cfg.respawnDelay;
      w.engagedId = -1;
      world.events.emit({
        type: 'Killed',
        entityId: index,
        kind: 'wingman',
        x: w.ship.x,
        y: w.ship.y,
        radius: cfg.radius,
      });
      return;
    }
  }
}

/** Adds the push away from something closer than `separation` to the heading vector being built. */
function addSeparation(sx: number, sy: number, ox: number, oy: number, cfg: SquadronConfig): void {
  const dx = sx - ox;
  const dy = sy - oy;
  const d = Math.hypot(dx, dy);
  if (d >= cfg.separation || d < 1e-6) return;
  const push = (1 - d / cfg.separation) * cfg.separationGain;
  pushX += (dx / d) * push;
  pushY += (dy / d) * push;
}

function shoot(world: World, w: Wingman, cfg: SquadronConfig): void {
  w.fireCooldown = 1 / cfg.fireRate;
  const bullets = world.bullets;
  const k = bullets.spawn();
  if (k < 0) return; // pool full: the shot is dropped
  const weapons = world.tuning.weapons;
  const s = w.ship;
  const angle = s.heading + world.rng.range(-cfg.spread, cfg.spread) * DEG;
  bullets.data.x[k] = s.x + Math.cos(s.heading) * cfg.muzzleOffset;
  bullets.data.y[k] = s.y + Math.sin(s.heading) * cfg.muzzleOffset;
  bullets.data.vx[k] = s.vx + Math.cos(angle) * weapons.bulletSpeed;
  bullets.data.vy[k] = s.vy + Math.sin(angle) * weapons.bulletSpeed;
  bullets.data.life[k] = weapons.bulletLife;
  bullets.data.damage[k] = cfg.gunDamage;
}

/** One wingman's decisions for this step: pick an enemy or hold the slot, avoid collisions, maybe shoot. */
function think(
  world: World,
  w: Wingman,
  index: number,
  count: number,
  cfg: SquadronConfig,
  dt: number,
): void {
  const ship = w.ship;
  const player = world.ship;
  const a = w.actions;
  w.fireCooldown = Math.max(0, w.fireCooldown - dt);
  w.engagedId = pickEngaged(world, w, cfg);
  const enemy = bodyOf(world, w.engagedId);

  let aim = ship.heading; // where the guns should point (only meaningful with an enemy)
  let desired: number;
  let throttle: number;
  let dist = 0;
  if (enemy) {
    const bulletSpeed = world.tuning.weapons.bulletSpeed;
    leadPoint(lead, ship, enemy, bulletSpeed, cfg.fireRange / bulletSpeed);
    aim = Math.atan2(lead.y - ship.y, lead.x - ship.x);
    desired = aim;
    dist = Math.hypot(enemy.x - ship.x, enemy.y - ship.y);
    throttle = dist > cfg.fireRange * CLOSE_IN_FRACTION ? 1 : 0;
  } else {
    slotPosition(slot, world.squadron.formation, index, count, player, cfg);
    const dx = slot.x + player.vx * cfg.slotLeadTime - ship.x;
    const dy = slot.y + player.vy * cfg.slotLeadTime - ship.y;
    // At the slot: just match the player's heading. Otherwise fly to it, matching speed.
    desired = Math.hypot(dx, dy) < cfg.slotHoldRadius ? player.heading : Math.atan2(dy, dx);
    const along = dx * Math.cos(ship.heading) + dy * Math.sin(ship.heading);
    const flight = world.tuning.flight;
    const speedGap = (player.speed - ship.speed) / (flight.maxSpeed - flight.minSpeed);
    throttle = clamp(along / cfg.catchUpRange + speedGap * SPEED_MATCH_GAIN, -1, 1);
  }

  // Collision avoidance: steer away from the player and from the other living wingmen.
  pushX = 0;
  pushY = 0;
  addSeparation(ship.x, ship.y, player.x, player.y, cfg);
  world.squadron.wingmen.forEach((other, j) => {
    if (j !== index && other.alive) addSeparation(ship.x, ship.y, other.ship.x, other.ship.y, cfg);
  });
  const dirX = Math.cos(desired) + pushX;
  const dirY = Math.sin(desired) + pushY;
  if (Math.hypot(dirX, dirY) > 1e-6) desired = Math.atan2(dirY, dirX);

  a.evade = false;
  a.steerX = Math.cos(desired);
  a.steerY = Math.sin(desired);
  a.throttle = throttle;

  if (
    enemy &&
    w.fireCooldown <= 0 &&
    dist <= cfg.fireRange &&
    Math.abs(wrapAngle(aim - ship.heading)) <= cfg.fireCone * DEG
  ) {
    shoot(world, w, cfg);
  }
}

/**
 * Wingmen (spec section 4): created from `wingmanCount`, they hold their formation slot at the
 * player's velocity, engage enemies (tight: near the player; spread: anywhere near themselves),
 * shoot with reduced damage, and can be shot down by enemy bullets.
 */
export function stepWingmen(world: World): void {
  const dt = stepSeconds(world);
  if (dt <= 0) return;
  const cfg = world.tuning.squadron;
  const count = syncCount(world);
  Object.assign(flightScratch, world.tuning.flight);
  flightScratch.steering = 'point'; // the AI always steers point-to-steer
  world.squadron.wingmen.forEach((w, i) => {
    if (!w.alive) {
      w.respawnTimer -= dt;
      if (w.respawnTimer <= 0) revive(w, world, i, count);
      return;
    }
    takeEnemyFire(world, w, i, cfg);
    if (!w.alive) return;
    think(world, w, i, count, cfg, dt);
    stepFlight(w.ship, w.actions, flightScratch, noEvents, dt);
  });
}

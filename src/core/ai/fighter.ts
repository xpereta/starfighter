import type { FlightConfig } from '../../../data/tuning/flight';
import { createShip, type Ship } from '../flight/flight';
import { createActions, type Actions } from '../world/actions';
import type { Collider } from '../world/target';
import type { MountState } from './mount-aim';

/** Sentinel for "no hit yet" in the hit memory (far enough in the past that no window reaches it). */
export const NO_HIT = -1e9;

/** What a `Fighter` entry is: every flying enemy lives in `world.fighters` (ids, locks, kills and waves come for free). */
export const SHIP_FIGHTER = 0;
export const SHIP_GUNSHIP = 1;

/**
 * Enemy fighter (spec section 3). It flies with the same flight model as the player: the AI only
 * writes `actions`. Contract: it is a `Collider` (bullets and missiles can hit it) with a velocity
 * kept in sync with `ship`, and its lockable id is `FIGHTER_ID_BASE + index` in `world.fighters`.
 */
export interface Fighter extends Collider {
  vx: number;
  vy: number;
  maxHp: number;
  ship: Ship;
  /** AI-produced intent for the current step, fed to `stepFlight`. */
  actions: Actions;
  /** Who it is chasing: -1 = the player, otherwise an index into `world.squadron.wingmen`. */
  targetIndex: number;
  /** Seconds until it re-picks its target. */
  retargetTimer: number;
  /** Seconds until the next shot. */
  fireCooldown: number;
  /** Seconds left in the current break-away (0 = not breaking). */
  breakTimer: number;
  /** Seconds until it may break away again. */
  breakCooldown: number;
  /** Which way the break-away turns: -1 right, +1 left of the line to the target. */
  breakSide: -1 | 1;
  /** hp seen last step, to notice new hits. */
  lastHp: number;
  /** Times (world.time) of the last two hits, oldest first; NO_HIT when none. */
  hitTimeA: number;
  hitTimeB: number;
  /** Seconds until it may roll away from a missile again. */
  missileCooldown: number;
  /** `uid` of the homing missile it is currently tracking (-1 = none), so each missile is decided once. */
  missileUid: number;
  /** Decision on the tracked missile: 0 = ignore it, 1 = will react, 2 = has reacted (or tried). */
  missilePlan: number;
  /** Time to impact (s) at or below which it reacts to the tracked missile (reaction error included). */
  missileTrigger: number;
  /** Which kind of ship this is (`SHIP_FIGHTER`, `SHIP_GUNSHIP`); decides the AI that drives it. */
  shipType: number;
  /** Weapon mounts with their state (gunship turrets); empty for a plain fighter, which has its one fixed gun. */
  mounts: MountState[];
  /** world.time when it died (NO_HIT while alive); the next wave waits `waveDelay` after the last one. */
  diedAt: number;
}

export function createFighter(
  flight: FlightConfig,
  x: number,
  y: number,
  heading: number,
  health: number,
  radius: number,
  retargetTimer: number,
): Fighter {
  const ship = createShip(flight);
  ship.x = x;
  ship.y = y;
  ship.heading = heading;
  ship.vx = Math.cos(heading) * ship.speed;
  ship.vy = Math.sin(heading) * ship.speed;
  return {
    x,
    y,
    vx: ship.vx,
    vy: ship.vy,
    radius,
    hp: health,
    maxHp: health,
    alive: true,
    immune: false,
    ship,
    actions: createActions(),
    targetIndex: -1,
    retargetTimer,
    fireCooldown: 0,
    breakTimer: 0,
    breakCooldown: 0,
    breakSide: 1,
    lastHp: health,
    hitTimeA: NO_HIT,
    hitTimeB: NO_HIT,
    missileCooldown: 0,
    missileUid: -1,
    missilePlan: 0,
    missileTrigger: 0,
    shipType: SHIP_FIGHTER,
    mounts: [],
    diedAt: NO_HIT,
    lastHitBy: 0,
  };
}

/** Puts a fighter in the first dead slot of the list (so the array stays small and ids stay stable), or at the end. Returns its index. */
export function placeFighter(fighters: Fighter[], fighter: Fighter): number {
  const dead = fighters.findIndex((f) => !f.alive);
  if (dead >= 0) {
    fighters[dead] = fighter;
    return dead;
  }
  fighters.push(fighter);
  return fighters.length - 1;
}

/** Feeds fighter state into the replay hash. Add every field you add to `Fighter`. */
export function mixFighters(mix: (n: number) => void, fighters: readonly Fighter[]): void {
  mix(fighters.length);
  for (const f of fighters) {
    mix(f.x);
    mix(f.y);
    mix(f.vx);
    mix(f.vy);
    mix(f.hp);
    mix(f.maxHp);
    mix(f.radius);
    mix(f.alive ? 1 : 0);
    mix(f.immune ? 1 : 0);
    const s = f.ship;
    for (const v of [s.x, s.y, s.heading, s.omega, s.speed, s.vx, s.vy]) mix(v);
    for (const v of [s.evadeTimer, s.evadeCooldown, s.evadeSide, s.roll]) mix(v);
    mix(s.evadeHeld ? 1 : 0);
    mix(s.invulnerable ? 1 : 0);
    mix(f.targetIndex);
    mix(f.retargetTimer);
    mix(f.fireCooldown);
    mix(f.breakTimer);
    mix(f.breakCooldown);
    mix(f.breakSide);
    mix(f.lastHp);
    mix(f.hitTimeA);
    mix(f.hitTimeB);
    mix(f.missileCooldown);
    mix(f.missileUid);
    mix(f.missilePlan);
    mix(f.missileTrigger);
    mix(f.shipType);
    mix(f.mounts.length);
    for (const m of f.mounts) {
      mix(m.aim);
      mix(m.cooldown);
      mix(m.burstLeft);
      mix(m.pause);
    }
    mix(f.diedAt);
    mix(f.lastHitBy ?? 0);
  }
}

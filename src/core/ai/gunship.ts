import { ENEMY_KINDS } from '../../../data/content/enemies';
import type { FlightConfig } from '../../../data/tuning/flight';
import type { GunshipConfig } from '../../../data/tuning/gunship';
import type { WeaponMount } from '../enemies/mounts';
import { clamp, DEG, wrapAngle } from '../math';
import { FIGHTER_ID_BASE } from '../world/lockable';
import type { World } from '../world/world';
import { createFighter, placeFighter, SHIP_GUNSHIP, type Fighter } from './fighter';
import { clampToArc, createMountState, inArc, slewAngle, stepBurst } from './mount-aim';
import { deriveFlight, leadPoint, type Point } from './steering';

/** Longest a turret leads a target (s): the lead of a very distant target is capped. */
const LEAD_TIME_MAX = 1.5;
/** Throttle is only touched when the gunship is this far (as a fraction of the band) from its standoff distance. */
const THROTTLE_BAND = 0.5;
/** Angle off the line to the player at which it circles broadside (rad); 0 = straight at, pi = straight away. */
const BROADSIDE = Math.PI / 2;

// Scratch values, fully overwritten before each use, so stepping allocates nothing.
const mountScratch: WeaponMount = {
  id: '',
  x: 0,
  y: 0,
  arcCenter: 0,
  arcHalf: 0,
  fireRate: 1,
  bulletSpeed: 1,
  bulletDamage: 1,
  bulletLife: 1,
  range: 1,
  spread: 0,
  burst: { shots: 1, pause: 0 },
};
const shooter = { x: 0, y: 0, vx: 0, vy: 0 };
const lead: Point = { x: 0, y: 0 };
const scale = { speedScale: 0, turnRateScale: 0 };

/** The kind's mount with the live `gunship` tuning on top (the panel edits apply at once). Fills and returns a scratch mount. */
export function tunedMount(base: WeaponMount, cfg: GunshipConfig): WeaponMount {
  const side = Math.sign(base.y) || 1;
  const m = mountScratch;
  m.id = base.id;
  m.x = base.x;
  m.y = base.y;
  m.arcCenter = cfg.turretArcCenter * DEG * side;
  m.arcHalf = cfg.turretArc * DEG;
  m.fireRate = cfg.turretFireRate;
  m.bulletSpeed = cfg.turretBulletSpeed;
  m.bulletDamage = base.bulletDamage;
  m.bulletLife = cfg.turretBulletLife;
  m.range = cfg.turretRange;
  m.spread = cfg.turretSpread * DEG;
  m.burst.shots = cfg.turretBurstShots;
  m.burst.pause = cfg.turretBurstPause;
  return m;
}

/** The gunship's flight model: the player's, scaled by the gunship's speed and turn numbers. Fills `out`. */
export function gunshipFlight(out: FlightConfig, world: World): FlightConfig {
  scale.speedScale = world.tuning.gunship.speedScale;
  scale.turnRateScale = world.tuning.gunship.turnRateScale;
  return deriveFlight(out, world.tuning.flight, scale);
}

/** Adds one gunship at a position, flying along `heading`. Returns its index in `world.fighters`. */
export function spawnGunship(
  world: World,
  x: number,
  y: number,
  heading: number,
  retargetTimer = 0,
): number {
  const cfg = world.tuning.gunship;
  const flight = gunshipFlight({} as FlightConfig, world);
  const ship = createFighter(flight, x, y, heading, cfg.hull, cfg.radius, retargetTimer);
  ship.shipType = SHIP_GUNSHIP;
  ship.mounts = ENEMY_KINDS.gunship.mounts.map(createMountState);
  // The first burst follows the live tuned burst length, not the kind's static default.
  for (const m of ship.mounts) m.burstLeft = cfg.turretBurstShots;
  // Which way it circles the player (kept in `breakSide`, which a gunship does not otherwise use).
  ship.breakSide = world.rng.next() < 0.5 ? -1 : 1;
  const index = placeFighter(world.fighters, ship);
  world.events.emit({ type: 'EnemySpawned', kind: 'gunship', x, y });
  return index;
}

/** Steering angle for the standoff: `t` is -1 well inside the standoff band, 0 at the standoff distance, +1 well outside it. */
export function standoffHeading(bearing: number, side: -1 | 1, t: number): number {
  return bearing + side * BROADSIDE * (1 - clamp(t, -1, 1));
}

/** True when a player missile homes on this ship and is inside `range`: the gunship backs off. */
function missileThreat(world: World, id: number, x: number, y: number, range: number): boolean {
  const m = world.missiles;
  const d = m.data;
  for (let i = 0; i < m.count; i++) {
    if (d.targetId[i] !== id) continue;
    if ((d.x[i]! - x) ** 2 + (d.y[i]! - y) ** 2 <= range * range) return true;
  }
  return false;
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Where a turret at the muzzle would aim at `body`, relative to the heading, if the body is inside
 * the arc and range; otherwise NaN. Fills `lead` with the (partly) led aim point.
 */
function aimAt(f: Fighter, mount: WeaponMount, body: Body, cfg: GunshipConfig): number {
  const ship = f.ship;
  const c = Math.cos(ship.heading);
  const s = Math.sin(ship.heading);
  shooter.x = ship.x + c * mount.x - s * mount.y;
  shooter.y = ship.y + s * mount.x + c * mount.y;
  shooter.vx = ship.vx;
  shooter.vy = ship.vy;
  const dist = Math.hypot(body.x - shooter.x, body.y - shooter.y);
  if (dist > mount.range) return NaN;
  leadPoint(lead, shooter, body, mount.bulletSpeed, LEAD_TIME_MAX);
  lead.x = body.x + (lead.x - body.x) * cfg.turretLead;
  lead.y = body.y + (lead.y - body.y) * cfg.turretLead;
  const rel = wrapAngle(Math.atan2(lead.y - shooter.y, lead.x - shooter.x) - ship.heading);
  return inArc(rel, mount.arcCenter, mount.arcHalf) ? rel : NaN;
}

/**
 * The turret's target: the player when it is in arc and range, else the nearest living wingman
 * that is. Returns the aim relative to the heading, or NaN when nothing can be shot.
 */
function pickAim(world: World, f: Fighter, mount: WeaponMount, cfg: GunshipConfig): number {
  const atPlayer = aimAt(f, mount, world.ship, cfg);
  if (!Number.isNaN(atPlayer)) return atPlayer;
  let best = NaN;
  let bestSq = Infinity;
  for (const w of world.squadron.wingmen) {
    if (!w.alive) continue;
    const sq = (w.ship.x - f.x) ** 2 + (w.ship.y - f.y) ** 2;
    if (sq >= bestSq) continue;
    const rel = aimAt(f, mount, w.ship, cfg);
    if (Number.isNaN(rel)) continue;
    best = rel;
    bestSq = sq;
  }
  return best;
}

function fire(world: World, f: Fighter, mount: WeaponMount, aim: number): void {
  const shots = world.enemyShots;
  const k = shots.spawn();
  if (k < 0) return; // pool full: the shot is dropped
  const ship = f.ship;
  const c = Math.cos(ship.heading);
  const s = Math.sin(ship.heading);
  const angle = ship.heading + aim + world.rng.range(-mount.spread, mount.spread);
  shots.data.x[k] = ship.x + c * mount.x - s * mount.y;
  shots.data.y[k] = ship.y + s * mount.x + c * mount.y;
  shots.data.vx[k] = ship.vx + Math.cos(angle) * mount.bulletSpeed;
  shots.data.vy[k] = ship.vy + Math.sin(angle) * mount.bulletSpeed;
  shots.data.life[k] = mount.bulletLife;
  world.events.emit({
    type: 'EnemyShotFired',
    x: shots.data.x[k]!,
    y: shots.data.y[k]!,
    angle,
    from: 'gunship',
  });
}

/**
 * One gunship's decisions for this step: writes `f.actions` (hold a standoff distance from the
 * player while circling broadside so the turrets bear; back off from missiles homing on it) and
 * runs its turrets, each independent: swing to follow its target inside its arc, fire in bursts.
 */
export function thinkGunship(world: World, f: Fighter, index: number, dt: number): void {
  const cfg = world.tuning.gunship;
  const ship = f.ship;
  const a = f.actions;
  a.evade = false;
  f.targetIndex = -1;

  const player = world.ship;
  const dist = Math.hypot(player.x - ship.x, player.y - ship.y);
  let t = (dist - cfg.standoff) / cfg.standoffBand;
  if (
    missileThreat(world, FIGHTER_ID_BASE + index, f.x, f.y, world.tuning.fighter.missileDetectRange)
  )
    t = -1;
  const desired = standoffHeading(Math.atan2(player.y - ship.y, player.x - ship.x), f.breakSide, t);
  a.steerX = Math.cos(desired);
  a.steerY = Math.sin(desired);
  a.throttle = Math.abs(t) > THROTTLE_BAND ? 1 : 0;

  const baseMounts = ENEMY_KINDS.gunship.mounts;
  for (let i = 0; i < f.mounts.length; i++) {
    const state = f.mounts[i]!;
    const mount = tunedMount(baseMounts[i]!, cfg);
    const rel = pickAim(world, f, mount, cfg);
    const has = !Number.isNaN(rel);
    const want = has ? clampToArc(rel, mount.arcCenter, mount.arcHalf) : mount.arcCenter;
    state.aim = slewAngle(state.aim, want, cfg.turretTurnRate * DEG * dt);
    const onTarget = has && Math.abs(wrapAngle(rel - state.aim)) <= cfg.turretFireCone * DEG;
    if (stepBurst(state, mount.burst, mount.fireRate, dt, onTarget))
      fire(world, f, mount, state.aim);
  }
}

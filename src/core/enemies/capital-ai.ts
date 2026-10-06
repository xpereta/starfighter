import type { CapitalConfig } from '../../../data/tuning/capital';
import { chooseTarget, targetOf } from '../ai/fighters';
import { leadPoint, type Point } from '../ai/steering';
import { clamp, DEG, wrapAngle } from '../math';
import { stepSeconds } from '../world/clock';
import type { World } from '../world/world';
import {
  bridgeStanding,
  broadsideHeading,
  CAPITAL_PARTS,
  engineShare,
  killPart,
  partCenter,
  toWorld,
} from './capital';
import type { CapitalPartDef } from './capital-parts';
import type { CapitalState } from './state';

/**
 * The capital ship's behaviour (spec section 5): it drifts towards the player and turns to keep its
 * broadside on them; its engines carry both (all dead = a sitting hulk); its turrets fire from their
 * mounts inside their arcs in bursts with pauses, worse once the bridge is gone; when the core dies
 * the remaining parts blow up one after another and then the hull is destroyed.
 */

/** How quickly the velocity follows the wanted one while an engine works (1/s), and with none (the hulk stops fast). */
const VELOCITY_FOLLOW = 1.5;
const HULK_FOLLOW = 4;
/** Share of the chain time over which the parts blow up one by one; the rest is the hull breaking apart. */
const CHAIN_PARTS_SHARE = 0.8;
/** Turret pause jitter, as a share either way, so the bursts do not stay in step. */
const PAUSE_JITTER = 0.15;
/** Second slug of a heavy round trails the first by this distance (u). */
const SLUG_GAP = 7;
/** Order in which the death chain takes the parts. */
const CHAIN_ORDER: readonly CapitalPartDef['role'][] = ['turret', 'engine', 'armour', 'bridge'];

/**
 * Moves the ship one step towards the player: drift speed (cruise x engine share) until the standoff
 * distance, broadside turn (turn rate x engine share), kept inside the arena. Pure apart from `cap`.
 */
export function stepCapitalMotion(
  cap: CapitalState,
  cfg: Pick<CapitalConfig, 'cruiseSpeed' | 'turnRate' | 'standoff'>,
  share: number,
  targetX: number,
  targetY: number,
  arenaRadius: number,
  dt: number,
): void {
  const dx = targetX - cap.x;
  const dy = targetY - cap.y;
  const dist = Math.hypot(dx, dy);
  // Turn: broadside to the player, limited by the turn rate (engines drive the turning too).
  if (dist > 1e-6 && share > 0) {
    const want = broadsideHeading(cap.heading, Math.atan2(dy, dx));
    const limit = cfg.turnRate * DEG * share * dt;
    cap.heading = wrapAngle(cap.heading + clamp(wrapAngle(want - cap.heading), -limit, limit));
  }
  // Drift: towards the player until the standoff distance.
  const speed = dist > cfg.standoff && dist > 1e-6 ? cfg.cruiseSpeed * share : 0;
  const wantVx = dist > 1e-6 ? (dx / dist) * speed : 0;
  const wantVy = dist > 1e-6 ? (dy / dist) * speed : 0;
  const k = 1 - Math.exp(-(share > 0 ? VELOCITY_FOLLOW : HULK_FOLLOW) * dt);
  cap.vx += (wantVx - cap.vx) * k;
  cap.vy += (wantVy - cap.vy) * k;
  cap.x += cap.vx * dt;
  cap.y += cap.vy * dt;
  keepInside(cap, arenaRadius);
}

/** Pushes the ship back so its whole hull stays inside the arena, and takes the outward speed away. */
export function keepInside(cap: CapitalState, arenaRadius: number): void {
  const limit = Math.max(0, arenaRadius - cap.hullRadius);
  const d = Math.hypot(cap.x, cap.y);
  if (d <= limit || d < 1e-9) return;
  const nx = cap.x / d;
  const ny = cap.y / d;
  cap.x = nx * limit;
  cap.y = ny * limit;
  const outward = cap.vx * nx + cap.vy * ny;
  if (outward > 0) {
    cap.vx -= outward * nx;
    cap.vy -= outward * ny;
  }
}

/**
 * True when a mount whose arc is centred on `arcCenter` (half-width `arcHalf`), on a ship heading
 * `heading`, can point at the world angle `aim`.
 */
export function inArc(heading: number, arcCenter: number, arcHalf: number, aim: number): boolean {
  return Math.abs(wrapAngle(aim - heading - arcCenter)) <= arcHalf;
}

// Scratch objects, overwritten before each use, so stepping allocates nothing.
const muzzle = { x: 0, y: 0, vx: 0, vy: 0 };
const lead: Point = { x: 0, y: 0 };

function fireTurrets(world: World, cap: CapitalState, cfg: CapitalConfig, dt: number): void {
  const defs = CAPITAL_PARTS;
  const sighted = bridgeStanding(cap, defs);
  const rate = cfg.fireScale;
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]!;
    const part = cap.parts[i]!;
    const m = def.mount;
    if (!part.alive || !m) continue;
    part.cooldown -= dt;
    if (part.cooldown > 0 || rate <= 0) continue;
    toWorld(muzzle, cap, m.x, m.y);
    muzzle.vx = cap.vx;
    muzzle.vy = cap.vy;
    const targetIndex = chooseTarget(world, muzzle.x, muzzle.y);
    const target = targetOf(world, targetIndex);
    if (!target) continue;
    const dist = Math.hypot(target.x - muzzle.x, target.y - muzzle.y);
    if (dist > m.range) continue;
    // A blinded ship stops leading its shots.
    if (sighted) leadPoint(lead, muzzle, target, m.bulletSpeed, m.range / m.bulletSpeed);
    else {
      lead.x = target.x;
      lead.y = target.y;
    }
    const aim = Math.atan2(lead.y - muzzle.y, lead.x - muzzle.x);
    if (!inArc(cap.heading, m.arcCenter, m.arcHalf, aim)) continue;
    fire(world, cap, cfg, def, muzzle.x, muzzle.y, aim, sighted);
    const interval = 1 / (m.fireRate * rate);
    part.burstLeft = (part.burstLeft > 0 ? part.burstLeft : m.burst.shots) - 1;
    if (part.burstLeft <= 0) {
      part.burstLeft = 0;
      const jitter = 1 + world.rng.range(-PAUSE_JITTER, PAUSE_JITTER);
      part.cooldown = Math.max(
        interval,
        m.burst.pause * jitter + (sighted ? 0 : cfg.blindReaction),
      );
    } else part.cooldown = interval;
  }
}

function fire(
  world: World,
  cap: CapitalState,
  cfg: CapitalConfig,
  def: CapitalPartDef,
  x: number,
  y: number,
  aim: number,
  sighted: boolean,
): void {
  const m = def.mount!;
  // A blinded ship's guns are less accurate: extra aim error, less of it the higher the accuracy scale.
  const blind = sighted ? 0 : (1 - cfg.blindAccuracyScale) * cfg.blindSpread * DEG;
  const spread = m.spread + blind;
  const angle = aim + world.rng.range(-spread, spread);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  // A heavy round is a double slug: `bulletDamage` enemy bullets in a row (each takes 1 hull).
  const slugs = Math.max(1, Math.round(m.bulletDamage));
  const shots = world.enemyShots;
  for (let k = 0; k < slugs; k++) {
    const s = shots.spawn();
    if (s < 0) break; // pool full: the rest is dropped
    shots.data.x[s] = x - dx * SLUG_GAP * k;
    shots.data.y[s] = y - dy * SLUG_GAP * k;
    shots.data.vx[s] = cap.vx + dx * m.bulletSpeed;
    shots.data.vy[s] = cap.vy + dy * m.bulletSpeed;
    shots.data.life[s] = m.bulletLife;
  }
  world.events.emit({ type: 'EnemyShotFired', x, y, angle, from: 'turret' });
}

/** Number of parts that are not the core and still stand. */
function standing(cap: CapitalState, defs: readonly CapitalPartDef[]): number {
  let n = 0;
  for (let i = 0; i < defs.length; i++) if (defs[i]!.role !== 'core' && cap.parts[i]!.alive) n++;
  return n;
}

/** The death chain: parts blow up one by one over most of the chain time, then the hull is destroyed. */
function stepChain(world: World, cap: CapitalState, cfg: CapitalConfig, dt: number): void {
  const defs = CAPITAL_PARTS;
  cap.chainTime += dt;
  // Everything drifts to a stop; no more shooting (the turrets go with the chain).
  const k = 1 - Math.exp(-HULK_FOLLOW * dt);
  cap.vx -= cap.vx * k;
  cap.vy -= cap.vy * k;
  cap.x += cap.vx * dt;
  cap.y += cap.vy * dt;
  let nonCore = 0;
  for (const d of defs) if (d.role !== 'core') nonCore++;
  const progress = clamp(cap.chainTime / (cfg.deathChainTime * CHAIN_PARTS_SHARE), 0, 1);
  const wantGone = Math.ceil(progress * nonCore);
  while (nonCore - standing(cap, defs) < wantGone) {
    let next = -1;
    for (const role of CHAIN_ORDER) {
      next = defs.findIndex((d, i) => d.role === role && cap.parts[i]!.alive);
      if (next >= 0) break;
    }
    if (next < 0) break;
    killPart(world, next, defs);
  }
  if (cap.chainTime >= cfg.deathChainTime) {
    for (let i = 0; i < defs.length; i++) if (cap.parts[i]!.alive) killPart(world, i, defs);
    cap.phase = 2;
    world.events.emit({
      type: 'CapitalDestroyed',
      x: cap.x,
      y: cap.y,
      radius: cap.hullRadius,
    });
  }
}

/**
 * One step of the capital ship, if the world has one: motion and guns while it fights, the death
 * chain once the core is dead. Frozen with the other enemies by the debug freeze.
 */
export function stepCapital(world: World): void {
  const cap = world.enemies.capital;
  if (!cap || cap.phase === 2) return;
  if (world.tuning.arena.enemiesFrozen) return;
  const dt = stepSeconds(world);
  if (dt <= 0) return;
  const cfg = world.tuning.capital;
  cap.time += dt;
  if (cap.phase === 1) {
    stepChain(world, cap, cfg, dt);
    return;
  }
  const share = engineShare(cap, CAPITAL_PARTS);
  stepCapitalMotion(
    cap,
    cfg,
    share,
    world.ship.x,
    world.ship.y,
    world.tuning.flight.arenaRadius,
    dt,
  );
  fireTurrets(world, cap, cfg, dt);
}

/** World position of the muzzle of turret part `index` (u); for tests and overlays. */
export function muzzleOf(
  out: { x: number; y: number },
  cap: CapitalState,
  index: number,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): void {
  const def = defs[index]!;
  if (def.mount) toWorld(out, cap, def.mount.x, def.mount.y);
  else partCenter(out, cap, def);
}

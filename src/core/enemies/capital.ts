import { CAPITAL_DESIGN_RADIUS, CAPITAL_PARTS } from '../../../data/content/capital';
import type { CapitalConfig } from '../../../data/tuning/capital';
import { wrapAngle } from '../math';
import type { Rng } from '../rng/rng';
import type { Collider } from '../world/target';
import type { World } from '../world/world';
import type { CapitalPartDef } from './capital-parts';
import type { CapitalState, PartState } from './state';

/**
 * The capital ship's parts as bodies (spec section 5). Pure data and geometry here: building the
 * state, where a part is, what shields what, and damage routing (`damagePart`). Movement and guns
 * are in `capital-ai.ts`, hit tests in `capital-hits.ts`, the battle script in `capital-battle.ts`.
 */

/** Lockable ids from here up are parts of the capital ship (id - PART_ID_BASE = index in the part list). */
export const PART_ID_BASE = 2000;
export { CAPITAL_DESIGN_RADIUS, CAPITAL_PARTS };

/** How much the part data is scaled for this ship (its hull radius over the radius the data was designed for). */
export const scaleOf = (cap: Pick<CapitalState, 'hullRadius'>): number =>
  cap.hullRadius / CAPITAL_DESIGN_RADIUS;

/** A fresh ship at (x, y). Turret cooldowns are staggered with `rng` so the guns do not fire in step. */
export function createCapital(
  x: number,
  y: number,
  heading: number,
  startDistance: number,
  cfg: Pick<CapitalConfig, 'hullRadius' | 'partHpScale'>,
  rng: Rng,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): CapitalState {
  const parts: PartState[] = defs.map((d) => {
    const hp = d.hp * cfg.partHpScale;
    return {
      hp,
      maxHp: hp,
      alive: true,
      cooldown: d.role === 'turret' ? rng.range(0.5, 2.5) : 0,
      burstLeft: 0,
    };
  });
  return {
    x,
    y,
    heading,
    vx: 0,
    vy: 0,
    parts,
    coreExposed: false,
    hullRadius: cfg.hullRadius,
    phase: 0,
    time: 0,
    startDistance,
    chainTime: 0,
    wingsSent: 0,
    lancersSent: false,
    lastHitBy: 0,
  };
}

// Frame cache: cos and sin of the heading, recomputed only when the heading changes -----------

const frame = { heading: Number.NaN, cos: 1, sin: 0 };

function frameOf(cap: CapitalState): typeof frame {
  if (cap.heading !== frame.heading) {
    frame.heading = cap.heading;
    frame.cos = Math.cos(cap.heading);
    frame.sin = Math.sin(cap.heading);
  }
  return frame;
}

/** World position of a ship-space point (x forward, y left, u, before scaling). Writes `out`. */
export function toWorld(
  out: { x: number; y: number },
  cap: CapitalState,
  localX: number,
  localY: number,
): void {
  const f = frameOf(cap);
  const s = scaleOf(cap);
  const lx = localX * s;
  const ly = localY * s;
  out.x = cap.x + f.cos * lx - f.sin * ly;
  out.y = cap.y + f.sin * lx + f.cos * ly;
}

/** World position of a part's centre. Writes `out`. */
export function partCenter(
  out: { x: number; y: number },
  cap: CapitalState,
  def: CapitalPartDef,
): void {
  toWorld(out, cap, def.x, def.y);
}

/** Radius that encloses the whole part (a capsule counts its ends), in world units. */
export const boundRadius = (cap: CapitalState, def: CapitalPartDef): number =>
  (def.radius + (def.length ?? 0) / 2) * scaleOf(cap);

/**
 * Signed distance from a world point to the part's surface (negative inside). A part is a circle,
 * or a capsule lying along the ship's forward axis when it has a `length`.
 */
export function distanceToPart(
  cap: CapitalState,
  def: CapitalPartDef,
  px: number,
  py: number,
): number {
  const f = frameOf(cap);
  const s = scaleOf(cap);
  // Into the ship frame, relative to the part centre.
  const cx = cap.x + f.cos * def.x * s - f.sin * def.y * s;
  const cy = cap.y + f.sin * def.x * s + f.cos * def.y * s;
  const dx = px - cx;
  const dy = py - cy;
  const lx = f.cos * dx + f.sin * dy;
  const ly = -f.sin * dx + f.cos * dy;
  const half = ((def.length ?? 0) / 2) * s;
  const along = lx < -half ? lx + half : lx > half ? lx - half : 0;
  return Math.hypot(along, ly) - def.radius * s;
}

// Shielding -----------------------------------------------------------------------------

const coverCache = new WeakMap<readonly CapitalPartDef[], number[][]>();

/** For each part, the indices of the plates that cover it (cached per part list). */
export function coveredBy(defs: readonly CapitalPartDef[]): readonly (readonly number[])[] {
  let table = coverCache.get(defs);
  if (!table) {
    table = defs.map(() => []);
    defs.forEach((plate, j) => {
      for (const id of plate.covers) {
        const i = defs.findIndex((d) => d.id === id);
        if (i >= 0) table![i]!.push(j);
      }
    });
    coverCache.set(defs, table);
  }
  return table;
}

/** True while a living plate covers part `index`: it cannot be damaged or locked. */
export function isCovered(
  cap: CapitalState,
  index: number,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): boolean {
  for (const j of coveredBy(defs)[index]!) if (cap.parts[j]!.alive) return true;
  return false;
}

export const coreIndex = (defs: readonly CapitalPartDef[] = CAPITAL_PARTS): number =>
  defs.findIndex((d) => d.role === 'core');

/** How many parts of a role are standing, and how many the ship has. */
export function countRole(
  cap: CapitalState,
  role: CapitalPartDef['role'],
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): { alive: number; total: number } {
  let alive = 0;
  let total = 0;
  for (let i = 0; i < defs.length; i++) {
    if (defs[i]!.role !== role) continue;
    total++;
    if (cap.parts[i]!.alive) alive++;
  }
  return { alive, total };
}

/** Share of the engines still running, 0..1 (1 when the ship has none). */
export function engineShare(
  cap: CapitalState,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): number {
  const { alive, total } = countRole(cap, 'engine', defs);
  return total === 0 ? 1 : alive / total;
}

/** True while the bridge stands (a ship without one is never blinded). */
export function bridgeStanding(
  cap: CapitalState,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): boolean {
  const { alive, total } = countRole(cap, 'bridge', defs);
  return total === 0 || alive > 0;
}

// Damage -----------------------------------------------------------------------------------

const where = { x: 0, y: 0 };

function destroyPart(
  world: World,
  cap: CapitalState,
  index: number,
  defs: readonly CapitalPartDef[],
): void {
  const def = defs[index]!;
  const part = cap.parts[index]!;
  part.hp = 0;
  part.alive = false;
  part.burstLeft = 0;
  partCenter(where, cap, def);
  world.events.emit({
    type: 'PartDestroyed',
    part: def.id,
    x: where.x,
    y: where.y,
    role: def.role,
    radius: def.radius * scaleOf(cap),
  });
  const core = coreIndex(defs);
  if (!cap.coreExposed && cap.parts[core]!.alive && !isCovered(cap, core, defs)) {
    cap.coreExposed = true;
    partCenter(where, cap, defs[core]!);
    world.events.emit({ type: 'CoreExposed', x: where.x, y: where.y });
  }
  if (def.role === 'core') {
    cap.phase = 1; // the death chain takes over (capital-ai.ts)
    cap.chainTime = 0;
  }
}

/**
 * Applies `amount` damage to a part of the world's capital ship: the one place damage is routed.
 * No damage (returns false) when there is no ship, it is already dying, the part is dead, or a plate
 * still covers it (the core cannot be hurt while a plate stands). `owner` is who fired (0 = the
 * player, else a pilot id) for kill credit on the core.
 */
export function damagePart(
  world: World,
  index: number,
  amount: number,
  owner: number,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): boolean {
  const cap = world.enemies.capital;
  if (!cap || cap.phase !== 0) return false;
  const part = cap.parts[index];
  if (!part || !part.alive || isCovered(cap, index, defs)) return false;
  part.hp -= amount;
  if (defs[index]!.role === 'core') cap.lastHitBy = owner;
  if (part.hp <= 0) destroyPart(world, cap, index, defs);
  return true;
}

/** Destroys a part at once (the death chain, dev tools): emits `PartDestroyed` (and `CoreExposed` / the chain start where due). */
export function killPart(
  world: World,
  index: number,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): void {
  const cap = world.enemies.capital;
  const part = cap?.parts[index];
  if (!cap || !part || !part.alive) return;
  destroyPart(world, cap, index, defs);
}

// Bodies for lock-on, missiles and the squadron ----------------------------------------------

/** A part as a lockable body (see `core/world/lockable.ts`); also carries a velocity for the wingmen. */
export interface PartBody extends Collider {
  vx: number;
  vy: number;
}

const bodies: PartBody[] = [];

/**
 * The body behind lockable id `PART_ID_BASE + index`: a stable object per part (refreshed on every
 * call, so read it straight away). Dead or hidden (covered) parts come back `alive: false`.
 */
export function partBody(
  world: World,
  index: number,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): PartBody | undefined {
  const cap = world.enemies.capital;
  const def = defs[index];
  const part = cap?.parts[index];
  if (!cap || !def || !part) return undefined;
  let body = bodies[index];
  if (!body) {
    body = { x: 0, y: 0, vx: 0, vy: 0, radius: 0, hp: 0, alive: false, lastHitBy: 0 };
    bodies[index] = body;
  }
  partCenter(body, cap, def);
  body.vx = cap.vx;
  body.vy = cap.vy;
  body.radius = boundRadius(cap, def);
  body.hp = part.hp;
  body.alive = part.alive && cap.phase === 0 && !isCovered(cap, index, defs);
  body.lastHitBy = cap.lastHitBy;
  return body;
}

/** True when a circle of radius `reach` at (x, y) touches part `index` exactly (a capsule is not its bounding circle). */
export function partTouches(
  world: World,
  index: number,
  x: number,
  y: number,
  reach: number,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): boolean {
  const cap = world.enemies.capital;
  const def = defs[index];
  if (!cap || !def) return false;
  return distanceToPart(cap, def, x, y) <= reach;
}

export interface PartVisit {
  (id: number, x: number, y: number, vx: number, vy: number, radius: number): void;
}

/** Visits every part that can be hit and locked right now (alive, not covered, ship not dying). Allocation-free. */
export function forEachPart(
  world: World,
  visit: PartVisit,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): void {
  const cap = world.enemies.capital;
  if (!cap || cap.phase !== 0) return;
  for (let i = 0; i < defs.length; i++) {
    if (!cap.parts[i]!.alive || isCovered(cap, i, defs)) continue;
    partCenter(where, cap, defs[i]!);
    visit(PART_ID_BASE + i, where.x, where.y, cap.vx, cap.vy, boundRadius(cap, defs[i]!));
  }
}

/**
 * What an attack order moves on to when its part dies: the nearest living turret to (x, y), else the
 * nearest part that can be hit; -1 when nothing is left to aim at.
 */
export function nextPartTarget(
  world: World,
  x: number,
  y: number,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): number {
  const cap = world.enemies.capital;
  if (!cap || cap.phase !== 0) return -1;
  let bestTurret = -1;
  let bestTurretSq = Infinity;
  let best = -1;
  let bestSq = Infinity;
  for (let i = 0; i < defs.length; i++) {
    if (!cap.parts[i]!.alive || isCovered(cap, i, defs)) continue;
    partCenter(where, cap, defs[i]!);
    const sq = (where.x - x) ** 2 + (where.y - y) ** 2;
    if (sq < bestSq) {
      bestSq = sq;
      best = i;
    }
    if (defs[i]!.role === 'turret' && sq < bestTurretSq) {
      bestTurretSq = sq;
      bestTurret = i;
    }
  }
  const pick = bestTurret >= 0 ? bestTurret : best;
  return pick >= 0 ? PART_ID_BASE + pick : -1;
}

/** The broadside heading closest to `current`, with the player on the ship's side: bearing +- 90 degrees. */
export function broadsideHeading(current: number, bearing: number): number {
  const a = bearing + Math.PI / 2;
  const b = bearing - Math.PI / 2;
  return Math.abs(wrapAngle(a - current)) <= Math.abs(wrapAngle(b - current)) ? a : b;
}

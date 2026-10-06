import type { FlightConfig } from '../../../data/tuning/flight';
import { WING_CUE } from '../../../data/content/cues';
import { WING_SHAPES, type WingShape, type WingState } from '../enemies/state';
import { TAU } from '../math';
import type { World } from '../world/world';
import { createFighter, placeFighter, type Fighter } from './fighter';
import { deriveFlight } from './steering';

/**
 * Formation wings (spec section 2): a leader and 2 to 4 followers that hold slots relative to the
 * leader, attack together, and break formation when the leader dies, when any of them takes fire,
 * or when the player gets close. Pure slot geometry and the break rules live here; a follower's
 * flying (slot hold, shooting) is in `fighters.ts` next to the other fighter AI.
 */

/** V: each rank this far back and out, in slot radii. */
const V_BACK = 0.8;
const V_SIDE = 0.9;
/** Box: followers on the corners of a square of this half-size around the leader (slot radii). */
const BOX_HALF = 0.8;

export interface SlotOffset {
  /** Along the leader's heading, u (negative = behind). */
  x: number;
  /** To the leader's left, u. */
  y: number;
}

/**
 * Where follower `index` (0-based) sits relative to the leader, in the leader's frame (x forward, y
 * left), for a formation `shape` and `radius` (the slot spacing, u). Fills `out`.
 * - v: pairs behind the leader, left then right, each rank further back and out;
 * - line: abreast of the leader, alternating left and right, each further out;
 * - box: the four corners of a square around the leader, then extras on the flanks.
 */
export function slotOffset(
  out: SlotOffset,
  shape: WingShape,
  index: number,
  radius: number,
): SlotOffset {
  const rank = Math.floor(index / 2) + 1;
  const side = index % 2 === 0 ? 1 : -1;
  if (shape === 'v') {
    out.x = -radius * V_BACK * rank;
    out.y = radius * V_SIDE * rank * side;
  } else if (shape === 'line') {
    out.x = 0;
    out.y = radius * rank * side;
  } else if (index < 4) {
    out.x = radius * BOX_HALF * (index < 2 ? 1 : -1);
    out.y = radius * BOX_HALF * side;
  } else {
    out.x = 0;
    out.y = radius * (index - 2) * side;
  }
  return out;
}

/** The world position of a slot: `offset` rotated by the leader's heading and moved to the leader. */
export function slotWorld(
  out: { x: number; y: number },
  leader: { x: number; y: number; heading: number },
  offset: SlotOffset,
): { x: number; y: number } {
  const c = Math.cos(leader.heading);
  const s = Math.sin(leader.heading);
  out.x = leader.x + c * offset.x - s * offset.y;
  out.y = leader.y + s * offset.x + c * offset.y;
  return out;
}

export type BreakReason = 'leader' | 'fire' | 'proximity';

/** Everything the break rules look at, so they can be tested without a world. */
export interface WingView {
  leaderAlive: boolean;
  /** A member (leader or follower) has lost hull points. */
  anyHit: boolean;
  /** Distance from the player to the nearest living member (u). */
  playerDistance: number;
  /** `wings.breakProximity` (u). */
  breakProximity: number;
}

/** Why a formation breaks now, or null to hold. The leader's death comes first, then fire, then the player's closeness. */
export function breakReason(view: WingView): BreakReason | null {
  if (!view.leaderAlive) return 'leader';
  if (view.anyHit) return 'fire';
  if (view.playerDistance <= view.breakProximity) return 'proximity';
  return null;
}

/** True when `f` flies in a wing that still holds formation. */
export function inFormation(world: World, f: Fighter): boolean {
  return f.wingId >= 0 && !world.enemies.wings[f.wingId]!.broken;
}

/** True when `index` is the leader of an intact wing (the leader keeps its course while its followers hold the slots). */
export function isLeader(world: World, f: Fighter, index: number): boolean {
  return inFormation(world, f) && world.enemies.wings[f.wingId]!.leader === index;
}

/** A member of the wing is still the member (its slot in `world.fighters` was not reused by a later spawn). */
function memberOf(world: World, wingId: number, index: number): Fighter | null {
  const f = world.fighters[index];
  return f && f.alive && f.wingId === wingId ? f : null;
}

/**
 * Checks the break rules of every intact wing and breaks the ones that fire: marks the wing
 * broken (its fighters then fly as ordinary fighters, retargeting at once) and emits `WingBroken`.
 * Runs at the start of `stepFighters`.
 */
export function stepWings(world: World): void {
  const wings = world.enemies.wings;
  const cfg = world.tuning.wings;
  const player = world.ship;
  for (let w = 0; w < wings.length; w++) {
    const wing = wings[w]!;
    if (wing.broken) continue;
    const leader = memberOf(world, w, wing.leader);
    let anyHit = leader !== null && leader.hp < leader.maxHp;
    let nearSq = leader ? (leader.x - player.x) ** 2 + (leader.y - player.y) ** 2 : Infinity;
    for (const i of wing.members) {
      const f = memberOf(world, w, i);
      if (!f) continue;
      if (f.hp < f.maxHp) anyHit = true;
      nearSq = Math.min(nearSq, (f.x - player.x) ** 2 + (f.y - player.y) ** 2);
    }
    const reason = breakReason({
      leaderAlive: leader !== null,
      anyHit,
      playerDistance: Math.sqrt(nearSq),
      breakProximity: cfg.breakProximity,
    });
    if (reason === null) continue;
    wing.broken = true;
    for (const i of [wing.leader, ...wing.members]) {
      const f = memberOf(world, w, i);
      if (f) f.retargetTimer = 0; // pick a fresh target at once
    }
    world.events.emit({ type: 'WingBroken', reason });
  }
}

/**
 * The cue to show the player: the wing cue text while a wing that holds formation arrived less
 * than `wings.cueTime` ago, else null (pure read of the state, no event needed).
 */
export function wingCue(world: World): string | null {
  const { cueTime } = world.tuning.wings;
  if (cueTime <= 0) return null;
  for (const wing of world.enemies.wings) {
    if (!wing.broken && world.time - wing.born <= cueTime) return WING_CUE;
  }
  return null;
}

/** The formation for a new wing: the forced one, or a seeded pick. */
function pickShape(world: World): WingShape {
  const setting = world.tuning.wings.shape;
  return setting === 'mixed' ? WING_SHAPES[world.rng.int(WING_SHAPES.length)]! : setting;
}

const offsetScratch: SlotOffset = { x: 0, y: 0 };
const slotScratch = { x: 0, y: 0 };

/**
 * Adds a wing with its leader at (x, y) flying along `heading`: the leader has the extra hull,
 * the followers start on their slots at the leader's heading and speed. Returns the wing's index
 * in `world.enemies.wings`. `fighters` overrides `wings.size` (the capital's escorts). Uses the fighter tuning for hull, radius and flight.
 */
export function spawnWing(
  world: World,
  x: number,
  y: number,
  heading: number,
  fighters?: number,
): number {
  const cfg = world.tuning.wings;
  const fcfg = world.tuning.fighter;
  const flight = deriveFlight({} as FlightConfig, world.tuning.flight, fcfg);
  const wingId = world.enemies.wings.length;
  const shape = pickShape(world);
  const size = Math.max(2, Math.round(fighters ?? cfg.size));

  const make = (px: number, py: number, hp: number): Fighter => {
    const f = createFighter(
      flight,
      px,
      py,
      heading,
      hp,
      fcfg.radius,
      world.rng.range(0, fcfg.retargetInterval),
    );
    f.wingId = wingId;
    return f;
  };
  const leaderIndex = placeFighter(world.fighters, make(x, y, fcfg.health + cfg.leaderExtraHp));
  world.events.emit({ type: 'EnemySpawned', kind: 'fighter', x, y });
  const members: number[] = [];
  const leaderPose = { x, y, heading };
  for (let k = 0; k < size - 1; k++) {
    slotWorld(slotScratch, leaderPose, slotOffset(offsetScratch, shape, k, cfg.slotRadius));
    const f = make(slotScratch.x, slotScratch.y, fcfg.health);
    f.wingSlot = k;
    members.push(placeFighter(world.fighters, f));
    world.events.emit({
      type: 'EnemySpawned',
      kind: 'fighter',
      x: slotScratch.x,
      y: slotScratch.y,
    });
  }
  const wing: WingState = {
    shape,
    leader: leaderIndex,
    members,
    broken: false,
    born: world.time,
  };
  world.enemies.wings.push(wing);
  return wingId;
}

/** `count` wings spread around the arena edge, each heading inward (like a fighter wave). */
export function spawnWings(world: World, count: number, size?: number): void {
  const radius = world.tuning.flight.arenaRadius * world.tuning.fighter.spawnFraction;
  const base = world.rng.range(0, TAU);
  for (let k = 0; k < count; k++) {
    const angle = base + (k * TAU) / count + world.rng.range(-0.2, 0.2);
    const heading = angle + Math.PI + world.rng.range(-0.3, 0.3);
    spawnWing(world, Math.cos(angle) * radius, Math.sin(angle) * radius, heading, size);
  }
}

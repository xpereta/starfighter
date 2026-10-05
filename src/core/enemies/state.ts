import { createPool, type Pool } from '../world/pool';

/**
 * Prototype 5 world state, stubs for the three tracks (see docs/p5-tracks.md). Everything here is
 * empty and inert until a track fills it; `mixEnemies` feeds it to the replay hash and writes
 * NOTHING while it is empty, so an empty state leaves every existing hash unchanged.
 */

// Enemy missiles (track B) ---------------------------------------------------------------

/** Same shape as the player's missile pool, minus the lock: enemy missiles only ever chase the player. */
export type EnemyMissileFields =
  'uid' | 'x' | 'y' | 'vx' | 'vy' | 'heading' | 'speed' | 'phase' | 'life' | 'damage' | 'owner';
export type EnemyMissilePool = Pool<EnemyMissileFields>;

export const ENEMY_MISSILE_FIELDS: readonly EnemyMissileFields[] = [
  'uid',
  'x',
  'y',
  'vx',
  'vy',
  'heading',
  'speed',
  'phase',
  'life',
  'damage',
  'owner',
];

export function createEnemyMissilePool(capacity: number): EnemyMissilePool {
  return createPool(capacity, ENEMY_MISSILE_FIELDS);
}

// Formation wings (track A) --------------------------------------------------------------

export const WING_SHAPES = ['v', 'line', 'box'] as const;
export type WingShape = (typeof WING_SHAPES)[number];

/** A wing in flight: indices into `world.fighters`, the leader first in spirit (`leader` is its index). */
export interface WingState {
  shape: WingShape;
  /** Index into `world.fighters` of the leader. */
  leader: number;
  /** Indices into `world.fighters` of the followers, in slot order. */
  members: number[];
  /** True once the wing has broken formation (its fighters then act as ordinary fighters). */
  broken: boolean;
}

// Capital ship (track C) -----------------------------------------------------------------

/** The live state of one part; its fixed data (position, radius, role) is in `CapitalPartDef`, same order. */
export interface PartState {
  hp: number;
  alive: boolean;
}

export interface CapitalState {
  x: number;
  y: number;
  heading: number;
  vx: number;
  vy: number;
  parts: PartState[];
  /** True once no plate covers the core any more (emits `CoreExposed` once). */
  coreExposed: boolean;
}

// The container on the world -------------------------------------------------------------

export interface EnemyState {
  readonly missiles: EnemyMissilePool;
  readonly wings: WingState[];
  /** null = no capital ship on the field. */
  capital: CapitalState | null;
}

export function createEnemyState(missileCap: number): EnemyState {
  return { missiles: createEnemyMissilePool(missileCap), wings: [], capital: null };
}

/** Empties everything (a respawn or a new battle). */
export function clearEnemyState(state: EnemyState): void {
  state.missiles.clear();
  state.wings.length = 0;
  state.capital = null;
}

/** Feeds the enemy state into the replay hash. Add every field you add to the types above. Writes nothing when empty. */
export function mixEnemies(mix: (n: number) => void, state: EnemyState): void {
  const m = state.missiles;
  if (m.count > 0) {
    mix(-1); // section tags keep a missile list and a wing list from looking alike
    mix(m.count);
    for (const field of ENEMY_MISSILE_FIELDS) {
      const arr = m.data[field];
      for (let i = 0; i < m.count; i++) mix(arr[i]!);
    }
  }
  if (state.wings.length > 0) {
    mix(-2);
    mix(state.wings.length);
    for (const w of state.wings) {
      mix(WING_SHAPES.indexOf(w.shape));
      mix(w.leader);
      mix(w.broken ? 1 : 0);
      mix(w.members.length);
      for (const i of w.members) mix(i);
    }
  }
  const c = state.capital;
  if (c) {
    mix(-3);
    for (const v of [c.x, c.y, c.heading, c.vx, c.vy]) mix(v);
    mix(c.coreExposed ? 1 : 0);
    mix(c.parts.length);
    for (const p of c.parts) {
      mix(p.hp);
      mix(p.alive ? 1 : 0);
    }
  }
}

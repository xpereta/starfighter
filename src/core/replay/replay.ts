import { createTuning, tuningParams, tuningToggles, type Tuning } from '../../../data/tuning';
import { validateParam, type ParamDef } from '../params/params';
import { createActions, type Actions } from '../world/actions';
import { createWorld, stepWorld, type World } from '../world/world';
import { hashWorld } from './hash';

const FORMAT = 'starfighter-replay';
export const REPLAY_VERSION = 4; // v2: the prototype 2 actions (launch, orders); v3: arena.enemiesFrozen; v4: the hash covers more state (rng, prev, targets)

/** The inputs in effect from `tick` on (applied before stepping that tick). Only changes are stored. */
export interface InputChange {
  tick: number;
  actions: Actions;
}

/** Everything needed to reproduce a run exactly: seed + tuning + inputs. */
export interface Replay {
  format: typeof FORMAT;
  version: number;
  seed: number;
  /** Personal best at the start, which shows in the world state (not gameplay). */
  bestTrialTime: number | null;
  tuning: Tuning;
  /** Number of fixed steps recorded. */
  ticks: number;
  inputs: InputChange[];
  /** Gameplay-state hash after the last step, to check that playback reproduces the run. */
  finalHash: string;
}

const ACTION_KEYS = Object.keys(createActions()) as (keyof Actions)[];

function sameActions(a: Actions, b: Actions): boolean {
  return ACTION_KEYS.every((k) => a[k] === b[k]);
}

/** Deep copy so later edits to the live tuning never change a recording. */
export function cloneTuning(tuning: Tuning): Tuning {
  return JSON.parse(JSON.stringify(tuning)) as Tuning;
}

/** Writes tuning values into the live tuning object, in place. */
export function applyTuning(target: Tuning, source: Tuning): void {
  for (const group of Object.keys(source) as (keyof Tuning)[])
    Object.assign(target[group], source[group]);
}

export interface Recorder {
  /** Call before each `stepWorld`, with the actions about to be used. */
  record(tick: number, actions: Actions): void;
  /** Call after the last step. */
  finish(world: World): Replay;
}

export function startRecording(world: World): Recorder {
  const replay: Replay = {
    format: FORMAT,
    version: REPLAY_VERSION,
    seed: world.seed,
    bestTrialTime: world.trial.best,
    tuning: cloneTuning(world.tuning),
    ticks: 0,
    inputs: [],
    finalHash: '',
  };
  const startTick = world.tick;
  let last: Actions | null = null;
  return {
    record(tick, actions) {
      if (last && sameActions(last, actions)) return;
      last = { ...actions };
      replay.inputs.push({ tick: tick - startTick, actions: { ...actions } });
    },
    finish(w) {
      replay.ticks = w.tick - startTick;
      replay.finalHash = hashWorld(w);
      return replay;
    },
  };
}

export interface Player {
  /** Writes the actions for `tick` into `out`. Ticks must be requested in order. */
  apply(out: Actions, tick: number): void;
  readonly ticks: number;
}

export function createPlayer(replay: Replay): Player {
  let index = -1;
  return {
    ticks: replay.ticks,
    apply(out, tick) {
      while (index + 1 < replay.inputs.length && replay.inputs[index + 1]!.tick <= tick) index++;
      Object.assign(out, index >= 0 ? replay.inputs[index]!.actions : createActions());
    },
  };
}

/** Rebuilds `world` in place from a seed (fields are replaced; tuning and aspect are kept). */
export function restartWorld(world: World, seed: number): void {
  const fresh = createWorld(seed, world.tuning, world.trial.best);
  fresh.camera.aspect = world.camera.aspect;
  Object.assign(world as object, fresh);
}

/** Runs a replay headless on a fresh world and returns it. The reference for determinism checks. */
export function runReplay(replay: Replay): World {
  const world = createWorld(replay.seed, cloneTuning(replay.tuning), replay.bestTrialTime);
  const player = createPlayer(replay);
  const dt = 1 / 60;
  for (let i = 0; i < replay.ticks; i++) {
    player.apply(world.actions, world.tick);
    stepWorld(world, dt);
  }
  return world;
}

export function serializeReplay(replay: Replay): string {
  return JSON.stringify(replay);
}

/** Parses and validates a replay file; throws a readable error on anything wrong. */
export function parseReplay(text: string): Replay {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Replay is not valid JSON');
  }
  const r = raw as Partial<Replay> | null;
  if (typeof r !== 'object' || r === null || r.format !== FORMAT)
    throw new Error('Not a Starfighter replay');
  if (r.version !== REPLAY_VERSION)
    throw new Error(`Unsupported replay version ${String(r.version)}`);
  if (!Number.isInteger(r.seed)) throw new Error('Replay seed must be an integer');
  if (!Number.isInteger(r.ticks) || (r.ticks as number) < 0)
    throw new Error('Replay ticks must be a non-negative integer');
  if (typeof r.finalHash !== 'string') throw new Error('Replay has no final hash');
  const best = r.bestTrialTime;
  if (best !== null && (typeof best !== 'number' || !Number.isFinite(best)))
    throw new Error('Bad bestTrialTime');

  // Tuning: every group present, every value in range, toggles from their option lists.
  const tuning = r.tuning as unknown as Record<string, Record<string, unknown>> | undefined;
  if (typeof tuning !== 'object' || tuning === null) throw new Error('Replay has no tuning');
  const defaults = createTuning() as unknown as Record<string, Record<string, unknown>>;
  for (const group of Object.keys(defaults)) {
    const values = tuning[group];
    if (typeof values !== 'object' || values === null)
      throw new Error(`Replay tuning is missing "${group}"`);
    const defs: Record<string, ParamDef> = tuningParams[group as keyof Tuning];
    const toggles = tuningToggles[group as keyof Tuning];
    for (const key of [...Object.keys(defs), ...Object.keys(toggles)]) {
      const value = values[key];
      if (defs[key]) {
        if (typeof value !== 'number') throw new Error(`${group}.${key} must be a number`);
        validateParam(`${group}.${key}`, defs[key]!, value);
      } else if (!toggles[key]!.includes(value as string | boolean)) {
        throw new Error(`${group}.${key} must be one of ${toggles[key]!.join(', ')}`);
      }
    }
  }

  if (!Array.isArray(r.inputs)) throw new Error('Replay inputs must be a list');
  let lastTick = -1;
  for (const change of r.inputs as InputChange[]) {
    if (
      !Number.isInteger(change.tick) ||
      change.tick <= lastTick ||
      change.tick >= (r.ticks as number)
    ) {
      throw new Error('Replay inputs must be in strictly increasing tick order inside the run');
    }
    lastTick = change.tick;
    for (const key of ACTION_KEYS) {
      const v = change.actions?.[key];
      const expected = typeof createActions()[key];
      if (typeof v !== expected || (typeof v === 'number' && !Number.isFinite(v))) {
        throw new Error(`Replay input "${key}" has a bad value`);
      }
    }
  }
  return r as Replay;
}

import type { Tuning } from '../../../data/tuning';
import { createCamera, stepCamera, type Camera } from '../camera/camera';
import { createEventQueue, type EventQueue } from '../events/events';
import { createShip, stepFlight, type Ship } from '../flight/flight';
import { createRng, type Rng } from '../rng/rng';
import {
  createBulletPool,
  createGunState,
  stepBullets,
  stepGuns,
  type BulletPool,
  type GunState,
} from '../weapons/guns';
import { createActions, type Actions } from './actions';
import {
  createEnemyShotPool,
  createTargets,
  resolveKills,
  stepEnemyShots,
  stepTargets,
  type EnemyShotPool,
} from './arena';
import type { Target } from './target';
import { createTrial, startTrial, stepTrial, type Trial } from './trial';

/** Shared world state. Gameplay modules read and write this plain data; no hidden state elsewhere. */
export interface World {
  readonly seed: number;
  readonly rng: Rng;
  readonly events: EventQueue;
  /** Latest player intent; written by the input layer before each step. */
  readonly actions: Actions;
  /** Live tuning values (the dev panel edits these in place). */
  readonly tuning: Tuning;
  readonly ship: Ship;
  readonly camera: Camera;
  readonly guns: GunState;
  readonly bullets: BulletPool;
  readonly enemyShots: EnemyShotPool;
  /** Arena targets: static drones, moving drones, turrets. */
  readonly targets: Target[];
  readonly trial: Trial;
  readonly stats: { kills: number; hitsTaken: number };
  /** Previous-step button states, for edge-triggered actions. */
  readonly prev: { respawn: boolean; startTrial: boolean };
  /** Fixed steps simulated so far. */
  tick: number;
  /** Simulated seconds (tick * dt). */
  time: number;
}

/** `bestTrialTime` comes from the save data (null on a fresh profile). */
export function createWorld(
  seed: number,
  tuning: Tuning,
  bestTrialTime: number | null = null,
): World {
  const ship = createShip(tuning.flight);
  const rng = createRng(seed);
  return {
    seed,
    rng,
    events: createEventQueue(),
    actions: createActions(),
    tuning,
    ship,
    camera: createCamera(ship, tuning.flight, tuning.camera),
    guns: createGunState(),
    bullets: createBulletPool(tuning.weapons),
    enemyShots: createEnemyShotPool(tuning.arena),
    targets: createTargets(tuning.arena, rng),
    trial: createTrial(bestTrialTime),
    stats: { kills: 0, hitsTaken: 0 },
    prev: { respawn: false, startTrial: false },
    tick: 0,
    time: 0,
  };
}

/** Respawn: ship back to the center, shots cleared, a fresh arena layout, trial stopped (best time is kept). */
export function resetWorld(world: World): void {
  const { tuning } = world;
  Object.assign(world.ship, createShip(tuning.flight));
  Object.assign(world.guns, createGunState());
  world.bullets.clear();
  world.enemyShots.clear();
  world.targets.splice(0, world.targets.length, ...createTargets(tuning.arena, world.rng));
  world.trial.active = false;
  world.trial.time = 0;
  const aspect = world.camera.aspect;
  Object.assign(world.camera, createCamera(world.ship, tuning.flight, tuning.camera));
  world.camera.aspect = aspect;
}

/** Advances the world by one fixed step. Gameplay systems are called from here, in a fixed order. */
export function stepWorld(world: World, dt: number): void {
  const { actions, tuning, prev } = world;
  world.events.clear();
  world.tick += 1;
  world.time += dt;

  if (actions.respawn && !prev.respawn) resetWorld(world);
  if (actions.startTrial && !prev.startTrial) startTrial(world.trial, world.targets);
  prev.respawn = actions.respawn;
  prev.startTrial = actions.startTrial;

  stepFlight(world.ship, actions, tuning.flight, dt);
  stepGuns(
    world.guns,
    world.bullets,
    world.ship,
    actions,
    tuning.weapons,
    world.rng,
    world.events,
    dt,
  );
  stepBullets(world.bullets, world.targets, tuning.weapons, world.events, dt);
  world.stats.kills += resolveKills(world.targets, tuning.arena, world.events);
  stepTargets(
    world.targets,
    world.ship,
    tuning.arena,
    tuning.flight.arenaRadius,
    world.enemyShots,
    world.rng,
    world.trial.active,
    dt,
  );
  world.stats.hitsTaken += stepEnemyShots(
    world.enemyShots,
    world.ship,
    tuning.arena,
    world.events,
    dt,
  );
  stepTrial(world.trial, world.targets, dt);
  // Camera runs last so it sees this step's events (shake) and final ship state.
  stepCamera(
    world.camera,
    world.ship,
    tuning.flight,
    tuning.camera,
    world.events.events,
    world.time,
    dt,
  );
}

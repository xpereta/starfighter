import type { Tuning } from '../../../data/tuning';
import { stepFighters, stepWaves, type Fighter } from '../ai/fighters';
import { createCamera, stepCamera, type Camera } from '../camera/camera';
import { createEventQueue, type EventQueue } from '../events/events';
import { createShip, stepFlight, type Ship } from '../flight/flight';
import { createLockOn, stepLockOn, type LockOn } from '../lockon/lockon';
import { createPilots, stepPilots, type Pilots } from '../pilots/pilots';
import { createRng, type Rng } from '../rng/rng';
import { createRun, stepRun, stepRunBattle, type Run } from '../run/run';
import { createSquadron, stepSquadron, type Squadron } from '../squadron/squadron';
import {
  createBulletPool,
  createGunState,
  stepBullets,
  stepGuns,
  type BulletPool,
  type GunState,
} from '../weapons/guns';
import { createMissilePool, stepMissiles, type MissilePool } from '../weapons/missiles';
import { createActions, type Actions } from './actions';
import {
  createEnemyShotPool,
  createTargets,
  resolveKills,
  stepEnemyShots,
  stepTargets,
  type EnemyShotPool,
} from './arena';
import { stepPods, type Pod } from './pods';
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
  /** Prototype 2: lock set, missiles, enemy fighters and the squadron (see docs/specs/prototype-2-squadron.md). */
  readonly lockon: LockOn;
  readonly missiles: MissilePool;
  readonly fighters: Fighter[];
  readonly squadron: Squadron;
  /** Prototype 3: the run flow, the run's pilots and rescue pods (see docs/specs/prototype-3-pilots.md). */
  readonly run: Run;
  readonly pilots: Pilots;
  readonly pods: Pod[];
  readonly trial: Trial;
  readonly stats: { kills: number; hitsTaken: number };
  /** Previous-step button states, for edge-triggered actions. */
  readonly prev: {
    respawn: boolean;
    startTrial: boolean;
    /** The prototype 2 buttons: modules read `actions.x && !prev.x`; `prev` is updated at the END of the step. */
    launch: boolean;
    attackOrder: boolean;
    cycleFormation: boolean;
    /** Menu buttons: read by the run, edge-triggered against last step. */
    menuUp: boolean;
    menuDown: boolean;
    menuSelect: boolean;
    menuBack: boolean;
  };
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
    lockon: createLockOn(),
    missiles: createMissilePool(tuning.missiles),
    fighters: [],
    squadron: createSquadron(),
    run: createRun(),
    pilots: createPilots(),
    pods: [],
    trial: createTrial(bestTrialTime),
    stats: { kills: 0, hitsTaken: 0 },
    prev: {
      respawn: false,
      startTrial: false,
      launch: false,
      attackOrder: false,
      cycleFormation: false,
      menuUp: false,
      menuDown: false,
      menuSelect: false,
      menuBack: false,
    },
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
  world.missiles.clear();
  Object.assign(world.lockon, createLockOn());
  Object.assign(world.squadron, createSquadron());
  world.fighters.length = 0;
  world.pods.length = 0;
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

  // Respawn is a practice-mode key: in a run it would wipe the squadron and the battle's waves.
  if (actions.respawn && !prev.respawn && world.run.mode !== 'run') {
    resetWorld(world);
    world.events.emit({ type: 'PlayerRespawned' });
  }
  if (actions.startTrial && !prev.startTrial) startTrial(world.trial, world.targets);
  prev.respawn = actions.respawn;
  prev.startTrial = actions.startTrial;

  stepRun(world); // prototype 3 (A2): run phases, battles and menus
  if (world.run.phase !== 'battle') {
    // A menu is up (start, debrief, end): the world holds still; only the button edges move on.
    trackEdges(world);
    return;
  }
  stepFlight(world.ship, actions, tuning.flight, world.events, dt);
  stepFighters(world); // prototype 2 (B1): enemy fighters
  stepSquadron(world); // prototype 2 (B2/B3): wingmen and orders
  stepLockOn(world); // prototype 2 (A1): lock set
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
  stepMissiles(world); // prototype 2 (A2): salvo launch, motion and hits
  stepBullets(world.bullets, world.targets, tuning.weapons, world.events, dt, world.fighters);
  world.stats.kills += resolveKills(world.targets, tuning.arena, world.events);
  if (tuning.arena.enemiesFrozen) {
    // Debug freeze: drones and turrets stay put and silent, shots in the air vanish.
    for (const t of world.targets) {
      t.vx = 0;
      t.vy = 0;
    }
    world.enemyShots.clear();
  } else {
    stepTargets(
      world.targets,
      world.ship,
      tuning.arena,
      tuning.flight.arenaRadius,
      world.enemyShots,
      world.rng,
      world.trial.active,
      dt,
      world.pods,
      tuning.rescue.podThreatRange,
      world.events,
    );
    world.stats.hitsTaken += stepEnemyShots(
      world.enemyShots,
      world.ship,
      tuning.arena,
      world.events,
      dt,
      world.run.mode === 'run' ? world.run.hull : 0,
    );
  }
  stepPods(world); // prototype 3 (B1): rescue pods
  // Prototype 2 (B1): next wave of enemy fighters; in a run (prototype 3, A2) the battle's objective.
  if (world.run.mode === 'run' && world.run.battle > 0) stepRunBattle(world);
  else stepWaves(world);
  stepPilots(world); // prototype 3 (A1): credit this step's kills to the pilots who made them
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
  trackEdges(world);
}

/** Remembers this step's buttons so the next step can tell a fresh press from a held one. */
function trackEdges(world: World): void {
  const { actions, prev } = world;
  prev.launch = actions.launch;
  prev.attackOrder = actions.attackOrder;
  prev.cycleFormation = actions.cycleFormation;
  prev.menuUp = actions.menuUp;
  prev.menuDown = actions.menuDown;
  prev.menuSelect = actions.menuSelect;
  prev.menuBack = actions.menuBack;
}

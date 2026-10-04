import { CALLSIGNS, FIRST_NAMES } from '../../../data/content/names';
import { TRAIT_IDS } from '../../../data/content/traits';
import { clamp, TAU } from '../math';
import { stepSeconds } from './clock';
import type { World } from './world';

/**
 * A rescue pod (spec section 3): in the battles of `podFirstBattle`..`podLastBattle`, when wave
 * `podWave` starts and the squad has a free slot, one pod appears far out, drifts, and can be
 * rescued by staying close, or shot to pieces by enemies (taking its pilot with it).
 */
export interface Pod {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  alive: boolean;
  /** 0..1 rescue progress: fills while the player is close, drains while away. */
  progress: number;
  /** The id the pilot inside will get when rescued, fixed when the pod spawns so a replay is reproducible. */
  pilotId: number;
  /** The battle it belongs to (one pod per battle). Pods of earlier battles are dropped. */
  battle: number;
  /** Rescued (its pilot has joined). A pod that is neither alive nor rescued was destroyed. */
  rescued: boolean;
}

/** The squad size limit until the pilots module (issue A1) provides `pilots.squadMax`. */
const DEFAULT_SQUAD_MAX = 4;

/** Pods drift back toward the middle once past this fraction of the arena radius. */
const EDGE_TURN_FRACTION = 0.95;

function squadMax(world: World): number {
  return (world.tuning.pilots as { squadMax?: number }).squadMax ?? DEFAULT_SQUAD_MAX;
}

/** True when the squad has no free slot (so no pod appears and a rescue cannot complete). */
export function squadFull(world: World): boolean {
  let active = 0;
  for (const p of world.pilots.roster) if (p.status === 'active') active++;
  return active >= squadMax(world);
}

/** Whether `battle` is one in which a pod may appear. */
export function podBattle(world: World, battle: number): boolean {
  const cfg = world.tuning.rescue;
  return battle >= cfg.podFirstBattle && battle <= cfg.podLastBattle;
}

function spawnPod(world: World): void {
  const cfg = world.tuning.rescue;
  const arena = world.tuning.flight.arenaRadius;
  const angle = world.rng.range(0, TAU);
  const heading = world.rng.range(0, TAU);
  const r = arena * cfg.podSpawnFraction;
  const x = Math.cos(angle) * r;
  const y = Math.sin(angle) * r;
  world.pods.push({
    x,
    y,
    vx: Math.cos(heading) * cfg.podDriftSpeed,
    vy: Math.sin(heading) * cfg.podDriftSpeed,
    hp: cfg.podHealth,
    alive: true,
    progress: 0,
    pilotId: world.pilots.nextId++,
    battle: world.run.battle,
    rescued: false,
  });
  world.events.emit({ type: 'PodSpawned', x, y });
}

/**
 * Brings the rescued pilot aboard. The pilot is generated here from the seeded RNG (a name from the
 * name tables, a random trait) so rescues work on their own; the integration issue (I1) swaps this
 * one function for the pilots module's generator once both tracks are on main.
 */
export function joinRescuedPilot(world: World, pilotId: number): void {
  const first = FIRST_NAMES[world.rng.int(FIRST_NAMES.length)]!;
  const callsign = CALLSIGNS[world.rng.int(CALLSIGNS.length)]!;
  const trait = TRAIT_IDS[world.rng.int(TRAIT_IDS.length)]!;
  world.pilots.roster.push({
    id: pilotId,
    name: `${first} "${callsign}"`,
    trait,
    kills: 0,
    battles: 0,
    status: 'active',
    veteran: false,
  });
  world.events.emit({ type: 'PilotJoined', pilotId, how: 'rescue' });
}

/** The nearest living pod to (x, y) within `range`, or -1. Used by enemy targeting. */
export function nearestPod(world: World, x: number, y: number, range: number): number {
  let best = -1;
  let bestSq = range * range;
  for (let i = 0; i < world.pods.length; i++) {
    const p = world.pods[i]!;
    if (!p.alive) continue;
    const sq = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (sq <= bestSq) {
      best = i;
      bestSq = sq;
    }
  }
  return best;
}

/**
 * Runs after enemy shots each step: spawns the battle's pod, drifts pods, lets enemy bullets hit
 * them, and advances the rescue. Does nothing in practice mode (there are no pods) and while a menu is up.
 */
export function stepPods(world: World): void {
  const { run } = world;
  if (run.mode === 'run' && run.phase !== 'battle') return; // menus: the world is paused
  const dt = stepSeconds(world);
  if (dt <= 0) return;
  const cfg = world.tuning.rescue;
  const pods = world.pods;

  // Pods of earlier battles are gone.
  for (let i = pods.length - 1; i >= 0; i--) {
    if (pods[i]!.battle !== run.battle) pods.splice(i, 1);
  }

  // The battle's pod: one per battle, when its wave starts, if the squad has room.
  if (
    run.mode === 'run' &&
    podBattle(world, run.battle) &&
    run.wave === cfg.podWave &&
    !pods.some((p) => p.battle === run.battle) &&
    !squadFull(world)
  ) {
    spawnPod(world);
  }

  const arena = world.tuning.flight.arenaRadius;
  const shots = world.enemyShots;
  const ship = world.ship;
  for (const pod of pods) {
    if (!pod.alive) continue;

    // Drift, turning back toward the middle near the edge.
    pod.x += pod.vx * dt;
    pod.y += pod.vy * dt;
    const dist = Math.hypot(pod.x, pod.y);
    if (dist > arena * EDGE_TURN_FRACTION && cfg.podDriftSpeed > 0) {
      pod.vx = (-pod.x / dist) * cfg.podDriftSpeed;
      pod.vy = (-pod.y / dist) * cfg.podDriftSpeed;
    }

    // Enemy bullets that reach it hurt it (and are used up).
    const reach = cfg.podRadius;
    for (let k = shots.count - 1; k >= 0; k--) {
      const dx = shots.data.x[k]! - pod.x;
      const dy = shots.data.y[k]! - pod.y;
      if (dx * dx + dy * dy > (reach + world.tuning.arena.enemyShotRadius) ** 2) continue;
      shots.remove(k);
      pod.hp -= 1;
      if (pod.hp <= 0) break;
    }
    if (pod.hp <= 0) {
      pod.alive = false;
      world.events.emit({ type: 'PodLost' });
      continue;
    }

    // Rescue: fills while the player is close, drains while away.
    const near = Math.hypot(ship.x - pod.x, ship.y - pod.y) <= cfg.rescueRadius;
    const rate = dt / cfg.rescueTime;
    pod.progress = clamp(pod.progress + (near ? rate : -rate * cfg.rescueDrain), 0, 1);
    if (pod.progress >= 1 && !squadFull(world)) {
      pod.alive = false;
      pod.rescued = true;
      world.events.emit({ type: 'PodRescued', pilotId: pod.pilotId });
      joinRescuedPilot(world, pod.pilotId);
    }
  }
}

/** Feeds the pods into the replay hash. Add every field you add to `Pod`. */
export function mixPods(mix: (n: number) => void, pods: readonly Pod[]): void {
  mix(pods.length);
  for (const p of pods) {
    for (const v of [p.x, p.y, p.vx, p.vy, p.hp, p.progress, p.pilotId, p.battle]) mix(v);
    mix(p.alive ? 1 : 0);
    mix(p.rescued ? 1 : 0);
  }
}

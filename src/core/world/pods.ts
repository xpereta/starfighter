import { clamp, TAU } from '../math';
import { addPilot, generatePilots } from '../pilots/pilots';
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
  /** The id of the pilot once rescued (0 while the pod is still out there). */
  pilotId: number;
  /** The battle it belongs to (one pod per battle). Pods of earlier battles are dropped. */
  battle: number;
  /** Rescued (its pilot has joined). A pod that is neither alive nor rescued was destroyed. */
  rescued: boolean;
}

/** Pods drift back toward the middle once past this fraction of the arena radius. */
const EDGE_TURN_FRACTION = 0.95;

/** True when the squad has no free slot (so no pod appears and a rescue cannot complete). */
export function squadFull(world: World): boolean {
  let active = 0;
  for (const p of world.pilots.roster) if (p.status === 'active') active++;
  return active >= world.tuning.pilots.squadMax;
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
    pilotId: 0,
    battle: world.run.battle,
    rescued: false,
  });
  world.events.emit({ type: 'PodSpawned', x, y });
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
    world.tick - run.waveStartTick <= 1 && // only when the wave starts, not whenever a slot frees up later
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
      // The rescued pilot is generated by the pilots module (seeded, never repeating a name).
      const pilot = addPilot(world, generatePilots(world, 1)[0]!, 'rescue');
      if (pilot) {
        pod.alive = false;
        pod.rescued = true;
        pod.pilotId = pilot.id;
        world.events.emit({ type: 'PodRescued', pilotId: pilot.id });
      }
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

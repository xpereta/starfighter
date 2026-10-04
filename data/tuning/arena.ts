import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Practice arena content and tuning. Units: world units (u), seconds (s). */
export const arenaParams = {
  staticCount: {
    default: 20,
    min: 0,
    max: 100,
    unit: 'targets',
    note: 'Number of stationary target drones. Higher = a busier arena for gunnery; lower = emptier. The layout is built when the arena is created, so a change shows after a respawn (R).',
  },
  staticHp: {
    default: 3,
    min: 1,
    max: 20,
    unit: 'hp',
    note: 'Hits a stationary drone takes to destroy. Higher = tougher; lower = pops quickly.',
  },
  staticRadius: {
    default: 30,
    min: 10,
    max: 80,
    unit: 'u',
    note: 'Hit-circle size of stationary drones. Higher = bigger, easier targets; lower = harder to hit.',
  },
  staticSpawnMin: {
    default: 700,
    min: 0,
    max: 20000,
    unit: 'u',
    note: 'Nearest distance from the arena center where stationary drones can appear. Higher = a clear zone around the start; lower = targets right next to you.',
  },
  staticSpawnMax: {
    default: 5000,
    min: 0,
    max: 20000,
    unit: 'u',
    note: 'Farthest distance for stationary drones. Higher = spread across the arena; lower = clustered near the center.',
  },

  droneCount: {
    default: 10,
    min: 0,
    max: 50,
    unit: 'drones',
    note: 'Number of moving drones (the time trial targets). Higher = longer trials; lower = shorter trials. 0 = none. Applies after a respawn (R).',
  },
  /** Share of drones that orbit; the rest fly straight (and turn back at the arena edge). */
  droneCircleShare: {
    default: 0.5,
    min: 0,
    max: 1,
    unit: '',
    note: 'Share of moving drones that orbit instead of flying straight. 1 = all orbit and are more predictable; 0 = all fly straight. Applies after a respawn (R).',
  },
  droneHp: {
    default: 4,
    min: 1,
    max: 20,
    unit: 'hp',
    note: 'Hits a moving drone takes. Higher = more tracking time per kill; lower = quick kills.',
  },
  droneRadius: {
    default: 26,
    min: 10,
    max: 80,
    unit: 'u',
    note: 'Hit-circle size of moving drones. Higher = easier to hit; lower = harder to hit.',
  },
  droneSpeedMin: {
    default: 100,
    min: 20,
    max: 400,
    unit: 'u/s',
    note: 'Slowest speed a moving drone can be given at the start. Higher = every drone is harder to chase; lower = some are easy prey.',
  },
  droneSpeedMax: {
    default: 250,
    min: 20,
    max: 400,
    unit: 'u/s',
    note: 'Fastest speed a moving drone can be given. Higher = some drones are hard to catch; lower = a gentler arena.',
  },
  droneOrbitMin: {
    default: 300,
    min: 100,
    max: 2000,
    unit: 'u',
    note: 'Smallest orbit radius for circling drones. Higher = gentle arcs; lower = tight circles that are hard to track.',
  },
  droneOrbitMax: {
    default: 600,
    min: 100,
    max: 2000,
    unit: 'u',
    note: 'Largest orbit radius for circling drones. Higher = wide sweeping arcs; lower = all orbits are compact.',
  },
  droneSpawnMin: {
    default: 900,
    min: 0,
    max: 20000,
    unit: 'u',
    note: 'Nearest distance from the arena center where moving drones start. Higher = they begin far from you; lower = they start close.',
  },
  droneSpawnMax: {
    default: 4500,
    min: 0,
    max: 20000,
    unit: 'u',
    note: 'Farthest distance where moving drones start. Higher = spread across the arena; lower = clustered near the center.',
  },

  turretCount: {
    default: 2,
    min: 0,
    max: 10,
    unit: 'turrets',
    note: 'Number of turrets that shoot at you. Higher = more shots to dodge; 0 = a peaceful arena. Applies after a respawn (R).',
  },
  turretHp: {
    default: 8,
    min: 1,
    max: 40,
    unit: 'hp',
    note: 'Hits a turret takes to destroy. Higher = a long duel; lower = a quick kill.',
  },
  turretRadius: {
    default: 42,
    min: 10,
    max: 100,
    unit: 'u',
    note: 'Hit-circle size of turrets. Higher = easy to hit; lower = harder.',
  },
  turretFireInterval: {
    default: 2.5,
    min: 0.3,
    max: 10,
    unit: 's',
    note: 'Seconds between turret shots (with random jitter). Higher = fewer shots, easy to dodge; lower = a constant stream.',
  },
  turretRange: {
    default: 2400,
    min: 500,
    max: 8000,
    unit: 'u',
    note: 'Distance within which turrets fire at you. Higher = they threaten from afar; lower = you can pass at a safe distance.',
  },
  turretSpawnMin: {
    default: 1500,
    min: 0,
    max: 20000,
    unit: 'u',
    note: 'Nearest distance from the arena center where turrets are placed. Higher = none near the start; lower = turrets next to you.',
  },
  turretSpawnMax: {
    default: 3000,
    min: 0,
    max: 20000,
    unit: 'u',
    note: 'Farthest distance for turrets. Higher = spread across the arena; lower = clustered near the center.',
  },

  enemyShotSpeed: {
    default: 320,
    min: 100,
    max: 900,
    unit: 'u/s',
    note: 'Speed of turret shots. Higher = harder to dodge, almost needs an evade; lower = slow shots you can fly around.',
  },
  enemyShotLife: {
    default: 5,
    min: 1,
    max: 15,
    unit: 's',
    note: 'How long a turret shot flies before vanishing. Higher = shots linger and clutter the arena; lower = shots fade before they reach you.',
  },
  enemyShotRadius: {
    default: 9,
    min: 2,
    max: 40,
    unit: 'u',
    note: 'Size of a turret shot hit circle. Higher = harder to slip past; lower = tight dodges succeed.',
  },
  enemyShotCap: {
    default: 60,
    min: 5,
    max: 400,
    unit: 'shots',
    note: 'Size of the turret shot pool, fixed when the game starts (reload to apply). Higher = never drops a shot; lower = turrets stop firing when the pool is full.',
  },
  playerRadius: {
    default: 24,
    min: 5,
    max: 80,
    unit: 'u',
    note: 'Size of the ship hit circle for enemy shots. Higher = easier to hit and harder to dodge; lower = forgiving.',
  },

  respawnDelay: {
    default: 10,
    min: 1,
    max: 60,
    unit: 's',
    note: 'Seconds before a destroyed target comes back. Higher = the arena empties as you shoot; lower = targets return quickly so practice never stops.',
  },
} as const satisfies Record<string, ParamDef>;

export type ArenaConfig = { -readonly [K in keyof typeof arenaParams]: number } & {
  /** Debug: every enemy stops (no movement, shooting, waves or respawns) so you can test in peace. */
  enemiesFrozen: boolean;
};

export function createArenaConfig(): ArenaConfig {
  return { ...defaultsOf(arenaParams), enemiesFrozen: false };
}

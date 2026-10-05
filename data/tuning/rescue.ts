import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Rescue pods (spec: docs/specs/prototype-3-pilots.md section 3). Units: world units (u), seconds (s). */
export const rescueParams = {
  podFirstBattle: {
    default: 2,
    min: 1,
    max: 8,
    unit: 'battle',
    note: 'First battle of a run in which a rescue pod can appear. Pods only appear when the squad has a free slot. Higher = the first battles stay pod-free; lower = a pod from the very first battle.',
  },
  podLastBattle: {
    default: 3,
    min: 1,
    max: 8,
    unit: 'battle',
    note: 'Last battle in which a rescue pod can appear (the final battle has none by default). One pod appears per battle between the first and last battle.',
  },
  podWave: {
    default: 2,
    min: 1,
    max: 8,
    unit: 'wave',
    note: 'The wave of the battle during which the pod appears, far out in the arena. Higher = the pod comes later in the fight; lower = it shows up sooner.',
  },
  podHealth: {
    default: 8,
    min: 1,
    max: 10,
    unit: 'hp',
    note: 'Hit points of a pod. Each enemy bullet that hits takes one; at zero the pod and its pilot are lost for good. Higher = easier to protect; lower = you must hurry or clear the enemies near it.',
  },
  podRadius: {
    default: 22,
    min: 10,
    max: 80,
    unit: 'u',
    note: 'Size of a pod hit circle, used for enemy bullets. Higher = a bigger target that is easier to hit; lower = harder for enemies to hit.',
  },
  podDriftSpeed: {
    default: 25,
    min: 0,
    max: 120,
    unit: 'u/s',
    note: 'How fast the pod drifts. It turns back toward the middle near the arena edge. Higher = a moving target that is harder to stay close to; 0 = it sits still.',
  },
  podSpawnFraction: {
    default: 0.7,
    min: 0.2,
    max: 0.95,
    unit: 'x arena',
    note: 'How far from the arena center the pod appears, as a share of the arena radius, in a seeded random direction. Higher = near the edge, a long flight; lower = closer to where you start.',
  },
  rescueRadius: {
    default: 160,
    min: 40,
    max: 600,
    unit: 'u',
    note: 'How close you must be to the pod for the rescue to progress. Higher = easier to rescue from a distance; lower = you must fly right up to it.',
  },
  rescueTime: {
    default: 2.5,
    min: 0.5,
    max: 10,
    unit: 's',
    note: 'Seconds you must stay within the rescue radius to bring the pilot aboard. Higher = a longer, riskier hold; lower = a quick pick-up.',
  },
  rescueDrain: {
    default: 0.5,
    min: 0,
    max: 4,
    unit: 'x fill',
    note: 'How fast rescue progress drains while you are away, compared with how fast it fills. 0 = progress is kept; 1 = it drains as fast as it fills. Higher = you must commit; lower = you can dodge in and out.',
  },
  podThreatRange: {
    default: 700,
    min: 200,
    max: 4000,
    unit: 'u',
    note: 'Enemy fighters and turrets treat a pod as a target when it is within this distance of them. Higher = enemies notice the pod from far away; lower = a pod can sit safely unless they pass close.',
  },
} as const satisfies Record<string, ParamDef>;

export type RescueConfig = { -readonly [K in keyof typeof rescueParams]: number };

export function createRescueConfig(): RescueConfig {
  return defaultsOf(rescueParams);
}

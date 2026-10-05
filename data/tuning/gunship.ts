import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/**
 * Gunship tuning (spec section 3), a STUB for track A: typed and validated, not yet read by any
 * gameplay and not yet part of `Tuning`, the panel or the replay. Track A wires it in (see docs/p5-tracks.md).
 * Units: world units (u), seconds (s); angles in degrees here, radians inside core.
 */
export const gunshipParams = {
  standoff: {
    default: 700,
    min: 200,
    max: 2500,
    unit: 'u',
    note: 'Distance the gunship tries to keep from its target. Higher = it shells you from afar; lower = it comes close and is easier to flank.',
  },
  turretFireRate: {
    default: 12,
    min: 1,
    max: 30,
    unit: 'shots/s',
    note: 'How fast each gunship turret fires while in a burst. Higher = a denser stream to dodge; lower = sparser fire.',
  },
  turretBurstShots: {
    default: 18,
    min: 1,
    max: 60,
    unit: 'shots',
    note: 'Shots in one turret burst before it pauses. Higher = longer bursts and fewer windows to attack; lower = more windows.',
  },
  turretBurstPause: {
    default: 1.6,
    min: 0,
    max: 8,
    step: 0.1,
    unit: 's',
    note: 'Pause between turret bursts: the window in which flying close is safe. Higher = more openings; lower = near-constant fire.',
  },
  turretArc: {
    default: 110,
    min: 30,
    max: 180,
    unit: '°',
    note: 'Half-width of each turret firing arc. 180 = no blind spot; lower = bigger blind spots to flank through.',
  },
} as const satisfies Record<string, ParamDef>;

export type GunshipConfig = { -readonly [K in keyof typeof gunshipParams]: number };

export function createGunshipConfig(): GunshipConfig {
  return defaultsOf(gunshipParams);
}

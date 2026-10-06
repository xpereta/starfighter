import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/**
 * Formation wing tuning (spec section 2), read live by `core/ai/wings.ts`. Units: u, hp, s.
 * Size, slot spacing and the leader's extra hull are read when a wing spawns; the break rules
 * and the cue are live.
 */
export const wingsParams = {
  size: {
    default: 4,
    min: 3,
    max: 5,
    unit: 'fighters',
    note: 'Fighters in a wing, the leader included. Higher = a bigger formation to break up; lower = a small flight.',
  },
  slotRadius: {
    default: 140,
    min: 60,
    max: 500,
    unit: 'u',
    note: 'Spacing of the formation slots around the leader. Higher = a loose formation; lower = a tight one that is easy to hit together.',
  },
  leaderExtraHp: {
    default: 1,
    min: 0,
    max: 5,
    unit: 'hp',
    note: 'Extra hull points the leader has over a normal fighter. Higher = the leader is hard to drop; 0 = the same as the rest.',
  },
  breakProximity: {
    default: 500,
    min: 100,
    max: 1500,
    unit: 'u',
    note: 'When the player gets this close, the wing breaks formation and fights as ordinary fighters. Higher = it breaks early; lower = it holds the formation until you are on top of it.',
  },
  cueTime: {
    default: 4,
    min: 0,
    max: 20,
    step: 0.5,
    unit: 's',
    note: 'How long the WING INBOUND cue shows after a wing arrives (while it still holds formation). 0 = no cue.',
  },
} as const satisfies Record<string, ParamDef>;

/** Which formation a wing flies: `mixed` picks one per wing from the seeded rng. */
export type WingShapeSetting = 'mixed' | 'v' | 'line' | 'box';

export type WingsConfig = { -readonly [K in keyof typeof wingsParams]: number } & {
  /** Forces every wing into one formation (debug), or `mixed` for a random one per wing. */
  shape: WingShapeSetting;
};

export function createWingsConfig(): WingsConfig {
  return { ...defaultsOf(wingsParams), shape: 'mixed' };
}

/**
 * What makes a fighter a missile fighter ("lancer", spec section 4): present on `Fighter.lancer`
 * (null for ordinary fighters). Kept apart so the plain fighter state and its hash stay as they were.
 */
export interface LancerState {
  /** Seconds until the next launch (a burst counts as one launch, timed from its first missile). */
  missileTimer: number;
  /** Missiles of the current burst still to leave (0 = none pending). */
  burstLeft: number;
  /** Seconds until the next missile of the burst. */
  burstTimer: number;
  /** Which way it circles the player while waiting: -1 right, +1 left. */
  side: -1 | 1;
}

export function createLancerState(missileTimer: number, side: -1 | 1): LancerState {
  return { missileTimer, burstLeft: 0, burstTimer: 0, side };
}

/** Feeds a lancer's state into the replay hash. Add every field you add to `LancerState`. */
export function mixLancer(mix: (n: number) => void, l: LancerState): void {
  mix(l.missileTimer);
  mix(l.burstLeft);
  mix(l.burstTimer);
  mix(l.side);
}

import type { GameEvent } from '../../core/events/events';
import type { ComboDef, PresentationDef } from './presentation';

/**
 * The kill streak, the score and the kill feed. UI only: they count `Killed` events and never touch
 * the world (the real kill count stays in `world.stats`). Nothing here is in the replay hash.
 */

export interface FeedEntry {
  /** `FIGHTER DESTROYED`. */
  text: string;
  /** Who got it: a pilot's name, or `YOU`. */
  by: string;
  points: number;
  /** Seconds on screen. */
  age: number;
  /** Streak length when this kill landed. */
  streak: number;
}

export interface Combo {
  /** Kills in the current streak. */
  count: number;
  /** Seconds left before the streak breaks. */
  timer: number;
  /** Longest streak this run. */
  best: number;
  /** Score this run (UI only). */
  score: number;
  /** Streak length the tier call last announced (so a tier is called once). */
  announced: number;
  /** Seconds the latest tier call stays on screen. */
  callTimer: number;
  /** The latest tier call (`GREAT`), empty when none. */
  call: string;
  /** Pulses 1 -> 0 on every kill (the counter pops). */
  pop: number;
  feed: FeedEntry[];
}

export function createCombo(): Combo {
  return {
    count: 0,
    timer: 0,
    best: 0,
    score: 0,
    announced: 0,
    callTimer: 0,
    call: '',
    pop: 0,
    feed: [],
  };
}

export function resetCombo(c: Combo): void {
  Object.assign(c, createCombo());
}

/** Score multiplier of a streak: x1 below `step` kills, then +0.5 for every further `step` kills, capped. */
export function multiplierOf(count: number, def: ComboDef): number {
  return Math.min(def.maxMultiplier, 1 + Math.floor(count / def.step) * 0.5);
}

/** The tier a streak has reached (label), or null below the first tier. */
export function tierOf(count: number, def: ComboDef): string | null {
  let label: string | null = null;
  for (const t of def.tiers) if (count >= t.at) label = t.label;
  return label;
}

const ENEMY = (kind: string): boolean => kind !== 'wingman';

/** Seconds a tier call stays up. */
export const CALL_SECONDS = 1.6;
/** Seconds the counter pop takes. */
const POP_SECONDS = 0.35;

/** Reads this step's events: kills extend the streak, score and feed; pilot kills name the killer; a new run resets. */
export function feedCombo(
  c: Combo,
  events: readonly GameEvent[],
  pilotName: (id: number) => string | undefined,
  def: PresentationDef,
): void {
  const named: string[] = [];
  const fresh: FeedEntry[] = [];
  for (const e of events) {
    if (e.type === 'BattleStarted' && e.battle === 1) resetCombo(c);
    else if (e.type === 'Killed' && ENEMY(e.kind)) {
      c.count++;
      c.best = Math.max(c.best, c.count);
      c.timer = def.combo.window;
      c.pop = 1;
      const points = Math.round(def.points[e.kind] * multiplierOf(c.count, def.combo));
      c.score += points;
      const entry: FeedEntry = {
        text: `${def.killLabels[e.kind]} DESTROYED`,
        by: 'YOU',
        points,
        age: 0,
        streak: c.count,
      };
      fresh.push(entry);
      const tier = tierOf(c.count, def.combo);
      if (tier && c.count > c.announced && def.combo.tiers.some((t) => t.at === c.count)) {
        c.call = tier;
        c.callTimer = CALL_SECONDS;
      }
      c.announced = Math.max(c.announced, c.count);
    } else if (e.type === 'PilotKill') {
      const name = pilotName(e.pilotId);
      if (name) named.push(name);
    }
  }
  // A pilot kill follows its `Killed` in the same step: the latest entries are theirs.
  for (let i = 0; i < named.length && i < fresh.length; i++)
    fresh[fresh.length - 1 - i]!.by = named[i]!;
  c.feed.push(...fresh);
}

/** Advances the timers by `dt` seconds; a streak that runs out breaks, old feed lines go. */
export function stepCombo(c: Combo, dt: number, def: PresentationDef): void {
  if (c.count > 0) {
    c.timer -= dt;
    if (c.timer <= 0) {
      c.count = 0;
      c.timer = 0;
      c.announced = 0;
    }
  }
  c.callTimer = Math.max(0, c.callTimer - dt);
  c.pop = Math.max(0, c.pop - dt / POP_SECONDS);
  for (const f of c.feed) f.age += dt;
  c.feed = c.feed.filter((f) => f.age < def.feedLife);
  if (c.feed.length > def.feedLines) c.feed.splice(0, c.feed.length - def.feedLines);
}

/** How full the streak's timer bar is, 1 at a kill down to 0 as the streak breaks. */
export function streakFill(c: Combo, def: ComboDef): number {
  return c.count > 0 ? Math.max(0, Math.min(1, c.timer / def.window)) : 0;
}

/** Opacity of a feed line: full, fading in its last second. */
export function feedAlpha(f: FeedEntry, def: PresentationDef): number {
  return Math.max(0, Math.min(1, def.feedLife - f.age));
}

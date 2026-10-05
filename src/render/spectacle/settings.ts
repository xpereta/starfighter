import type { QualityLevel } from '../../../data/quality';

/**
 * Live switches of the spectacle effects (the panel's Spectacle section edits them; nothing is
 * saved). A switch only turns the effect off: what it looks like comes from the style pack.
 */
export const spectacleSettings = {
  post: true,
  bloom: true,
  backdrop: true,
  ships: true,
  combat: true,
  cards: true,
  /** Which battle's sky to show: 0 = follow the run, 1..8 = that battle's palette (`?sky=2`, or the panel). */
  sky: 0,
  /** Overall strength of the transient effects (flashes, rings, sparks, punch), 0..1. */
  intensity: 1,
};

export const FX_STORAGE_KEY = 'starfighter.fx';
export const FX_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];

const isLevel = (v: string | null): v is QualityLevel =>
  v !== null && (FX_LEVELS as readonly string[]).includes(v);

/** `?fx=` wins, then the level chosen in the panel (remembered), then `high`. Unknown values are ignored. */
export function chooseFxLevel(search: string, stored: string | null): QualityLevel {
  const asked = new URLSearchParams(search).get('fx');
  if (isLevel(asked)) return asked;
  if (isLevel(stored)) return stored;
  return 'high';
}

let level: QualityLevel = 'high';
let levelRevision = 0;

export function currentFxLevel(): QualityLevel {
  return level;
}

/** Bumped when the level changes, so the spectacle rebuilds its pools. */
export function fxLevelRevision(): number {
  return levelRevision;
}

/** Sets the level; `remember` keeps it for next time (the panel does, `?fx=` does not). */
export function setFxLevel(next: QualityLevel, remember = false): void {
  if (remember) {
    try {
      localStorage.setItem(FX_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice lasts until reload.
    }
  }
  if (next === level) return;
  level = next;
  levelRevision++;
}

/** Reads `?fx=` and the remembered level once at startup. */
export function initFxLevel(search: string): QualityLevel {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(FX_STORAGE_KEY);
  } catch {
    // blocked
  }
  level = chooseFxLevel(search, stored);
  levelRevision++;
  const sky = Number(new URLSearchParams(search).get('sky'));
  if (Number.isInteger(sky) && sky >= 1 && sky <= 8) spectacleSettings.sky = sky;
  return level;
}

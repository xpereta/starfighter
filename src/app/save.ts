import { createMeta, parseMeta, type MetaData } from '../core/meta/meta';

/** Persistent player data. Bump SAVE_VERSION when the shape changes (and add a migration below). */
export const SAVE_VERSION = 2;
const STORAGE_KEY = 'starfighter.save';

export interface SaveData {
  version: number;
  bestTrialTime: number | null;
  /** Prototype 3: the veterans roster and the best run. */
  meta: MetaData;
}

export function defaultSave(): SaveData {
  return { version: SAVE_VERSION, bestTrialTime: null, meta: createMeta() };
}

function trialTime(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Parses stored text. Version 1 (just the best trial time) migrates to version 2 without losing it;
 * anything missing, corrupt or from an unknown version falls back to defaults.
 */
export function parseSave(text: string | null): SaveData {
  if (!text) return defaultSave();
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null) return defaultSave();
    const obj = raw as Record<string, unknown>;
    if (obj.version === 1) {
      return {
        version: SAVE_VERSION,
        bestTrialTime: trialTime(obj.bestTrialTime),
        meta: createMeta(),
      };
    }
    if (obj.version !== SAVE_VERSION) return defaultSave();
    return {
      version: SAVE_VERSION,
      bestTrialTime: trialTime(obj.bestTrialTime),
      meta: parseMeta(obj.meta),
    };
  } catch {
    return defaultSave();
  }
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}

/** Browser storage wrappers; storage can be blocked, so failures are ignored. */
export function loadSave(): SaveData {
  try {
    return parseSave(localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultSave();
  }
}

export function storeSave(save: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeSave(save));
  } catch {
    // Private mode or blocked storage: the best time and the veterans just will not persist.
  }
}

/** True when storage holds a save from a newer version of the game: it must not be overwritten. */
export function saveIsFromNewerVersion(): boolean {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return (
      typeof raw === 'object' &&
      raw !== null &&
      typeof (raw as { version?: unknown }).version === 'number' &&
      (raw as { version: number }).version > SAVE_VERSION
    );
  } catch {
    return false;
  }
}

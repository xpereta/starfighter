/** Persistent player data. Bump SAVE_VERSION when the shape changes (saves will change). */
export const SAVE_VERSION = 1;
const STORAGE_KEY = 'starfighter.save';

export interface SaveData {
  version: number;
  bestTrialTime: number | null;
}

export function defaultSave(): SaveData {
  return { version: SAVE_VERSION, bestTrialTime: null };
}

/** Parses stored text; anything missing, corrupt or from another version falls back to defaults. */
export function parseSave(text: string | null): SaveData {
  if (!text) return defaultSave();
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null) return defaultSave();
    const obj = raw as Record<string, unknown>;
    if (obj.version !== SAVE_VERSION) return defaultSave();
    const best = obj.bestTrialTime;
    return {
      version: SAVE_VERSION,
      bestTrialTime: typeof best === 'number' && Number.isFinite(best) && best > 0 ? best : null,
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
    // Private mode or blocked storage: the best time just will not persist.
  }
}

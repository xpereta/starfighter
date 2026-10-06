import { presentation as animeSpectacle } from '../../../data/styles/anime-spectacle/presentation';
import { chosenStyleId } from '../../render/style-active';
import { validatePresentation, type PresentationDef } from './presentation';
import { initSettings, readStoredSettings, spectacle } from './settings';

/**
 * Which styles have a presentation: one line per style pack that provides one. A style that is not
 * listed keeps the classic HUD and menus, untouched.
 */
export const presentations: Readonly<Record<string, PresentationDef>> = {
  'anime-spectacle': animeSpectacle,
};

let current: PresentationDef | null = null;

/** Call once at startup, after `initStyle`. Returns the presentation when the style has one and its flag is on. */
export function initSpectacle(
  search: string,
  styleId: string = chosenStyleId(),
): PresentationDef | null {
  const def = presentations[styleId] ?? null;
  if (def) {
    const errors = validatePresentation(def);
    if (errors.length) throw new Error(`presentation of "${styleId}": ${errors.join('; ')}`);
  }
  current = def && def.enabled ? def : null;
  if (current) initSettings(search, current.preset, readStoredSettings());
  return current;
}

/** The active style's presentation, or null (classic look). */
export function activePresentation(): PresentationDef | null {
  return current;
}

/** True when the spectacle presentation is on: the style has one and the master switch is on. */
export function spectacleOn(): boolean {
  return current !== null && spectacle.enabled;
}

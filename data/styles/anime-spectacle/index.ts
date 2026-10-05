import type { StyleInput } from '../../../src/render/style';
import { deaths } from './deaths';
import { explosions } from '../anime-80s/explosions';
import { ships } from '../anime-80s/ships';
import { loops, music, sounds } from './sounds';
import { spectacle } from './spectacle';
import { manifest } from './style';
import { theme } from './theme';

/**
 * The combined pack: ships, deaths and explosions of the parent `anime-80s`, this pack's own theme,
 * render spectacle (`spectacle.ts`), cinematic sound set, loops and adaptive score. The UI
 * presentation (`presentation.ts`) is not part of the style contract: `src/ui/spectacle/active.ts`
 * reads it directly.
 */
export const animeSpectacle: StyleInput = {
  manifest,
  theme,
  ships,
  deaths,
  explosions,
  spectacle,
  sounds,
  loops,
  music,
};

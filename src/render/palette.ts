import { PALETTE_KEYS, type Palette } from './style';
import { activeStyle } from './style-active';

/**
 * Limited flat palette: color codes faction and threat so it reads at any zoom.
 * A thin reader: the colours live in the active style pack (`data/styles/<id>/theme.ts`).
 */
export const palette = {} as Readonly<Palette>;
for (const key of PALETTE_KEYS) {
  Object.defineProperty(palette, key, {
    get: () => activeStyle().theme.palette[key],
    enumerable: true,
  });
}

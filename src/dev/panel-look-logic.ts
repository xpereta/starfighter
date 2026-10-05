import type { ParamDef } from '../core/params/params';
import type { PaletteKey, StylePack, Theme } from '../render/style';

/** Pure parts of the Look section: what can be edited, and the files "Save style" writes. */

/** The main colours the panel edits live: the palette roles that ships and the background use. */
export const EDITABLE_COLORS: readonly { key: PaletteKey; label: string; note: string }[] = [
  { key: 'friendly', label: 'Player', note: 'Colour of the player ship.' },
  { key: 'wingman', label: 'Wingmen', note: 'Colour of the wingmen.' },
  { key: 'fighter', label: 'Enemy fighter', note: 'Colour of the enemy fighters.' },
  { key: 'enemy', label: 'Drone', note: 'Colour of the drones.' },
  { key: 'turret', label: 'Turret', note: 'Colour of the turrets.' },
  { key: 'enemyStatic', label: 'Static target', note: 'Colour of the static targets.' },
  { key: 'pod', label: 'Escape pod', note: 'Colour of the rescue pods.' },
  { key: 'background', label: 'Background', note: 'Colour of space behind everything.' },
];

/** Theme numbers with a slider: key, label and range (the default is the pack's own value). */
export const LOOK_SLIDERS: readonly {
  key: 'outlineWidth' | 'shadowShare' | 'glow' | 'speedLines';
  label: string;
  def: Omit<ParamDef, 'default'>;
}[] = [
  {
    key: 'outlineWidth',
    label: 'Outline width',
    def: {
      min: 0,
      max: 8,
      unit: 'u',
      step: 0.1,
      note: 'Thickness of the ink line around every ship, in world units, drawn outside the silhouette. Higher = bolder, more cartoon; 0 = no outline.',
    },
  },
  {
    key: 'shadowShare',
    label: 'Shadow share',
    def: {
      min: 0,
      max: 1,
      unit: '',
      step: 0.05,
      note: 'How much of each ship is in the one hard shadow tone. Higher = more shaded; 0 = flat colour.',
    },
  },
  {
    key: 'glow',
    label: 'Engine glow',
    def: {
      min: 0,
      max: 1,
      unit: '',
      step: 0.05,
      note: 'Brightness of the engine glow, which grows with thrust. 0 = off.',
    },
  },
  {
    key: 'speedLines',
    label: 'Speed lines',
    def: {
      min: 0,
      max: 1,
      unit: '',
      step: 0.05,
      note: 'Streaks around the screen at high speed. 0 = off.',
    },
  },
];

/** The edited theme (and the pack's identity) as a JSON file's text. Colours are '#rrggbb' strings. */
export function styleToJson(pack: StylePack): string {
  const t = pack.theme;
  return `${JSON.stringify(
    {
      format: 'starfighter-style-theme',
      version: 1,
      id: pack.manifest.id,
      note: `Copy these values into data/styles/${pack.manifest.id}/theme.ts as 0xRRGGBB numbers (or use "Save theme.ts").`,
      theme: {
        ...t,
        palette: Object.fromEntries(Object.entries(t.palette).map(([k, v]) => [k, toCss(v)])),
        outlineColor: toCss(t.outlineColor),
        eyeColor: toCss(t.eyeColor),
      },
    },
    null,
    2,
  )}\n`;
}

const hex = (n: number): string => `0x${n.toString(16).padStart(6, '0')}`;

/** The theme as the text of a `theme.ts` file, ready to drop into `data/styles/<id>/`. */
export function themeToTs(theme: Theme): string {
  const p = Object.entries(theme.palette)
    .map(([k, v]) => `    ${k}: ${hex(v)},`)
    .join('\n');
  return `import type { Theme } from '../../../src/render/style';

export const theme: Theme = {
  palette: {
${p}
  },
  outlineWidth: ${theme.outlineWidth},
  outlineColor: ${hex(theme.outlineColor)},
  shadowShare: ${theme.shadowShare},
  glow: ${theme.glow},
  eyeColor: ${hex(theme.eyeColor)},
  speedLines: ${theme.speedLines},
};
`;
}

/** '#rrggbb' of a 0xRRGGBB number (for a colour input), and back. */
export const toCss = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
export const fromCss = (s: string): number => Number.parseInt(s.replace('#', ''), 16);

/** The style to peek at: the first registered one that is not the active one. */
export function otherStyle(ids: readonly string[], active: string): string {
  return ids.find((id) => id !== active) ?? active;
}

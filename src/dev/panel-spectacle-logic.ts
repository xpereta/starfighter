import type { ParamDef } from '../core/params/params';
import type { SpectacleDef, SpectacleSection } from '../render/spectacle-contract';

/** Pure part of the Spectacle section: which numbers of a pack's spectacle get a slider. */
export interface SpectacleSlider {
  section: SpectacleSection;
  /** Path to the object that holds the number, inside the section ('' = the section itself). */
  path: string;
  key: string;
  label: string;
  def: Omit<ParamDef, 'default'>;
}

const slider = (
  section: SpectacleSection,
  path: string,
  key: string,
  label: string,
  min: number,
  max: number,
  unit: string,
  note: string,
  step?: number,
): SpectacleSlider => ({
  section,
  path,
  key,
  label,
  def: { min, max, unit, note, ...(step !== undefined ? { step } : {}) },
});

export const SPECTACLE_SLIDERS: readonly SpectacleSlider[] = [
  slider(
    'post',
    'bloom',
    'strength',
    'Bloom',
    0,
    3,
    '',
    'Glow around bright things (engines, shots, blasts). 0 = off.',
    0.05,
  ),
  slider(
    'post',
    'bloom',
    'radius',
    'Bloom spread',
    0,
    1,
    '',
    'How far the glow spreads. Higher = a softer, wider haze.',
    0.05,
  ),
  slider(
    'post',
    'bloom',
    'threshold',
    'Bloom threshold',
    0,
    1.5,
    '',
    'How bright something must be to glow. Lower = more things glow (white ships too); higher = only the lights.',
    0.02,
  ),
  slider(
    'post',
    'chromatic',
    'base',
    'Colour fringe',
    0,
    1,
    '',
    'Red and blue separate towards the screen edge, like a worn lens. 0 = none.',
    0.02,
  ),
  slider(
    'post',
    'chromatic',
    'hit',
    'Fringe on hit',
    0,
    1,
    '',
    'Extra fringe pulse when you are hit and on big kills.',
    0.05,
  ),
  slider('post', '', 'vignette', 'Vignette', 0, 1, '', 'Dark corners. 0 = none.', 0.02),
  slider('post', '', 'grain', 'Film grain', 0, 1, '', 'Animated film grain. 0 = none.', 0.02),
  slider(
    'post',
    '',
    'scanlines',
    'Scanlines',
    0,
    1,
    '',
    'Fine horizontal lines like a laser-disc master. 0 = none.',
    0.02,
  ),
  slider(
    'post',
    '',
    'punch',
    'Zoom punch',
    0,
    1,
    '',
    'How hard the picture pushes in on big kills (the camera is not touched). 0 = off.',
    0.05,
  ),
  slider(
    'backdrop',
    'nebula',
    'strength',
    'Gas clouds',
    0,
    1,
    '',
    'Opacity of the gas-cloud layers. 0 = clear sky.',
    0.02,
  ),
  slider(
    'backdrop',
    'nebula',
    'scale',
    'Cloud size',
    300,
    6000,
    'u',
    'Size of the cloud features in world units. Higher = bigger, calmer clouds.',
    50,
  ),
  slider(
    'backdrop',
    'nebula',
    'drift',
    'Cloud drift',
    0,
    200,
    'u/s',
    'How fast the gas drifts. 0 = still.',
    1,
  ),
  slider(
    'backdrop',
    'stars',
    'twinkle',
    'Star twinkle',
    0,
    1,
    '',
    'How much the extra star layers twinkle.',
    0.05,
  ),
  slider(
    'backdrop',
    'debris',
    'count',
    'Drifting rocks',
    0,
    64,
    'rocks',
    'How many rocks and wrecks drift in the mid-distance (the quality level caps it).',
    1,
  ),
  slider(
    'backdrop',
    'flashes',
    'rate',
    'Distant flashes',
    0,
    8,
    '/s',
    'Battle flashes per second far away (more when the fight is busy).',
    0.1,
  ),
];

/** The object a slider edits inside a spectacle, or null when the pack lacks that section. */
export function sliderTarget(
  spec: SpectacleDef,
  s: SpectacleSlider,
): Record<string, unknown> | null {
  const root = spec[s.section] as unknown as Record<string, unknown> | undefined;
  if (!root) return null;
  let at: unknown = root;
  for (const part of s.path ? s.path.split('.') : []) {
    at = (at as Record<string, unknown>)[part];
    if (typeof at !== 'object' || at === null) return null;
  }
  return typeof (at as Record<string, unknown>)[s.key] === 'number'
    ? (at as Record<string, unknown>)
    : null;
}

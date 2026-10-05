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

/**
 * The presentation settings of the spectacle layer: one switch per effect and one intensity per
 * motion effect, plus the named presets (`full`, `calm`, `overdrive`, `off`). Presentation only: nothing
 * here is read by `src/core`, none of it is in the replay hash, and every effect can be turned off.
 */

/** Intensities run 0 (off) to `MAX_INTENSITY` (overdrive); 1 is the designed look. */
export const MAX_INTENSITY = 1.5;
/** The HUD size range (a scale, not an intensity). */
export const MIN_HUD_SCALE = 0.4;
export const MAX_HUD_SCALE = 1.2;
/** The default HUD size: compact, so the interface leaves the fight visible. */
export const DEFAULT_HUD_SCALE = 0.7;
/** The lock marker strength range and default (subdued: enemies must stay visible). */
export const MIN_MARKER_STRENGTH = 0.2;
export const MAX_MARKER_STRENGTH = 1.2;
export const DEFAULT_MARKER_STRENGTH = 0.4;

export interface SpectacleSettings {
  /** Master switch: off = the classic HUD and menus, no effects (the style pack's flag still has to be on). */
  enabled: boolean;
  // Layers (on/off).
  hud: boolean;
  menus: boolean;
  portraits: boolean;
  comms: boolean;
  banners: boolean;
  feed: boolean;
  combo: boolean;
  indicators: boolean;
  locks: boolean;
  // Intensities (0..MAX_INTENSITY).
  zoomPunch: number;
  roll: number;
  hitStop: number;
  killCam: number;
  shake: number;
  vignette: number;
  speedFlash: number;
  /** Size of the HUD panels (0.4 to 1.2; 1 is the full designed size). */
  hudScale: number;
  /** How strong the lock markers over enemies are (0.2 to 1.2; lower = thinner and fainter so the enemies stay visible). */
  markerStrength: number;
}

export const LAYER_KEYS = [
  'hud',
  'menus',
  'portraits',
  'comms',
  'banners',
  'feed',
  'combo',
  'indicators',
  'locks',
] as const satisfies readonly (keyof SpectacleSettings)[];
export type LayerKey = (typeof LAYER_KEYS)[number];

export const INTENSITY_KEYS = [
  'zoomPunch',
  'roll',
  'hitStop',
  'killCam',
  'shake',
  'vignette',
  'speedFlash',
] as const satisfies readonly (keyof SpectacleSettings)[];
export type IntensityKey = (typeof INTENSITY_KEYS)[number];

export const PRESET_NAMES = ['full', 'calm', 'overdrive', 'off'] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

const allLayers = (on: boolean): Record<LayerKey, boolean> => ({
  hud: on,
  menus: on,
  portraits: on,
  comms: on,
  banners: on,
  feed: on,
  combo: on,
  indicators: on,
  locks: on,
});

const intensities = (v: number): Record<IntensityKey, number> => ({
  zoomPunch: v,
  roll: v,
  hitStop: v,
  killCam: v,
  shake: v,
  vignette: v,
  speedFlash: v,
});

/** The presets. `calm` keeps the whole anime interface but almost none of the motion (for comfort). */
export const PRESETS: Record<PresetName, SpectacleSettings> = {
  full: {
    enabled: true,
    ...allLayers(true),
    ...intensities(1),
    hudScale: DEFAULT_HUD_SCALE,
    markerStrength: DEFAULT_MARKER_STRENGTH,
  },
  calm: {
    enabled: true,
    ...allLayers(true),
    zoomPunch: 0.15,
    roll: 0,
    hitStop: 0,
    killCam: 0,
    shake: 0.25,
    vignette: 0.5,
    speedFlash: 0,
    hudScale: 0.6,
    markerStrength: 0.3,
  },
  overdrive: {
    enabled: true,
    ...allLayers(true),
    ...intensities(MAX_INTENSITY),
    hudScale: 1,
    markerStrength: 1,
  },
  off: { enabled: false, ...allLayers(false), ...intensities(0), hudScale: 1, markerStrength: 1 },
};

export function isPresetName(s: string | null | undefined): s is PresetName {
  return !!s && (PRESET_NAMES as readonly string[]).includes(s);
}

/** Clamps every intensity into range and makes every flag a boolean (bad stored data cannot break the game). */
export function sanitize(
  input: Partial<SpectacleSettings>,
  base: SpectacleSettings,
): SpectacleSettings {
  const out: SpectacleSettings = { ...base };
  if (typeof input.enabled === 'boolean') out.enabled = input.enabled;
  for (const k of LAYER_KEYS) if (typeof input[k] === 'boolean') out[k] = input[k];
  for (const k of INTENSITY_KEYS) {
    const v = input[k];
    if (typeof v === 'number' && Number.isFinite(v))
      out[k] = Math.min(MAX_INTENSITY, Math.max(0, v));
  }
  const h = input.hudScale;
  if (typeof h === 'number' && Number.isFinite(h))
    out.hudScale = Math.min(MAX_HUD_SCALE, Math.max(MIN_HUD_SCALE, h));
  const m = input.markerStrength;
  if (typeof m === 'number' && Number.isFinite(m))
    out.markerStrength = Math.min(MAX_MARKER_STRENGTH, Math.max(MIN_MARKER_STRENGTH, m));
  return out;
}

/** Whether the settings equal a preset exactly (the panel shows `custom` otherwise). */
export function matchingPreset(s: SpectacleSettings): PresetName | 'custom' {
  for (const name of PRESET_NAMES) {
    const p = PRESETS[name];
    if (p.enabled !== s.enabled) continue;
    if (LAYER_KEYS.some((k) => p[k] !== s[k])) continue;
    if (INTENSITY_KEYS.some((k) => Math.abs(p[k] - s[k]) > 1e-6)) continue;
    if (Math.abs(p.hudScale - s.hudScale) > 1e-6) continue;
    if (Math.abs(p.markerStrength - s.markerStrength) > 1e-6) continue;
    return name;
  }
  return 'custom';
}

export const SETTINGS_STORAGE_KEY = 'starfighter.spectacle';

/** The live settings object: the views read it every frame, the panel edits it in place. */
export const spectacle: SpectacleSettings = { ...PRESETS.full };

export function applyPreset(name: PresetName): void {
  Object.assign(spectacle, PRESETS[name]);
}

/**
 * Picks the starting settings: a `?spectacle=` preset wins, then the remembered custom settings, then
 * the pack's preset. `stored` is the JSON text from localStorage (or null).
 */
export function initSettings(search: string, packPreset: PresetName, stored: string | null): void {
  const asked = new URLSearchParams(search).get('spectacle');
  if (isPresetName(asked)) {
    applyPreset(asked);
    return;
  }
  applyPreset(packPreset);
  if (stored === null) return;
  try {
    Object.assign(spectacle, sanitize(JSON.parse(stored) as Partial<SpectacleSettings>, spectacle));
  } catch {
    // Unreadable stored settings: keep the pack's preset.
  }
}

export function readStoredSettings(): string | null {
  try {
    return localStorage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeSettings(): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(spectacle));
  } catch {
    // Storage blocked: the panel still works for this session.
  }
}

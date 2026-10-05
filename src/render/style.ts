import type { GameEvent } from '../core/events/events';

/**
 * The style contract: everything a style pack (data/styles/<id>/) can provide. Pure types and
 * validation, no DOM and no three. Only `render` and `audio` read a style (through
 * `style-active.ts`); `src/core` never knows which one is active, so replays and the state hash
 * cannot depend on it.
 */

// Manifest --------------------------------------------------------------------------------

export const STYLE_STATUSES = ['idea', 'active', 'shelved'] as const;
export type StyleStatus = (typeof STYLE_STATUSES)[number];

export interface StyleReference {
  /** Title of the reference (anime, film, game). */
  title: string;
  /** What was taken from it. */
  took: string;
}

export interface StyleManifest {
  /** Folder name and `?style=` value: lowercase letters, digits and dashes. */
  id: string;
  name: string;
  /** One line: what this direction is going for. */
  intent: string;
  /** Style this one was forked from (its missing parts come from there), or null. */
  parent: string | null;
  references: readonly StyleReference[];
  status: StyleStatus;
  notes: string;
}

// Theme -----------------------------------------------------------------------------------

/** Flat colour per entity role (0xRRGGBB). */
export const PALETTE_KEYS = [
  'background',
  'friendly',
  'enemy',
  'enemyStatic',
  'turret',
  'projectile',
  'enemyShot',
  'fighter',
  'wingman',
  'missile',
  'lockRing',
  'pod',
  'star',
  'dust',
] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];
export type Palette = Record<PaletteKey, number>;

export interface Theme {
  palette: Palette;
  /** Reserved for the Look track. Outline width in world units (u); 0 = no outline. */
  outlineWidth: number;
  /** Reserved for the Look track. Outline colour (0xRRGGBB). */
  outlineColor: number;
  /** Reserved for the Look track. Share of a shape drawn in the hard shadow tone, 0..1. */
  shadowShare: number;
  /** Reserved for the Look track. Glow strength, 0..1. */
  glow: number;
}

/** A pack may give only some theme fields; the rest come from the fallback. */
export type ThemeInput = Partial<Omit<Theme, 'palette'>> & { palette?: Partial<Palette> };

const THEME_SCALARS = ['outlineWidth', 'outlineColor', 'shadowShare', 'glow'] as const;

// Ships, deaths, explosions (stubs: the Look track fills them) -----------------------------

export const SHIP_KINDS = ['player', 'wingman', 'fighter', 'drone', 'turret', 'pod'] as const;
export type ShipKind = (typeof SHIP_KINDS)[number];

type Point = readonly [number, number];

/** Shape of one ship kind, in local units (u), nose along +x. Closed polygon, implicit last edge. */
export interface ShapeDef {
  polygon: readonly Point[];
  /** One hard shadow polygon. */
  shadow?: readonly Point[];
  /** Engine glow points. */
  glow?: readonly Point[];
}
/** A kind without an entry is drawn by the renderer's built-in shape (today's look). */
export type ShipShapes = Partial<Record<ShipKind, ShapeDef>>;

/** How one ship kind dies. Stub: fields are added by the Look track. */
export interface DeathDef {
  pieces: number;
}
export type DeathDefs = Partial<Record<ShipKind, DeathDef>>;

export const EXPLOSION_KINDS = ['hitSpark', 'small', 'large', 'missile', 'heavy'] as const;
export type ExplosionKind = (typeof EXPLOSION_KINDS)[number];

/** One explosion kind. Stub: fields are added by the Look track. */
export interface ExplosionDef {
  /** World units (u). */
  size: number;
  /** Seconds (s). */
  duration: number;
}
export type ExplosionDefs = Partial<Record<ExplosionKind, ExplosionDef>>;

// Sounds ----------------------------------------------------------------------------------

/** Things sound can react to: every GameEvent type, plus app-level pause. */
export type SoundEventKey = GameEvent['type'] | 'Paused' | 'Resumed';

export const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle', 'noise'] as const;

export const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass'] as const;

/** One oscillator or noise burst of a synthesised sound, shaped by an envelope, a sweep and a filter. */
export interface SynthLayer {
  /** 'noise' ignores `freq` (colour it with the filter). */
  waveform: (typeof WAVEFORMS)[number];
  /** Start frequency, Hz. */
  freq: number;
  /** Frequency at the end of the sound, Hz (exponential sweep); omit for a steady tone. */
  freqEnd?: number;
  /** Start offset inside the sound, seconds (s). */
  delay?: number;
  /** Fade-in, seconds (s). */
  attack: number;
  /** Fade-out to silence after the attack, seconds (s). */
  decay: number;
  /** Layer loudness inside the sound, 0..1. */
  gain: number;
  filter?: {
    type: (typeof FILTER_TYPES)[number];
    /** Cutoff or centre, Hz. */
    freq: number;
    /** Cutoff at the end of the sound, Hz (exponential sweep); omit for a fixed one. */
    freqEnd?: number;
    /** Resonance (quality factor), 0.1..30. */
    q: number;
  };
}

export interface SoundEntry {
  /** A synthesised recipe (layers, edit them freely) or a sample file in the pack's assets/ or data/audio/. */
  source:
    | { kind: 'synth'; layers: readonly SynthLayer[] }
    | { kind: 'sample'; file: string; /** Length of the file, seconds (s). */ duration: number };
  /** Base pitch multiplier, 1 = as synthesised or recorded. */
  pitch: number;
  /** Random pitch spread, +/- fraction of the base pitch. */
  pitchRandom: number;
  /** 0..1. */
  volume: number;
  /** Minimum gap between two plays, seconds (s). */
  minGap: number;
  /** Most simultaneous voices of this sound. */
  maxVoices: number;
  /**
   * Stereo pan and distance fade from the event position relative to the player (events with a
   * position only; others play centred at full volume). Omit for a flat, centred sound.
   */
  spatial?: {
    /** 0..1: how far left/right the sound goes at `range` (1 = fully to one ear). */
    pan: number;
    /** Distance at which the sound is fully panned and as quiet as it gets, world units (u). */
    range: number;
    /** Volume multiplier at `range` and beyond, 0..1. */
    farVolume: number;
  };
  /** Killed only: bigger things sound deeper and louder (pitch x (ref / radius)^exponent). */
  size?: {
    /** Radius that plays at the base pitch, world units (u). */
    ref: number;
    /** 0..2: how strongly size bends the pitch (0 = not at all). */
    exponent: number;
  };
  /** Dips the music while this sound plays. */
  duck?: {
    /** 0..1: how much quieter the music gets. */
    amount: number;
    /** How long the dip lasts, seconds (s). */
    time: number;
  };
}

/** Every event has a sound or an explicit 'silent'. The compiler enforces completeness. */
export type SoundTable = Record<SoundEventKey, SoundEntry | 'silent'>;

/** Every sound event key. Typed as a complete record, so a new GameEvent fails to compile until listed. */
const SOUND_KEY_SET: Record<SoundEventKey, true> = {
  ShotFired: true,
  Hit: true,
  Killed: true,
  EvadeStarted: true,
  LockAcquiring: true,
  LockAcquired: true,
  LockLost: true,
  SalvoFired: true,
  MissileLaunched: true,
  OrderGiven: true,
  BattleStarted: true,
  WaveStarted: true,
  BattleCleared: true,
  RunEnded: true,
  PilotJoined: true,
  PilotLost: true,
  PilotKill: true,
  PodSpawned: true,
  PodRescued: true,
  PodLost: true,
  Paused: true,
  Resumed: true,
};
export const SOUND_EVENT_KEYS = Object.keys(SOUND_KEY_SET) as SoundEventKey[];

/** A table with every event 'silent'. */
export function silentSoundTable(): SoundTable {
  const table = {} as SoundTable;
  for (const key of SOUND_EVENT_KEYS) table[key] = 'silent';
  return table;
}

// Packs -----------------------------------------------------------------------------------

/** A fully resolved style: every part present. This is what render and audio read. */
export interface StylePack {
  manifest: StyleManifest;
  theme: Theme;
  ships: ShipShapes;
  deaths: DeathDefs;
  explosions: ExplosionDefs;
  sounds: SoundTable;
}

/** What a pack folder exports: a manifest and any parts it has. Missing parts fall back. */
export interface StyleInput {
  manifest: StyleManifest;
  theme?: ThemeInput;
  ships?: ShipShapes;
  deaths?: DeathDefs;
  explosions?: ExplosionDefs;
  sounds?: Partial<SoundTable>;
}

export type StyleRegistry = Readonly<Record<string, StyleInput>>;

// Validation ------------------------------------------------------------------------------

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isColor = (v: unknown): boolean =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffff;
const isNum = (v: unknown, min: number, max: number): boolean =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isText = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;
const isKind = (list: readonly string[], v: string): boolean => list.includes(v);

/** Largest allowed coordinate in a ship shape, local units (u). */
export const MAX_SHAPE_EXTENT = 200;

export function validateManifest(m: StyleManifest): string[] {
  const errors: string[] = [];
  if (!ID_RE.test(String(m.id))) errors.push(`manifest.id "${m.id}" must be lowercase-with-dashes`);
  if (!isText(m.name)) errors.push('manifest.name is empty');
  if (!isText(m.intent)) errors.push('manifest.intent is empty');
  if (m.parent !== null && !ID_RE.test(String(m.parent))) errors.push('manifest.parent is invalid');
  if (m.parent === m.id) errors.push('manifest.parent cannot be the style itself');
  if (!STYLE_STATUSES.includes(m.status)) errors.push(`manifest.status "${m.status}" is unknown`);
  if (typeof m.notes !== 'string') errors.push('manifest.notes must be a string');
  if (!Array.isArray(m.references)) errors.push('manifest.references must be a list');
  else
    m.references.forEach((r, i) => {
      if (!isText(r?.title) || !isText(r?.took))
        errors.push(`manifest.references[${i}] needs a title and what was taken`);
    });
  return errors;
}

export function validateTheme(t: ThemeInput): string[] {
  const errors: string[] = [];
  for (const [k, v] of Object.entries(t.palette ?? {})) {
    if (!isKind(PALETTE_KEYS, k)) errors.push(`theme.palette.${k} is unknown`);
    else if (!isColor(v)) errors.push(`theme.palette.${k} must be a colour 0..0xffffff`);
  }
  if (t.outlineWidth !== undefined && !isNum(t.outlineWidth, 0, 20))
    errors.push('theme.outlineWidth must be 0..20 u');
  if (t.outlineColor !== undefined && !isColor(t.outlineColor))
    errors.push('theme.outlineColor must be a colour 0..0xffffff');
  if (t.shadowShare !== undefined && !isNum(t.shadowShare, 0, 1))
    errors.push('theme.shadowShare must be 0..1');
  if (t.glow !== undefined && !isNum(t.glow, 0, 1)) errors.push('theme.glow must be 0..1');
  return errors;
}

function validatePolygon(name: string, p: readonly Point[] | undefined, min: number): string[] {
  if (!Array.isArray(p) || p.length < min) return [`${name} needs at least ${min} points`];
  const errors: string[] = [];
  const limit = MAX_SHAPE_EXTENT;
  p.forEach((pt, i) => {
    if (!Array.isArray(pt) || !isNum(pt[0], -limit, limit) || !isNum(pt[1], -limit, limit))
      errors.push(`${name}[${i}] must be two numbers within +/-${limit} u`);
  });
  const first = p[0];
  const last = p[p.length - 1];
  if (min > 1 && first && last && first[0] === last[0] && first[1] === last[1])
    errors.push(`${name} must not repeat its first point (it is closed implicitly)`);
  return errors;
}

export function validateShips(ships: ShipShapes): string[] {
  const errors: string[] = [];
  for (const [kind, def] of Object.entries(ships)) {
    if (!isKind(SHIP_KINDS, kind)) {
      errors.push(`ships.${kind} is not a ship kind`);
      continue;
    }
    errors.push(...validatePolygon(`ships.${kind}.polygon`, def.polygon, 3));
    if (def.shadow) errors.push(...validatePolygon(`ships.${kind}.shadow`, def.shadow, 3));
    if (def.glow) errors.push(...validatePolygon(`ships.${kind}.glow`, def.glow, 1));
  }
  return errors;
}

export function validateDeaths(deaths: DeathDefs): string[] {
  const errors: string[] = [];
  for (const [kind, def] of Object.entries(deaths)) {
    if (!isKind(SHIP_KINDS, kind)) errors.push(`deaths.${kind} is not a ship kind`);
    else if (!isNum(def.pieces, 1, 64)) errors.push(`deaths.${kind}.pieces must be 1..64`);
  }
  return errors;
}

export function validateExplosions(explosions: ExplosionDefs): string[] {
  const errors: string[] = [];
  for (const [kind, def] of Object.entries(explosions)) {
    if (!isKind(EXPLOSION_KINDS, kind)) {
      errors.push(`explosions.${kind} is not an explosion kind`);
      continue;
    }
    if (!isNum(def.size, 0.1, 10000)) errors.push(`explosions.${kind}.size must be 0.1..10000 u`);
    if (!isNum(def.duration, 0.01, 30))
      errors.push(`explosions.${kind}.duration must be 0.01..30 s`);
  }
  return errors;
}

function validateLayer(where: string, l: SynthLayer): string[] {
  const errors: string[] = [];
  if (!l || typeof l !== 'object') return [`${where} must be a layer`];
  if (!isKind(WAVEFORMS, l.waveform)) errors.push(`${where}.waveform is unknown`);
  if (!isNum(l.freq, 10, 20000)) errors.push(`${where}.freq must be 10..20000 Hz`);
  if (l.freqEnd !== undefined && !isNum(l.freqEnd, 10, 20000))
    errors.push(`${where}.freqEnd must be 10..20000 Hz`);
  if (l.delay !== undefined && !isNum(l.delay, 0, 10))
    errors.push(`${where}.delay must be 0..10 s`);
  if (!isNum(l.attack, 0.001, 10)) errors.push(`${where}.attack must be 0.001..10 s`);
  if (!isNum(l.decay, 0.005, 10)) errors.push(`${where}.decay must be 0.005..10 s`);
  if (!isNum(l.gain, 0, 1)) errors.push(`${where}.gain must be 0..1`);
  if (l.filter !== undefined) {
    if (!isKind(FILTER_TYPES, l.filter.type)) errors.push(`${where}.filter.type is unknown`);
    if (!isNum(l.filter.freq, 10, 20000)) errors.push(`${where}.filter.freq must be 10..20000 Hz`);
    if (l.filter.freqEnd !== undefined && !isNum(l.filter.freqEnd, 10, 20000))
      errors.push(`${where}.filter.freqEnd must be 10..20000 Hz`);
    if (!isNum(l.filter.q, 0.1, 30)) errors.push(`${where}.filter.q must be 0.1..30`);
  }
  return errors;
}

export function validateSounds(sounds: Partial<SoundTable>): string[] {
  const errors: string[] = [];
  for (const [key, entry] of Object.entries(sounds)) {
    if (!isKind(SOUND_EVENT_KEYS, key)) {
      errors.push(`sounds.${key} is not an event`);
      continue;
    }
    if (entry === 'silent') continue;
    const e = entry as SoundEntry | undefined;
    if (!e || typeof e !== 'object') {
      errors.push(`sounds.${key} must be a sound or 'silent'`);
      continue;
    }
    if (e.source?.kind === 'sample') {
      if (!isText(e.source.file)) errors.push(`sounds.${key}.source.file is empty`);
      if (!isNum(e.source.duration, 0.01, 30))
        errors.push(`sounds.${key}.source.duration must be 0.01..30 s`);
    } else if (e.source?.kind === 'synth') {
      const layers = e.source.layers;
      if (!Array.isArray(layers) || layers.length < 1 || layers.length > 8)
        errors.push(`sounds.${key}.source.layers must be 1..8 layers`);
      else layers.forEach((l, i) => errors.push(...validateLayer(`sounds.${key}.layers[${i}]`, l)));
    } else errors.push(`sounds.${key}.source must be synth or sample`);
    if (!isNum(e.pitch, 0.1, 10)) errors.push(`sounds.${key}.pitch must be 0.1..10`);
    if (!isNum(e.pitchRandom, 0, 1)) errors.push(`sounds.${key}.pitchRandom must be 0..1`);
    if (!isNum(e.volume, 0, 1)) errors.push(`sounds.${key}.volume must be 0..1`);
    if (!isNum(e.minGap, 0, 10)) errors.push(`sounds.${key}.minGap must be 0..10 s`);
    if (!isNum(e.maxVoices, 1, 32) || !Number.isInteger(e.maxVoices))
      errors.push(`sounds.${key}.maxVoices must be an integer 1..32`);
    if (e.spatial !== undefined) {
      if (!isNum(e.spatial.pan, 0, 1)) errors.push(`sounds.${key}.spatial.pan must be 0..1`);
      if (!isNum(e.spatial.range, 1, 100000))
        errors.push(`sounds.${key}.spatial.range must be 1..100000 u`);
      if (!isNum(e.spatial.farVolume, 0, 1))
        errors.push(`sounds.${key}.spatial.farVolume must be 0..1`);
    }
    if (e.size !== undefined) {
      if (!isNum(e.size.ref, 1, 10000)) errors.push(`sounds.${key}.size.ref must be 1..10000 u`);
      if (!isNum(e.size.exponent, 0, 2)) errors.push(`sounds.${key}.size.exponent must be 0..2`);
    }
    if (e.duck !== undefined) {
      if (!isNum(e.duck.amount, 0, 1)) errors.push(`sounds.${key}.duck.amount must be 0..1`);
      if (!isNum(e.duck.time, 0.01, 10)) errors.push(`sounds.${key}.duck.time must be 0.01..10 s`);
    }
  }
  return errors;
}

/**
 * The style checks for one pack: the manifest and every part it has validate. Missing parts are
 * not errors (they fall back, see `missingParts`); wrong ones are.
 */
export function checkStyle(input: StyleInput): string[] {
  return [
    ...validateManifest(input.manifest),
    ...validateTheme(input.theme ?? {}),
    ...validateShips(input.ships ?? {}),
    ...validateDeaths(input.deaths ?? {}),
    ...validateExplosions(input.explosions ?? {}),
    ...validateSounds(input.sounds ?? {}),
  ];
}

/** What a pack leaves to its fallback, in plain words. */
export function missingParts(input: StyleInput): string[] {
  const missing: string[] = [];
  const palette = input.theme?.palette ?? {};
  const noColours = PALETTE_KEYS.filter((k) => palette[k] === undefined);
  if (noColours.length) missing.push(`theme.palette: ${noColours.join(', ')}`);
  for (const k of THEME_SCALARS) if (input.theme?.[k] === undefined) missing.push(`theme.${k}`);
  const noShips = SHIP_KINDS.filter((k) => !input.ships?.[k]);
  if (noShips.length) missing.push(`ships: ${noShips.join(', ')}`);
  const noDeaths = SHIP_KINDS.filter((k) => !input.deaths?.[k]);
  if (noDeaths.length) missing.push(`deaths: ${noDeaths.join(', ')}`);
  const noExplosions = EXPLOSION_KINDS.filter((k) => !input.explosions?.[k]);
  if (noExplosions.length) missing.push(`explosions: ${noExplosions.join(', ')}`);
  const noSounds = SOUND_EVENT_KEYS.filter((k) => input.sounds?.[k] === undefined);
  if (noSounds.length) missing.push(`sounds: ${noSounds.join(', ')}`);
  return missing;
}

// Resolution ------------------------------------------------------------------------------

export interface ResolvedStyle {
  pack: StylePack;
  /** What fell back, or was invalid and fell back. The caller prints these to the console. */
  warnings: string[];
}

/**
 * Builds a complete pack: every part the input lacks (or has invalid) comes from `base` (its
 * parent, or `plain`). A part that is present and valid is used as is.
 */
export function resolveStyle(input: StyleInput, base: StylePack): ResolvedStyle {
  const warnings: string[] = [];
  const id = input.manifest.id;
  const valid = <T>(part: string, value: T | undefined, errors: (v: T) => string[]): Partial<T> => {
    if (value === undefined) return {};
    const list = errors(value);
    if (list.length === 0) return value;
    warnings.push(
      `style "${id}": ${part} is invalid (${list.join('; ')}), using ${base.manifest.id}`,
    );
    return {};
  };
  const theme = valid<ThemeInput>('theme', input.theme, validateTheme);
  const pack: StylePack = {
    manifest: input.manifest,
    theme: { ...base.theme, ...theme, palette: { ...base.theme.palette, ...theme.palette } },
    ships: { ...base.ships, ...valid('ships', input.ships, validateShips) },
    deaths: { ...base.deaths, ...valid('deaths', input.deaths, validateDeaths) },
    explosions: {
      ...base.explosions,
      ...valid('explosions', input.explosions, validateExplosions),
    },
    sounds: { ...base.sounds, ...valid('sounds', input.sounds, validateSounds) },
  };
  if (id !== base.manifest.id) {
    const missing = missingParts(input);
    if (missing.length)
      warnings.push(`style "${id}" falls back to ${base.manifest.id} for ${missing.join(' | ')}`);
  }
  return { pack, warnings };
}

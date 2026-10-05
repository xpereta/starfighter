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
  /** Outline width in world units (u), drawn outside the silhouette; 0 = no outline. */
  outlineWidth: number;
  /** Outline colour (0xRRGGBB). */
  outlineColor: number;
  /** How much of each ship's authored shadow shape is shown (the terminator slides across it), 0..1; 0 = no shadow. */
  shadowShare: number;
  /** Engine glow strength, 0..1; 0 = no glow. */
  glow: number;
  /** Colour of the sensor eye / cockpit / core detail of a ship (0xRRGGBB). */
  eyeColor: number;
  /** Speed lines at high speed, strength 0..1; 0 = off. */
  speedLines: number;
}

/** A pack may give only some theme fields; the rest come from the fallback. */
export type ThemeInput = Partial<Omit<Theme, 'palette'>> & { palette?: Partial<Palette> };

export const THEME_SCALARS = [
  'outlineWidth',
  'outlineColor',
  'shadowShare',
  'glow',
  'eyeColor',
  'speedLines',
] as const;

// Ships, deaths, explosions (stubs: the Look track fills them) -----------------------------

export const SHIP_KINDS = [
  'player',
  'wingman',
  'fighter',
  'drone',
  'turret',
  'pod',
  'static',
] as const;
export type ShipKind = (typeof SHIP_KINDS)[number];

export type Point = readonly [number, number];

/**
 * Shape of one ship kind. Coordinates are in units of the ship's radius (1 = its hit radius; the
 * renderer scales by the real radius), nose along +x, wings along y. Polygons are closed
 * implicitly (the last edge is not repeated).
 */
export interface ShapeDef {
  polygon: readonly Point[];
  /** A hole in the silhouette (the background shows through), e.g. the ring of a pod. */
  hole?: readonly Point[];
  /** One hard shadow polygon, inside the silhouette (the share of it shown is `theme.shadowShare`). */
  shadow?: readonly Point[];
  /** The bright detail: a sensor eye, a cockpit, a core (drawn in `theme.eyeColor`). */
  eye?: readonly Point[];
  /** Engine glow points (where the flame starts), drawn with `theme.glow`. */
  glow?: readonly Point[];
}
/** Every kind has a shape: a pack that lacks one falls back to its parent or `plain`. */
export type ShipShapes = Partial<Record<ShipKind, ShapeDef>>;

/** A min..max range, picked uniformly by the seeded roll. */
export type Range = readonly [min: number, max: number];

export const EXPLOSION_KINDS = ['hitSpark', 'small', 'large', 'missile', 'heavy'] as const;
export type ExplosionKind = (typeof EXPLOSION_KINDS)[number];

/**
 * One explosion kind: flat, hard-edged shapes drawn from a colour ramp. Used by death sequences
 * and by events with no ship (hit sparks, missile hits).
 */
export interface ExplosionDef {
  /** Peak radius of the blast when no ship sets it, world units (u). */
  size: number;
  /** How long it lasts, seconds (s). */
  duration: number;
  /** Colours from the hot core out to the smoke (2 to 4 entries, 0xRRGGBB). */
  ramp: readonly number[];
  /** Concentric flat discs in the body, 1..3 (inner ones shrink first). */
  layers: number;
  /** Shockwave ring strength, 0..1 (0 = no ring). */
  ring: number;
  /** Hard-edged smoke puffs around the blast, 0..8. */
  puffs: number;
  /** Starburst spikes, 0..16 (0 = none). */
  spikes: number;
  /** Cross flare strength, 0..1 (0 = none). */
  cross: number;
  /** Frames of full-screen flash (at 60 per second) when this blast is the primary or last of a death, 0..8 (0 = none). */
  flashFrames: number;
}
export type ExplosionDefs = Partial<Record<ExplosionKind, ExplosionDef>>;

/** A group of delayed explosions in a death sequence. */
export interface SecondaryDef {
  kind: ExplosionKind;
  /** How many go off, a whole number. */
  count: Range;
  /** Blast size in ship radii. */
  size: Range;
  /** Seconds after the death. */
  delay: Range;
  /** On a flying piece, or on the wreck (the spot where the ship died). */
  attach: 'piece' | 'wreck';
  /** Chance 0..1 that a blast on a piece destroys it (else it keeps drifting as debris). */
  consume: number;
  /** Chance 0..1 that the blast kicks a neighbouring piece into an early blast of its own. */
  chain: number;
}

/** What the pieces of a broken ship do. */
export interface DebrisDef {
  /** How long a piece lingers, seconds (s). */
  life: Range;
  /** Drift speed away from the centre, u/s. */
  drift: Range;
  /** Largest spin, rad/s. */
  spin: number;
  /** Share of its life a piece spends fading out, 0..1. */
  fade: number;
  /** Smoke puffs per second each piece trails, 0 = none. */
  trail: number;
}

/**
 * How one ship kind dies (see the spec, section 4). The sequence is rolled per death from this
 * definition with its own seeded stream, so every death differs and replays repeat.
 */
export interface DeathDef {
  /** How many pieces the silhouette is cut into along seeded fracture lines. */
  pieces: Range;
  /** The first blast; `size` in ship radii. */
  primary: { kind: ExplosionKind; size: number };
  /** Delayed blasts (secondary explosions). */
  secondary: readonly SecondaryDef[];
  debris: DebrisDef;
  /** How much the direction of the killing blow shapes the break-up, 0..1. */
  blow: number;
  /** Share 0..1 of the ship's own velocity the pieces keep. */
  momentum: number;
  /** An optional last big blast, `size` in ship radii, `delay` seconds after the death. */
  finalBlast?: { kind: ExplosionKind; size: number; delay: number };
  /** Drawing-only freeze when the ship dies, seconds (s); 0 = none. */
  hitStop: number;
}
export type DeathDefs = Partial<Record<ShipKind, DeathDef>>;

// Sounds ----------------------------------------------------------------------------------

/** Things sound can react to: every GameEvent type, plus app-level pause. */
export type SoundEventKey = GameEvent['type'] | 'Paused' | 'Resumed';

export const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle', 'noise'] as const;

export interface SoundEntry {
  /** Synthesised recipe (waveform; the audio track adds envelope and sweep) or a sample file under data/audio/. */
  source:
    { kind: 'synth'; waveform: (typeof WAVEFORMS)[number] } | { kind: 'sample'; file: string };
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

/** Largest allowed coordinate in a ship shape, in radius units (a shape stays near its hit circle). */
export const MAX_SHAPE_EXTENT = 4;

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
  if (t.speedLines !== undefined && !isNum(t.speedLines, 0, 1))
    errors.push('theme.speedLines must be 0..1');
  if (t.eyeColor !== undefined && !isColor(t.eyeColor))
    errors.push('theme.eyeColor must be a colour 0..0xffffff');
  return errors;
}

/** Smallest area a closed shape may have (radius units squared), so it is never a line. */
export const MIN_SHAPE_AREA = 1e-4;

/** Absolute area of a polygon (shoelace). */
export function polygonArea(p: readonly Point[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i]!;
    const [x2, y2] = p[(i + 1) % p.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function validatePolygon(name: string, p: readonly Point[] | undefined, min: number): string[] {
  if (!Array.isArray(p) || p.length < min) return [`${name} needs at least ${min} points`];
  const errors: string[] = [];
  const limit = MAX_SHAPE_EXTENT;
  p.forEach((pt, i) => {
    if (!Array.isArray(pt) || !isNum(pt[0], -limit, limit) || !isNum(pt[1], -limit, limit))
      errors.push(`${name}[${i}] must be two numbers within +/-${limit} radii`);
  });
  if (errors.length === 0 && min > 2 && polygonArea(p) < MIN_SHAPE_AREA)
    errors.push(`${name} is degenerate (no area)`);
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
    if (def.hole) errors.push(...validatePolygon(`ships.${kind}.hole`, def.hole, 3));
    if (def.shadow) errors.push(...validatePolygon(`ships.${kind}.shadow`, def.shadow, 3));
    if (def.eye) errors.push(...validatePolygon(`ships.${kind}.eye`, def.eye, 3));
    if (def.glow) errors.push(...validatePolygon(`ships.${kind}.glow`, def.glow, 1));
  }
  return errors;
}

/** Hard limits that keep a death sequence bounded (the quality presets cap it further). */
export const MAX_PIECES = 24;
export const MAX_SECONDARY_BLASTS = 24;
export const MAX_DEATH_SECONDS = 8;

const isRange = (v: unknown, min: number, max: number, whole = false): boolean =>
  Array.isArray(v) &&
  v.length === 2 &&
  isNum(v[0], min, max) &&
  isNum(v[1], min, max) &&
  (v[0] as number) <= (v[1] as number) &&
  (!whole || (Number.isInteger(v[0]) && Number.isInteger(v[1])));

export function validateDeaths(deaths: DeathDefs): string[] {
  const errors: string[] = [];
  for (const [kind, def] of Object.entries(deaths)) {
    const at = `deaths.${kind}`;
    if (!isKind(SHIP_KINDS, kind)) {
      errors.push(`${at} is not a ship kind`);
      continue;
    }
    if (!isRange(def.pieces, 1, MAX_PIECES, true))
      errors.push(`${at}.pieces must be a whole range min..max within 1..${MAX_PIECES}`);
    if (!isKind(EXPLOSION_KINDS, String(def.primary?.kind)))
      errors.push(`${at}.primary.kind is not an explosion kind`);
    if (!isNum(def.primary?.size, 0.1, 20)) errors.push(`${at}.primary.size must be 0.1..20 radii`);
    if (!Array.isArray(def.secondary) || def.secondary.length > 8)
      errors.push(`${at}.secondary must be a list of at most 8 groups`);
    else {
      let most = 0;
      def.secondary.forEach((s, i) => {
        const sa = `${at}.secondary[${i}]`;
        if (!isKind(EXPLOSION_KINDS, String(s.kind))) errors.push(`${sa}.kind is unknown`);
        if (!isRange(s.count, 0, MAX_SECONDARY_BLASTS, true))
          errors.push(`${sa}.count must be a whole range within 0..${MAX_SECONDARY_BLASTS}`);
        if (!isRange(s.size, 0.05, 20)) errors.push(`${sa}.size must be a range within 0.05..20`);
        if (!isRange(s.delay, 0, MAX_DEATH_SECONDS))
          errors.push(`${sa}.delay must be a range within 0..${MAX_DEATH_SECONDS} s`);
        if (s.attach !== 'piece' && s.attach !== 'wreck')
          errors.push(`${sa}.attach must be 'piece' or 'wreck'`);
        if (!isNum(s.consume, 0, 1)) errors.push(`${sa}.consume must be 0..1`);
        if (!isNum(s.chain, 0, 1)) errors.push(`${sa}.chain must be 0..1`);
        if (isRange(s.count, 0, MAX_SECONDARY_BLASTS)) most += s.count[1];
      });
      if (most > MAX_SECONDARY_BLASTS)
        errors.push(`${at}.secondary has more than ${MAX_SECONDARY_BLASTS} blasts in total`);
    }
    const d = def.debris;
    if (!d) errors.push(`${at}.debris is missing`);
    else {
      if (!isRange(d.life, 0.1, MAX_DEATH_SECONDS))
        errors.push(`${at}.debris.life must be a range within 0.1..${MAX_DEATH_SECONDS} s`);
      if (!isRange(d.drift, 0, 2000)) errors.push(`${at}.debris.drift must be within 0..2000 u/s`);
      if (!isNum(d.spin, 0, 30)) errors.push(`${at}.debris.spin must be 0..30 rad/s`);
      if (!isNum(d.fade, 0, 1)) errors.push(`${at}.debris.fade must be 0..1`);
      if (!isNum(d.trail, 0, 30)) errors.push(`${at}.debris.trail must be 0..30 per second`);
    }
    if (!isNum(def.blow, 0, 1)) errors.push(`${at}.blow must be 0..1`);
    if (!isNum(def.momentum, 0, 1)) errors.push(`${at}.momentum must be 0..1`);
    if (def.finalBlast) {
      const f = def.finalBlast;
      if (!isKind(EXPLOSION_KINDS, String(f.kind))) errors.push(`${at}.finalBlast.kind is unknown`);
      if (!isNum(f.size, 0.1, 20)) errors.push(`${at}.finalBlast.size must be 0.1..20 radii`);
      if (!isNum(f.delay, 0, MAX_DEATH_SECONDS))
        errors.push(`${at}.finalBlast.delay must be 0..${MAX_DEATH_SECONDS} s`);
    }
    if (!isNum(def.hitStop, 0, 0.5)) errors.push(`${at}.hitStop must be 0..0.5 s`);
  }
  return errors;
}

export function validateExplosions(explosions: ExplosionDefs): string[] {
  const errors: string[] = [];
  for (const [kind, def] of Object.entries(explosions)) {
    const at = `explosions.${kind}`;
    if (!isKind(EXPLOSION_KINDS, kind)) {
      errors.push(`${at} is not an explosion kind`);
      continue;
    }
    if (!isNum(def.size, 0.1, 10000)) errors.push(`${at}.size must be 0.1..10000 u`);
    if (!isNum(def.duration, 0.01, 30)) errors.push(`${at}.duration must be 0.01..30 s`);
    if (!Array.isArray(def.ramp) || def.ramp.length < 2 || def.ramp.length > 4)
      errors.push(`${at}.ramp must have 2 to 4 colours`);
    else if (!def.ramp.every(isColor)) errors.push(`${at}.ramp colours must be 0..0xffffff`);
    if (!isNum(def.layers, 1, 3) || !Number.isInteger(def.layers))
      errors.push(`${at}.layers must be a whole number 1..3`);
    if (!isNum(def.ring, 0, 1)) errors.push(`${at}.ring must be 0..1`);
    if (!isNum(def.puffs, 0, 8) || !Number.isInteger(def.puffs))
      errors.push(`${at}.puffs must be a whole number 0..8`);
    if (!isNum(def.spikes, 0, 16) || !Number.isInteger(def.spikes))
      errors.push(`${at}.spikes must be a whole number 0..16`);
    if (!isNum(def.cross, 0, 1)) errors.push(`${at}.cross must be 0..1`);
    if (!isNum(def.flashFrames, 0, 8) || !Number.isInteger(def.flashFrames))
      errors.push(`${at}.flashFrames must be a whole number 0..8`);
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
    } else if (e.source?.kind === 'synth') {
      if (!isKind(WAVEFORMS, e.source.waveform))
        errors.push(`sounds.${key}.source.waveform is unknown`);
    } else errors.push(`sounds.${key}.source must be synth or sample`);
    if (!isNum(e.pitch, 0.1, 10)) errors.push(`sounds.${key}.pitch must be 0.1..10`);
    if (!isNum(e.pitchRandom, 0, 1)) errors.push(`sounds.${key}.pitchRandom must be 0..1`);
    if (!isNum(e.volume, 0, 1)) errors.push(`sounds.${key}.volume must be 0..1`);
    if (!isNum(e.minGap, 0, 10)) errors.push(`sounds.${key}.minGap must be 0..10 s`);
    if (!isNum(e.maxVoices, 1, 32) || !Number.isInteger(e.maxVoices))
      errors.push(`sounds.${key}.maxVoices must be an integer 1..32`);
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

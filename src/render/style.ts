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
  /** Colours and tones of layered ship parts (see `ShapePart`). Optional: missing fields use `DEFAULT_PART_COLORS`. */
  partColors?: Partial<PartColors>;
  /** The deep background behind the stars: soft glows, a planet, grain. Optional: none = plain stars on the background colour. */
  backdrop?: BackdropDef;
}

/** How the roles of a layered ship part are coloured (the `hull` role is the ship's faction colour). */
export interface PartColors {
  /** `panel` role: the hull colour times this, 0.05..1.6 (above 1 = lighter). */
  panelTone: number;
  /** `dark` role: the hull colour times this, 0..1. */
  darkTone: number;
  /** `accent` role: stripes and markings (0xRRGGBB). */
  accent: number;
  /** `glass` role: canopies and sensor windows (0xRRGGBB). */
  glass: number;
  /** `glow` role: lights and hot metal, drawn bright (0xRRGGBB). */
  glow: number;
}

/** What a theme that gives no `partColors` gets. */
export const DEFAULT_PART_COLORS: PartColors = {
  panelTone: 0.8,
  darkTone: 0.4,
  accent: 0xffd23f,
  glass: 0xfff4b0,
  glow: 0xffffff,
};

/**
 * A soft glow or a lit sphere in the deep background. Positions and sizes are fractions of the
 * visible area, so the backdrop looks the same at every zoom: `x`, `y` in -1..1 (the screen edges),
 * `radius` as a share of the view width.
 */
export interface BackdropGlow {
  x: number;
  y: number;
  radius: number;
  color: number;
  /** Opacity at the centre, 0..1. */
  strength: number;
  /** 0 = a soft glow fading out from the centre; towards 1 = a solid disc (a planet) with a thin soft rim. */
  hardness: number;
  /** Planets: how dark the side away from the light is, 0..1 (0 = flat). */
  shade: number;
  /** Direction the light comes from, degrees (0 = from the right, 90 = from above). */
  lightAngle: number;
  /** How much it slides against the camera, 0..0.2 (0 = fixed on screen, far away). */
  drift: number;
}

export interface BackdropDef {
  /** Behind the stars, far to near, at most `MAX_BACKDROP_GLOWS`. */
  glows: readonly BackdropGlow[];
  /** A fine speckle over the whole view (film grain, dust haze); omit for none. */
  grain?: { count: number; size: number; color: number; opacity: number };
}

export const MAX_BACKDROP_GLOWS = 6;
export const MAX_BACKDROP_GRAIN = 3000;

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

/**
 * Optional shape slots. `wingmanB` and `wingmanC` are liveries of the wingman: the second and third
 * wingman of the squadron use them when a pack gives them (else the plain `wingman` shape), so they
 * should keep the wingman's outer silhouette (deaths are cut from `wingman`). The rest are the kinds
 * that arrive with Prototype 5 (see specs/prototype-5-enemy-variety.md) and the parts of the capital
 * ship: a pack may give shapes and deaths for them; no pack has to, and the game does not draw them
 * until the enemy tracks do.
 */
export const EXTRA_SHAPE_KINDS = [
  'wingmanB',
  'wingmanC',
  'gunship',
  'lancer',
  'capital',
  'capitalTurret',
  'capitalEngine',
  'capitalPlate',
  'capitalBridge',
  'capitalCore',
] as const;
export type ExtraShapeKind = (typeof EXTRA_SHAPE_KINDS)[number];

/** Every id a pack may give a shape or a death sequence for. */
export const SHAPE_KINDS = [...SHIP_KINDS, ...EXTRA_SHAPE_KINDS] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** The shape a variant slot falls back to when a pack does not give it. */
export const SHAPE_FALLBACK: Partial<Record<ShapeKind, ShapeKind>> = {
  wingmanB: 'wingman',
  wingmanC: 'wingman',
};

export type Point = readonly [number, number];

/**
 * Shape of one ship kind. Coordinates are in units of the ship's radius (1 = its hit radius; the
 * renderer scales by the real radius), nose along +x, wings along y. Polygons are closed
 * implicitly (the last edge is not repeated).
 */
export interface ShapeDef {
  /** The outer silhouette: the outline, the base fill and the fracture lines of a death follow it. */
  polygon: readonly Point[];
  /** A hole in the silhouette (the background shows through), e.g. the ring of a pod. */
  hole?: readonly Point[];
  /** One hard shadow polygon, inside the silhouette (the share of it shown is `theme.shadowShare`). */
  shadow?: readonly Point[];
  /** The bright detail: a sensor eye, a cockpit, a core (drawn in `theme.eyeColor`). */
  eye?: readonly Point[];
  /** Engine glow points (where the flame starts), drawn with `theme.glow`. */
  glow?: readonly Point[];
  /**
   * Layered detail on top of the silhouette, drawn in order (later parts over earlier ones): hull
   * plates, panel lines, greebles, canopy, nacelles, flaps, hardpoints, damage scars. Optional: a
   * shape without parts is drawn exactly as before. See `ShapePart` and `MAX_SHAPE_TRIANGLES`.
   */
  parts?: readonly ShapePart[];
}

/** What a part is (it decides only the budget and the checks; the role decides the colour). */
export const PART_KINDS = [
  'hull',
  'panel',
  'greeble',
  'canopy',
  'nacelle',
  'flap',
  'hardpoint',
  'scar',
  'line',
] as const;
export type PartKind = (typeof PART_KINDS)[number];

/** Which colour a part takes: `hull` is the faction colour, the rest come from `theme.partColors`. */
export const PART_ROLES = ['hull', 'panel', 'dark', 'accent', 'glass', 'glow'] as const;
export type PartRole = (typeof PART_ROLES)[number];

/** One layered part of a ship, in the same radius units as the silhouette. */
export interface ShapePart {
  kind: PartKind;
  role: PartRole;
  /** A polygon (3 or more points, closed implicitly), or for kind `line` a polyline (2 or more points). */
  points: readonly Point[];
  /** Line width in radius units, 0.002..0.3 (kind `line` only; default 0.02). */
  width?: number;
  /** Also draw the mirror image across the ship's long axis (y becomes -y): half the data for a symmetric ship. */
  mirror?: boolean;
  /** An exact colour instead of the role's (0xRRGGBB), e.g. a faction stripe or soot. */
  color?: number;
}

/** Most parts in one shape (a mirrored part counts as one), and most points in one part. */
export const MAX_SHAPE_PARTS = 96;
export const MAX_PART_POINTS = 16;
/** Complexity budget per shape in triangles (fill, outline, parts, shadow, glow, all counted). The capital ship may be far bigger than a fighter. */
export const MAX_SHAPE_TRIANGLES = 900;
export const MAX_CAPITAL_TRIANGLES = 4000;
/** Triangles of one engine glow point (core plus halo discs). */
export const GLOW_POINT_TRIANGLES = 24;

/** Shape kinds that get the larger triangle budget. */
export const BIG_SHAPE_KINDS: readonly ShapeKind[] = ['capital'];

/** The triangles one part costs, counting its mirror image. */
export function partTriangles(part: ShapePart): number {
  const n = part.points.length;
  const one = part.kind === 'line' ? 2 * Math.max(0, n - 1) : Math.max(0, n - 2);
  return part.mirror ? one * 2 : one;
}

/** A shape's triangle count: what drawing it once costs (fill, outline stroke, shadow, eye, glow, parts). */
export function shapeTriangles(def: ShapeDef): number {
  let t = Math.max(0, def.polygon.length - 2) + 2 * def.polygon.length;
  if (def.hole) t += 2 * def.hole.length;
  if (def.shadow) t += Math.max(0, def.shadow.length - 2);
  if (def.eye) t += Math.max(0, def.eye.length - 2);
  if (def.glow) t += def.glow.length * GLOW_POINT_TRIANGLES;
  for (const p of def.parts ?? []) t += partTriangles(p);
  return t;
}

/** The core kinds have a shape in every resolved pack (a pack that lacks one falls back to its parent or `plain`); the extra kinds are optional. */
export type ShipShapes = Partial<Record<ShapeKind, ShapeDef>>;

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
export type DeathDefs = Partial<Record<ShapeKind, DeathDef>>;

// Sounds ----------------------------------------------------------------------------------

/** Things sound can react to: every GameEvent type, plus app-level pause. */
export type SoundEventKey = GameEvent['type'] | 'Paused' | 'Resumed';

/** `noise` is white; `pink` is softer (rain, wind, air) and `brown` deeper (rumble, thrust). */
export const WAVEFORMS = [
  'sine',
  'square',
  'sawtooth',
  'triangle',
  'noise',
  'pink',
  'brown',
] as const;

/** The waveforms that are noise (they ignore `freq`; colour them with the filter). */
export const NOISE_WAVEFORMS: readonly (typeof WAVEFORMS)[number][] = ['noise', 'pink', 'brown'];

export const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass'] as const;

/** One oscillator or noise burst of a synthesised sound, shaped by an envelope, a sweep and a filter. */
export interface SynthLayer {
  /** Noise kinds ignore `freq` (colour them with the filter). */
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
  /** Seconds the layer stays at full loudness after the attack, before it decays (s); default 0. Long tails and held tones. */
  hold?: number;
  /** Oscillators only: fine pitch offset in cents (100 = a semitone), -1200..1200. Two layers a few cents apart sound thick. */
  detune?: number;
  /** Waveshaper drive 0..1: 0 = clean, 1 = heavily clipped. Adds grit and body to thumps, engines and impacts. */
  distortion?: number;
  /** Wobbles the loudness: `rate` Hz, `depth` 0..1 (1 = down to silence). Rattles, flutter, beating. */
  tremolo?: { rate: number; depth: number };
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
    /** Low-pass cutoff (Hz) for a sound at the listener (`near`) and at `range` or beyond (`far`): distance muffles. Omit for no filtering. */
    lowpass?: { near: number; far: number };
    /** Extra reverb send at `range` (added to the entry's `reverb`), 0..1: far sounds are wetter. */
    farReverb?: number;
    /** Seconds the sound arrives late at `range` (the lag of sound over distance), 0..0.5. */
    lag?: number;
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
  /** Dips the continuous loops (engine, rumble, ambient) while this sound plays, so a big bang is not masked. Same fields as `duck`. */
  duckLoops?: {
    amount: number;
    time: number;
  };
  /** Space reverb: how much of this sound is sent to the shared reverb (0 = dry, 1 = as loud as the dry sound). */
  reverb?: number;
  /** Seconds between the dry sound and the start of its reverb (s), 0..0.5. Longer = a bigger space. */
  preDelay?: number;
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
  EnemyShotFired: true,
  WingmanShotFired: true,
  PlayerDamaged: true,
  WingmanHit: true,
  WingmanDown: true,
  MissileImpact: true,
  ArenaEdgeEntered: true,
  ArenaEdgeLeft: true,
  PlayerRespawned: true,
  MenuMove: true,
  MenuSelect: true,
  MenuBack: true,
  MenuTick: true,
  EnemySpawned: true,
  EnemyMissileFired: true,
  EnemyMissileHit: true,
  PartDestroyed: true,
  CoreExposed: true,
  WingBroken: true,
  CapitalDestroyed: true,
  MenuPick: true,
  Paused: true,
  Resumed: true,
};
export const SOUND_EVENT_KEYS = Object.keys(SOUND_KEY_SET) as SoundEventKey[];

/**
 * Prototype 5 events that are deliberately silent in the style packs until their track gives them a
 * sound. The completeness tests allow 'silent' only for `PilotKill` and these; a track removes its
 * events from this list when it adds their sounds (see docs/p5-tracks.md).
 */
export const PENDING_SOUND_EVENTS: readonly SoundEventKey[] = [
  'EnemySpawned',
  'EnemyMissileFired',
  'EnemyMissileHit',
  'PartDestroyed',
  'CoreExposed',
  'WingBroken',
  'CapitalDestroyed',
];

/** A table with every event 'silent'. */
export function silentSoundTable(): SoundTable {
  const table = {} as SoundTable;
  for (const key of SOUND_EVENT_KEYS) table[key] = 'silent';
  return table;
}

// Loops -----------------------------------------------------------------------------------

/**
 * The game values a loop can follow (all computed by `src/audio/state.ts` from the world, never
 * written back): `speed` 0..1 of max speed, `throttle` -1..1, `hull` 0..1 of the player's hull,
 * `rescue` 0..1 progress of the pod being rescued, `missiles` 0..1 (missiles in the air, 3 = full),
 * `edge` 0 or 1 (outside the arena), `always` constant 1 while flying and 0 in menus (it also gates
 * every loop: nothing continuous runs in a menu).
 */
export const LOOP_STATES = [
  'speed',
  'throttle',
  'hull',
  'rescue',
  'missiles',
  'edge',
  'always',
] as const;
export type LoopStateKey = (typeof LOOP_STATES)[number];

/** Continuous sounds the engine keeps running while the game is in the matching state. */
export const LOOP_KEYS = [
  'engine',
  'afterburner',
  'rumble',
  'ambient',
  'missiles',
  'rescue',
  'hullAlarm',
  'edgeAlarm',
] as const;
export type LoopKey = (typeof LOOP_KEYS)[number];

/** One steady oscillator or noise source inside a loop (no envelope: the loop's gain curve shapes it). */
export interface LoopLayer {
  waveform: (typeof WAVEFORMS)[number];
  /** Frequency, Hz (ignored for noise); the loop's pitch curve multiplies it. */
  freq: number;
  /** Layer loudness inside the loop, 0..1. */
  gain: number;
  /** Fine pitch offset in cents, -1200..1200. */
  detune?: number;
  /** Waveshaper drive 0..1. */
  distortion?: number;
  /** Loudness wobble: rate Hz, depth 0..1, shape of the wobble (default sine; square makes an alarm beep). */
  tremolo?: { rate: number; depth: number; shape?: 'sine' | 'square' | 'triangle' };
  filter?: {
    type: (typeof FILTER_TYPES)[number];
    /** Cutoff or centre, Hz; the loop's cutoff curve multiplies it. */
    freq: number;
    /** Resonance, 0.1..30. */
    q: number;
  };
}

/** A piecewise-linear curve from a game value to a number: `points` are [value, output], sorted by value. */
export interface LoopCurve {
  state: LoopStateKey;
  points: readonly (readonly [number, number])[];
}

export interface LoopEntry {
  layers: readonly LoopLayer[];
  /** Loudness of the whole loop at gain 1, 0..1. */
  volume: number;
  /** Game value -> loudness multiplier 0..1. At 0 the loop is silent (and switched off after its fade). */
  gain: LoopCurve;
  /** Game value -> pitch multiplier of every oscillator (0.1..8); omit for a steady pitch. */
  pitch?: LoopCurve;
  /** Game value -> multiplier of every layer filter's cutoff (0.1..8); omit for a fixed cutoff. */
  cutoff?: LoopCurve;
  /** Seconds to come up after the value rises (s). Smooth, no clicks. */
  fadeIn: number;
  /** Seconds to die away after the value falls (s). */
  fadeOut: number;
  /** Reverb send, like a sound's: 0..1. */
  reverb?: number;
}

export type LoopTable = Record<LoopKey, LoopEntry | 'silent'>;

/** A table with every loop 'silent'. */
export function silentLoopTable(): LoopTable {
  const table = {} as LoopTable;
  for (const key of LOOP_KEYS) table[key] = 'silent';
  return table;
}

/** The music slot: one optional looping track per pack (a file, or a simple synthesised loop). */
export interface MusicDef {
  /** Level of the track itself, 0..1, before the music volume in the mix. */
  volume: number;
  source:
    | { kind: 'sample'; file: string }
    | {
        kind: 'loop';
        /** Beats per minute; one step is an eighth note. */
        bpm: number;
        /** Frequency of step 0, Hz. */
        root: number;
        waveform: Exclude<(typeof WAVEFORMS)[number], 'noise' | 'pink' | 'brown'>;
        /** The melody, one entry per eighth note: semitones above `root`, or null for a rest. The loop repeats after the last step. */
        steps: readonly (number | null)[];
        /** An optional bass line (same length, played two octaves below with a soft sine). */
        bass?: readonly (number | null)[];
      };
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
  /** Continuous sounds that follow the game state (engine, rumble, alarms). */
  loops: LoopTable;
  /** The music track, or null for none. */
  music: MusicDef | null;
}

/** What a pack folder exports: a manifest and any parts it has. Missing parts fall back. */
export interface StyleInput {
  manifest: StyleManifest;
  theme?: ThemeInput;
  ships?: ShipShapes;
  deaths?: DeathDefs;
  explosions?: ExplosionDefs;
  sounds?: Partial<SoundTable>;
  loops?: Partial<LoopTable>;
  music?: MusicDef | null;
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
  if (t.partColors !== undefined) errors.push(...validatePartColors(t.partColors));
  if (t.backdrop !== undefined) errors.push(...validateBackdrop(t.backdrop));
  return errors;
}

function validatePartColors(c: Partial<PartColors>): string[] {
  const errors: string[] = [];
  for (const [k, v] of Object.entries(c)) {
    if (k === 'panelTone') {
      if (!isNum(v, 0.05, 1.6)) errors.push('theme.partColors.panelTone must be 0.05..1.6');
    } else if (k === 'darkTone') {
      if (!isNum(v, 0, 1)) errors.push('theme.partColors.darkTone must be 0..1');
    } else if (k === 'accent' || k === 'glass' || k === 'glow') {
      if (!isColor(v)) errors.push(`theme.partColors.${k} must be a colour 0..0xffffff`);
    } else errors.push(`theme.partColors.${k} is unknown`);
  }
  return errors;
}

function validateBackdrop(b: BackdropDef): string[] {
  const errors: string[] = [];
  if (!Array.isArray(b.glows) || b.glows.length > MAX_BACKDROP_GLOWS)
    errors.push(`theme.backdrop.glows must be a list of at most ${MAX_BACKDROP_GLOWS}`);
  else
    b.glows.forEach((g, i) => {
      const at = `theme.backdrop.glows[${i}]`;
      if (!isNum(g?.x, -1.5, 1.5) || !isNum(g?.y, -1.5, 1.5))
        errors.push(`${at}.x and .y must be -1.5..1.5 (fractions of the view)`);
      if (!isNum(g?.radius, 0.01, 3)) errors.push(`${at}.radius must be 0.01..3 of the view width`);
      if (!isColor(g?.color)) errors.push(`${at}.color must be a colour 0..0xffffff`);
      if (!isNum(g?.strength, 0, 1)) errors.push(`${at}.strength must be 0..1`);
      if (!isNum(g?.hardness, 0, 1)) errors.push(`${at}.hardness must be 0..1`);
      if (!isNum(g?.shade, 0, 1)) errors.push(`${at}.shade must be 0..1`);
      if (!isNum(g?.lightAngle, -360, 360))
        errors.push(`${at}.lightAngle must be -360..360 degrees`);
      if (!isNum(g?.drift, 0, 0.2)) errors.push(`${at}.drift must be 0..0.2`);
    });
  const gr = b.grain;
  if (gr !== undefined) {
    if (!isNum(gr.count, 0, MAX_BACKDROP_GRAIN) || !Number.isInteger(gr.count))
      errors.push(`theme.backdrop.grain.count must be a whole number 0..${MAX_BACKDROP_GRAIN}`);
    if (!isNum(gr.size, 0.5, 4)) errors.push('theme.backdrop.grain.size must be 0.5..4 px');
    if (!isColor(gr.color)) errors.push('theme.backdrop.grain.color must be a colour 0..0xffffff');
    if (!isNum(gr.opacity, 0, 1)) errors.push('theme.backdrop.grain.opacity must be 0..1');
  }
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
    if (!isKind(SHAPE_KINDS, kind)) {
      errors.push(`ships.${kind} is not a ship kind`);
      continue;
    }
    const own: string[] = [
      ...validatePolygon(`ships.${kind}.polygon`, def.polygon, 3),
      ...(def.hole ? validatePolygon(`ships.${kind}.hole`, def.hole, 3) : []),
      ...(def.shadow ? validatePolygon(`ships.${kind}.shadow`, def.shadow, 3) : []),
      ...(def.eye ? validatePolygon(`ships.${kind}.eye`, def.eye, 3) : []),
      ...(def.glow ? validatePolygon(`ships.${kind}.glow`, def.glow, 1) : []),
      ...(def.parts !== undefined ? validateParts(`ships.${kind}`, def.parts) : []),
    ];
    if (own.length === 0) {
      const budget = isKind(BIG_SHAPE_KINDS, kind) ? MAX_CAPITAL_TRIANGLES : MAX_SHAPE_TRIANGLES;
      const cost = shapeTriangles(def);
      if (cost > budget)
        own.push(`ships.${kind} costs ${cost} triangles, over its budget of ${budget}`);
    }
    errors.push(...own);
  }
  return errors;
}

function validateParts(at: string, parts: readonly ShapePart[]): string[] {
  if (!Array.isArray(parts) || parts.length > MAX_SHAPE_PARTS)
    return [`${at}.parts must be a list of at most ${MAX_SHAPE_PARTS} parts`];
  const errors: string[] = [];
  parts.forEach((p, i) => {
    const name = `${at}.parts[${i}]`;
    if (!isKind(PART_KINDS, String(p?.kind))) errors.push(`${name}.kind is unknown`);
    if (!isKind(PART_ROLES, String(p?.role))) errors.push(`${name}.role is unknown`);
    const isLine = p?.kind === 'line';
    if (Array.isArray(p?.points) && p.points.length > MAX_PART_POINTS)
      errors.push(`${name}.points has more than ${MAX_PART_POINTS} points`);
    else if (isLine) errors.push(...validatePolyline(`${name}.points`, p.points));
    else errors.push(...validatePolygon(`${name}.points`, p?.points, 3));
    if (p?.width !== undefined && (!isLine || !isNum(p.width, 0.002, 0.3)))
      errors.push(`${name}.width must be 0.002..0.3 and only for lines`);
    if (p?.color !== undefined && !isColor(p.color))
      errors.push(`${name}.color must be a colour 0..0xffffff`);
    if (p?.mirror !== undefined && typeof p.mirror !== 'boolean')
      errors.push(`${name}.mirror must be true or false`);
  });
  return errors;
}

function validatePolyline(name: string, p: readonly Point[] | undefined): string[] {
  if (!Array.isArray(p) || p.length < 2) return [`${name} needs at least 2 points`];
  const errors: string[] = [];
  p.forEach((pt, i) => {
    if (
      !Array.isArray(pt) ||
      !isNum(pt[0], -MAX_SHAPE_EXTENT, MAX_SHAPE_EXTENT) ||
      !isNum(pt[1], -MAX_SHAPE_EXTENT, MAX_SHAPE_EXTENT)
    )
      errors.push(`${name}[${i}] must be two numbers within +/-${MAX_SHAPE_EXTENT} radii`);
  });
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

/** Most layers in one synthesised sound. */
export const MAX_LAYERS = 12;

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
  if (l.hold !== undefined && !isNum(l.hold, 0, 10)) errors.push(`${where}.hold must be 0..10 s`);
  if (l.detune !== undefined && !isNum(l.detune, -1200, 1200))
    errors.push(`${where}.detune must be -1200..1200 cents`);
  if (l.distortion !== undefined && !isNum(l.distortion, 0, 1))
    errors.push(`${where}.distortion must be 0..1`);
  if (l.tremolo !== undefined) {
    if (!isNum(l.tremolo.rate, 0.1, 60)) errors.push(`${where}.tremolo.rate must be 0.1..60 Hz`);
    if (!isNum(l.tremolo.depth, 0, 1)) errors.push(`${where}.tremolo.depth must be 0..1`);
  }
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
      if (!Array.isArray(layers) || layers.length < 1 || layers.length > MAX_LAYERS)
        errors.push(`sounds.${key}.source.layers must be 1..${MAX_LAYERS} layers`);
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
      const lp = e.spatial.lowpass;
      if (lp !== undefined) {
        if (!isNum(lp.near, 100, 20000))
          errors.push(`sounds.${key}.spatial.lowpass.near must be 100..20000 Hz`);
        if (!isNum(lp.far, 100, 20000))
          errors.push(`sounds.${key}.spatial.lowpass.far must be 100..20000 Hz`);
      }
      if (e.spatial.farReverb !== undefined && !isNum(e.spatial.farReverb, 0, 1))
        errors.push(`sounds.${key}.spatial.farReverb must be 0..1`);
      if (e.spatial.lag !== undefined && !isNum(e.spatial.lag, 0, 0.5))
        errors.push(`sounds.${key}.spatial.lag must be 0..0.5 s`);
    }
    if (e.reverb !== undefined && !isNum(e.reverb, 0, 1))
      errors.push(`sounds.${key}.reverb must be 0..1`);
    if (e.preDelay !== undefined && !isNum(e.preDelay, 0, 0.5))
      errors.push(`sounds.${key}.preDelay must be 0..0.5 s`);
    if (e.duckLoops !== undefined) {
      if (!isNum(e.duckLoops.amount, 0, 1))
        errors.push(`sounds.${key}.duckLoops.amount must be 0..1`);
      if (!isNum(e.duckLoops.time, 0.01, 10))
        errors.push(`sounds.${key}.duckLoops.time must be 0.01..10 s`);
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

function validateCurve(
  where: string,
  c: LoopCurve | undefined,
  outMax: number,
  outMin = 0,
): string[] {
  if (!c || typeof c !== 'object') return [`${where} must be a curve`];
  const errors: string[] = [];
  if (!isKind(LOOP_STATES, c.state)) errors.push(`${where}.state is unknown`);
  const pts = c.points;
  if (!Array.isArray(pts) || pts.length < 2 || pts.length > 12) {
    errors.push(`${where}.points must be 2..12 points`);
    return errors;
  }
  let last = -Infinity;
  for (const pt of pts) {
    if (
      !Array.isArray(pt) ||
      pt.length !== 2 ||
      !isNum(pt[0], -1, 1) ||
      !isNum(pt[1], outMin, outMax)
    ) {
      errors.push(`${where}.points must be [value -1..1, output ${outMin}..${outMax}]`);
      break;
    }
    if (pt[0] <= last) {
      errors.push(`${where}.points must rise in value`);
      break;
    }
    last = pt[0];
  }
  return errors;
}

export function validateLoops(loops: Partial<LoopTable>): string[] {
  const errors: string[] = [];
  for (const [key, entry] of Object.entries(loops)) {
    if (!isKind(LOOP_KEYS, key)) {
      errors.push(`loops.${key} is not a loop`);
      continue;
    }
    if (entry === 'silent') continue;
    const e = entry as LoopEntry | undefined;
    const at = `loops.${key}`;
    if (!e || typeof e !== 'object') {
      errors.push(`${at} must be a loop or 'silent'`);
      continue;
    }
    if (!Array.isArray(e.layers) || e.layers.length < 1 || e.layers.length > 6)
      errors.push(`${at}.layers must be 1..6 layers`);
    else
      e.layers.forEach((l, i) => {
        const w = `${at}.layers[${i}]`;
        if (!isKind(WAVEFORMS, l.waveform)) errors.push(`${w}.waveform is unknown`);
        if (!isNum(l.freq, 10, 20000)) errors.push(`${w}.freq must be 10..20000 Hz`);
        if (!isNum(l.gain, 0, 1)) errors.push(`${w}.gain must be 0..1`);
        if (l.detune !== undefined && !isNum(l.detune, -1200, 1200))
          errors.push(`${w}.detune must be -1200..1200 cents`);
        if (l.distortion !== undefined && !isNum(l.distortion, 0, 1))
          errors.push(`${w}.distortion must be 0..1`);
        if (l.tremolo !== undefined) {
          if (!isNum(l.tremolo.rate, 0.1, 60)) errors.push(`${w}.tremolo.rate must be 0.1..60 Hz`);
          if (!isNum(l.tremolo.depth, 0, 1)) errors.push(`${w}.tremolo.depth must be 0..1`);
        }
        if (l.filter !== undefined) {
          if (!isKind(FILTER_TYPES, l.filter.type)) errors.push(`${w}.filter.type is unknown`);
          if (!isNum(l.filter.freq, 10, 20000))
            errors.push(`${w}.filter.freq must be 10..20000 Hz`);
          if (!isNum(l.filter.q, 0.1, 30)) errors.push(`${w}.filter.q must be 0.1..30`);
        }
      });
    if (!isNum(e.volume, 0, 1)) errors.push(`${at}.volume must be 0..1`);
    errors.push(...validateCurve(`${at}.gain`, e.gain, 1));
    if (e.pitch !== undefined) errors.push(...validateCurve(`${at}.pitch`, e.pitch, 8, 0.1));
    if (e.cutoff !== undefined) errors.push(...validateCurve(`${at}.cutoff`, e.cutoff, 8, 0.1));
    if (!isNum(e.fadeIn, 0.01, 10)) errors.push(`${at}.fadeIn must be 0.01..10 s`);
    if (!isNum(e.fadeOut, 0.01, 10)) errors.push(`${at}.fadeOut must be 0.01..10 s`);
    if (e.reverb !== undefined && !isNum(e.reverb, 0, 1)) errors.push(`${at}.reverb must be 0..1`);
  }
  return errors;
}

export function validateMusic(music: MusicDef | null | undefined): string[] {
  if (music === null || music === undefined) return [];
  const errors: string[] = [];
  if (!isNum(music.volume, 0, 1)) errors.push('music.volume must be 0..1');
  const src = music.source;
  if (src?.kind === 'sample') {
    if (!isText(src.file)) errors.push('music.source.file is empty');
  } else if (src?.kind === 'loop') {
    if (!isNum(src.bpm, 40, 240)) errors.push('music.source.bpm must be 40..240');
    if (!isNum(src.root, 20, 2000)) errors.push('music.source.root must be 20..2000 Hz');
    if (!isKind(WAVEFORMS, src.waveform) || isKind(NOISE_WAVEFORMS, src.waveform))
      errors.push('music.source.waveform must be sine, square, sawtooth or triangle');
    const line = (name: string, steps: readonly (number | null)[] | undefined): void => {
      if (!Array.isArray(steps) || steps.length < 1 || steps.length > 64)
        errors.push(`music.source.${name} must have 1..64 steps`);
      else if (!steps.every((n) => n === null || (Number.isInteger(n) && isNum(n, -48, 48))))
        errors.push(`music.source.${name} steps must be null or whole semitones -48..48`);
    };
    line('steps', src.steps);
    if (src.bass !== undefined) {
      line('bass', src.bass);
      if (Array.isArray(src.bass) && src.bass.length !== src.steps?.length)
        errors.push('music.source.bass must be as long as steps');
    }
  } else errors.push('music.source must be sample or loop');
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
    ...validateLoops(input.loops ?? {}),
    ...validateMusic(input.music),
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
  const noLoops = LOOP_KEYS.filter((k) => input.loops?.[k] === undefined);
  if (noLoops.length) missing.push(`loops: ${noLoops.join(', ')}`);
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
  const musicErrors = validateMusic(input.music);
  if (musicErrors.length)
    warnings.push(
      `style "${id}": music is invalid (${musicErrors.join('; ')}), using ${base.manifest.id}`,
    );
  const validMusic = musicErrors.length === 0 ? input.music : undefined;
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
    loops: { ...base.loops, ...valid('loops', input.loops, validateLoops) },
    music: input.music === null ? null : (validMusic ?? base.music),
  };
  if (id !== base.manifest.id) {
    const missing = missingParts(input);
    if (missing.length)
      warnings.push(`style "${id}" falls back to ${base.manifest.id} for ${missing.join(' | ')}`);
  }
  return { pack, warnings };
}

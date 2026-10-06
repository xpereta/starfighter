/**
 * The spectacle extension of the style contract (additive: a pack that has no `spectacle` is drawn
 * exactly as before). Pure types and validation, no DOM and no three. Every section is optional and
 * complete when present; render code treats a missing section as "off". Everything here is
 * render-only: nothing in `src/core` reads it, so the replay hash cannot depend on it.
 */

const isNum = (v: unknown, min: number, max: number): boolean =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isInt = (v: unknown, min: number, max: number): boolean =>
  isNum(v, min, max) && Number.isInteger(v);
const isColor = (v: unknown): boolean =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffff;
const isText = (v: unknown, max = 60): boolean =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;

// Post-processing -------------------------------------------------------------------------

export interface PostDef {
  bloom: {
    /** Glow strength, 0..3 (0 = off). */
    strength: number;
    /** How far the glow spreads, 0..1. */
    radius: number;
    /** Brightness above which things glow, 0..1.5 (flat cel colours sit below about 0.9, light sources above). */
    threshold: number;
  };
  chromatic: {
    /** Resting colour fringe at the screen edge, 0..1 (0 = none). */
    base: number;
    /** Extra fringe pulse on a player hit and on big kills, 0..1. */
    hit: number;
    /** Seconds the pulse takes to fade, 0.05..2. */
    decay: number;
  };
  /** Dark corners, 0..1. */
  vignette: number;
  /** Film grain, 0..1. */
  grain: number;
  /** Scanlines, 0..1. */
  scanlines: number;
  /** Zoom punch on big kills (a render-only scale of the finished picture, not the camera), 0..1. */
  punch: number;
}

export function validatePost(p: PostDef): string[] {
  const e: string[] = [];
  if (!isNum(p.bloom?.strength, 0, 3)) e.push('post.bloom.strength must be 0..3');
  if (!isNum(p.bloom?.radius, 0, 1)) e.push('post.bloom.radius must be 0..1');
  if (!isNum(p.bloom?.threshold, 0, 1.5)) e.push('post.bloom.threshold must be 0..1.5');
  if (!isNum(p.chromatic?.base, 0, 1)) e.push('post.chromatic.base must be 0..1');
  if (!isNum(p.chromatic?.hit, 0, 1)) e.push('post.chromatic.hit must be 0..1');
  if (!isNum(p.chromatic?.decay, 0.05, 2)) e.push('post.chromatic.decay must be 0.05..2 s');
  if (!isNum(p.vignette, 0, 1)) e.push('post.vignette must be 0..1');
  if (!isNum(p.grain, 0, 1)) e.push('post.grain must be 0..1');
  if (!isNum(p.scanlines, 0, 1)) e.push('post.scanlines must be 0..1');
  if (!isNum(p.punch, 0, 1)) e.push('post.punch must be 0..1');
  return e;
}

// Backdrop --------------------------------------------------------------------------------

export const STRUCTURES = ['none', 'planet', 'ring', 'carrier'] as const;
export type Structure = (typeof STRUCTURES)[number];

/** The colours of one battle's sky. The backdrop eases from one palette to the next. */
export interface BackdropPalette {
  name: string;
  /** Deep sky colour (replaces the theme background while this palette is on). */
  sky: number;
  nebulaA: number;
  nebulaB: number;
  /** Tint of the star fields. */
  star: number;
  /** Colour of the distant battle flashes. */
  glow: number;
  /** The big far-away thing in this battle's sky. */
  structure: Structure;
  structureColor: number;
}

export interface BackdropDef {
  /** One palette per battle, cycling (1..8). Practice mode uses the first. */
  palettes: readonly BackdropPalette[];
  nebula: {
    /** Gas-cloud layers, 0..3. */
    layers: number;
    /** Opacity of the clouds, 0..1. */
    strength: number;
    /** Size of the cloud features, world units, 300..6000. */
    scale: number;
    /** Slow drift of the gas, u/s, 0..200. */
    drift: number;
  };
  stars: {
    /** Extra twinkling star layers on top of the base three, 0..3. */
    extraLayers: number;
    /** How much stars twinkle, 0..1. */
    twinkle: number;
  };
  debris: {
    /** Drifting rocks and wreckage in the mid-distance, 0..64. */
    count: number;
    /** Size range, world units, 4..400. */
    size: readonly [number, number];
    /** Parallax depth 0.3..0.95 (1 = moves with the world). */
    depth: number;
  };
  flashes: {
    /** Distant battle flashes per second, 0..8. */
    rate: number;
    /** Size, world units, 20..600. */
    size: number;
  };
  /** Seconds a palette change takes, 0.2..10. */
  shift: number;
}

export function validateBackdrop(b: BackdropDef): string[] {
  const e: string[] = [];
  if (!Array.isArray(b.palettes) || b.palettes.length < 1 || b.palettes.length > 8)
    e.push('backdrop.palettes must be 1..8 palettes');
  else
    b.palettes.forEach((p, i) => {
      const at = `backdrop.palettes[${i}]`;
      if (!isText(p.name)) e.push(`${at}.name is empty`);
      for (const k of ['sky', 'nebulaA', 'nebulaB', 'star', 'glow', 'structureColor'] as const)
        if (!isColor(p[k])) e.push(`${at}.${k} must be a colour 0..0xffffff`);
      if (!(STRUCTURES as readonly string[]).includes(p.structure))
        e.push(`${at}.structure must be one of ${STRUCTURES.join(', ')}`);
    });
  if (!isInt(b.nebula?.layers, 0, 3)) e.push('backdrop.nebula.layers must be a whole number 0..3');
  if (!isNum(b.nebula?.strength, 0, 1)) e.push('backdrop.nebula.strength must be 0..1');
  if (!isNum(b.nebula?.scale, 300, 6000)) e.push('backdrop.nebula.scale must be 300..6000 u');
  if (!isNum(b.nebula?.drift, 0, 200)) e.push('backdrop.nebula.drift must be 0..200 u/s');
  if (!isInt(b.stars?.extraLayers, 0, 3))
    e.push('backdrop.stars.extraLayers must be a whole number 0..3');
  if (!isNum(b.stars?.twinkle, 0, 1)) e.push('backdrop.stars.twinkle must be 0..1');
  if (!isInt(b.debris?.count, 0, 64)) e.push('backdrop.debris.count must be a whole number 0..64');
  const size = b.debris?.size;
  if (
    !Array.isArray(size) ||
    !isNum(size[0], 4, 400) ||
    !isNum(size[1], 4, 400) ||
    size[0]! > size[1]!
  )
    e.push('backdrop.debris.size must be a range min..max within 4..400 u');
  if (!isNum(b.debris?.depth, 0.3, 0.95)) e.push('backdrop.debris.depth must be 0.3..0.95');
  if (!isNum(b.flashes?.rate, 0, 8)) e.push('backdrop.flashes.rate must be 0..8 per second');
  if (!isNum(b.flashes?.size, 20, 600)) e.push('backdrop.flashes.size must be 20..600 u');
  if (!isNum(b.shift, 0.2, 10)) e.push('backdrop.shift must be 0.2..10 s');
  return e;
}

// Ships -----------------------------------------------------------------------------------

export interface ShipFxDef {
  plume: {
    /** Plume length at full throttle, ship radii, 0..3 (0 = no plume). */
    length: number;
    /** Plume width at the nozzle, ship radii, 0..1. */
    width: number;
    /** Share of the length at idle, 0..1. */
    idle: number;
    /** Flicker, 0..1. */
    flicker: number;
    /** Heat shimmer: a pulsing halo (no refraction), 0..1. */
    shimmer: number;
    /** Optional: seconds of exhaust the player's engines leave behind along the path they flew (a curving ribbon), 0..3; 0 or missing = none. */
    trail?: number;
  };
  navLights: {
    /** Light size, world units, 0..12 (0 = off). */
    size: number;
    /** Blinks per second, 0..4. */
    blinkHz: number;
    port: number;
    starboard: number;
    strobe: number;
  };
  trails: {
    /** Seconds a trail lasts, 0.1..3. */
    life: number;
    /** Trail width at the ship, world units, 0..30 (0 = off). */
    width: number;
    /** Opacity, 0..1. */
    alpha: number;
    /** Speed share (0..1 of max speed) from which the player's wingtip trails show. */
    from: number;
  };
  rollStreak: {
    /** Length of the evade-roll streak, world units, 0..400 (0 = off). */
    length: number;
    alpha: number;
  };
  missiles: {
    /** Smoke strands twisting around each missile's path, 0..3 (0 = plain trail only). */
    spirals: number;
    /** How wide the spiral swings, world units, 0..40. */
    amplitude: number;
    /** Seconds the smoke lingers, 0.2..4. */
    smokeLife: number;
    /** Launch flash radius, world units, 0..120. */
    flash: number;
  };
  brackets: {
    /** Lock-on bracket size as a multiple of the target's radius, 0..4 (0 = off). */
    size: number;
    color: number;
  };
}

export function validateShipFx(s: ShipFxDef): string[] {
  const e: string[] = [];
  if (!isNum(s.plume?.length, 0, 3)) e.push('ships.plume.length must be 0..3 radii');
  if (!isNum(s.plume?.width, 0, 1)) e.push('ships.plume.width must be 0..1 radii');
  if (!isNum(s.plume?.idle, 0, 1)) e.push('ships.plume.idle must be 0..1');
  if (!isNum(s.plume?.flicker, 0, 1)) e.push('ships.plume.flicker must be 0..1');
  if (!isNum(s.plume?.shimmer, 0, 1)) e.push('ships.plume.shimmer must be 0..1');
  if (s.plume?.trail !== undefined && !isNum(s.plume.trail, 0, 3))
    e.push('ships.plume.trail must be 0..3 s');
  if (!isNum(s.navLights?.size, 0, 12)) e.push('ships.navLights.size must be 0..12 u');
  if (!isNum(s.navLights?.blinkHz, 0, 4)) e.push('ships.navLights.blinkHz must be 0..4');
  for (const k of ['port', 'starboard', 'strobe'] as const)
    if (!isColor(s.navLights?.[k])) e.push(`ships.navLights.${k} must be a colour`);
  if (!isNum(s.trails?.life, 0.1, 3)) e.push('ships.trails.life must be 0.1..3 s');
  if (!isNum(s.trails?.width, 0, 30)) e.push('ships.trails.width must be 0..30 u');
  if (!isNum(s.trails?.alpha, 0, 1)) e.push('ships.trails.alpha must be 0..1');
  if (!isNum(s.trails?.from, 0, 1)) e.push('ships.trails.from must be 0..1');
  if (!isNum(s.rollStreak?.length, 0, 400)) e.push('ships.rollStreak.length must be 0..400 u');
  if (!isNum(s.rollStreak?.alpha, 0, 1)) e.push('ships.rollStreak.alpha must be 0..1');
  if (!isInt(s.missiles?.spirals, 0, 3))
    e.push('ships.missiles.spirals must be a whole number 0..3');
  if (!isNum(s.missiles?.amplitude, 0, 40)) e.push('ships.missiles.amplitude must be 0..40 u');
  if (!isNum(s.missiles?.smokeLife, 0.2, 4)) e.push('ships.missiles.smokeLife must be 0.2..4 s');
  if (!isNum(s.missiles?.flash, 0, 120)) e.push('ships.missiles.flash must be 0..120 u');
  if (!isNum(s.brackets?.size, 0, 4)) e.push('ships.brackets.size must be 0..4');
  if (!isColor(s.brackets?.color)) e.push('ships.brackets.color must be a colour');
  return e;
}

// Combat ----------------------------------------------------------------------------------

export const BLAST_KINDS = [
  'fighter',
  'drone',
  'turret',
  'static',
  'wingman',
  'missile',
  'hit',
  // Prototype 5: the gunship's kill, the capital ship's parts (scaled by part size and role), the
  // capital ship's last blast and an enemy missile ending on you.
  'gunship',
  'capitalPart',
  'capital',
  'enemyMissile',
] as const;
export type BlastKind = (typeof BLAST_KINDS)[number];

/** The extra layers drawn over the style's own explosions, per kind of thing destroyed or hit. */
export interface BlastRecipe {
  /** White flash-frame radius, in ship radii (0 = none). */
  flash: number;
  /** Shock rings, 0..3. */
  rings: number;
  /** Outer radius of the biggest ring, in ship radii, 0.5..10. */
  ringSize: number;
  /** Fireball radius, in ship radii (0 = none). */
  fireball: number;
  /** Sparks thrown out, 0..64. */
  sparks: number;
  /** Smoke ink-blots left behind, 0..10. */
  ink: number;
  /** Glinting debris stars, 0..16. */
  glints: number;
  /** Delayed little blasts around the wreck (a chain reaction), 0..10. */
  chain: number;
  /** Seconds the chain takes to run its course, 0.1..4. */
  chainSpan: number;
  /** Zoom punch of the picture, 0..1 (scaled by the post `punch`). */
  zoom: number;
  /** Fireball colours: white-hot core, flame, edge (0xRRGGBB). */
  ramp: readonly [number, number, number];
}

export interface CombatFxDef {
  recipes: Record<BlastKind, BlastRecipe>;
  /** Optional time stretch of blasts (fireballs, rings, sparks, smoke, chain delays), 0.5..4; default 1 = the original pace. */
  tempo?: number;
  tracers: {
    /** Player bullet streak length and width, world units. */
    length: number;
    width: number;
    /** Enemy shot orb radius, world units, 0..30 (0 = plain shots). */
    orb: number;
    /** Brightness over the base colour, 0.5..4 (above 1 it blooms). */
    glow: number;
  };
}

export function validateRecipe(at: string, r: BlastRecipe): string[] {
  const e: string[] = [];
  if (!isNum(r?.flash, 0, 10)) e.push(`${at}.flash must be 0..10 radii`);
  if (!isInt(r?.rings, 0, 3)) e.push(`${at}.rings must be a whole number 0..3`);
  if (!isNum(r?.ringSize, 0.5, 10)) e.push(`${at}.ringSize must be 0.5..10 radii`);
  if (!isNum(r?.fireball, 0, 10)) e.push(`${at}.fireball must be 0..10 radii`);
  if (!isInt(r?.sparks, 0, 64)) e.push(`${at}.sparks must be a whole number 0..64`);
  if (!isInt(r?.ink, 0, 10)) e.push(`${at}.ink must be a whole number 0..10`);
  if (!isInt(r?.glints, 0, 16)) e.push(`${at}.glints must be a whole number 0..16`);
  if (!isInt(r?.chain, 0, 10)) e.push(`${at}.chain must be a whole number 0..10`);
  if (!isNum(r?.chainSpan, 0.1, 4)) e.push(`${at}.chainSpan must be 0.1..4 s`);
  if (!isNum(r?.zoom, 0, 1)) e.push(`${at}.zoom must be 0..1`);
  if (!Array.isArray(r?.ramp) || r.ramp.length !== 3 || !r.ramp.every(isColor))
    e.push(`${at}.ramp must be three colours`);
  return e;
}

export function validateCombat(c: CombatFxDef): string[] {
  const e: string[] = [];
  for (const k of BLAST_KINDS) {
    if (!c.recipes?.[k]) e.push(`combat.recipes.${k} is missing`);
    else e.push(...validateRecipe(`combat.recipes.${k}`, c.recipes[k]));
  }
  if (c.tempo !== undefined && !isNum(c.tempo, 0.5, 4)) e.push('combat.tempo must be 0.5..4');
  if (!isNum(c.tracers?.length, 4, 200)) e.push('combat.tracers.length must be 4..200 u');
  if (!isNum(c.tracers?.width, 1, 40)) e.push('combat.tracers.width must be 1..40 u');
  if (!isNum(c.tracers?.orb, 0, 30)) e.push('combat.tracers.orb must be 0..30 u');
  if (!isNum(c.tracers?.glow, 0.5, 4)) e.push('combat.tracers.glow must be 0.5..4');
  return e;
}

// Cards -----------------------------------------------------------------------------------

export interface CardsDef {
  /** Title of each battle's intro card, cycling (1..8). */
  battleTitles: readonly string[];
  /** The line under the title, cycling (1..8). */
  subtitles: readonly string[];
  /** Outro card when a battle is cleared. */
  cleared: string;
  /** Flourish when a pilot is lost. */
  pilotLost: string;
  victory: string;
  defeat: string;
  /** Accent and text colours. */
  accent: number;
  text: number;
  /** Seconds a card stays, 0.5..6. */
  duration: number;
  /** Letterbox bar height, share of the screen height, 0..0.2. */
  letterbox: number;
}

const isTextList = (v: unknown): boolean =>
  Array.isArray(v) && v.length >= 1 && v.length <= 8 && v.every((t) => isText(t, 40));

export function validateCards(c: CardsDef): string[] {
  const e: string[] = [];
  if (!isTextList(c.battleTitles)) e.push('cards.battleTitles must be 1..8 short texts');
  if (!isTextList(c.subtitles)) e.push('cards.subtitles must be 1..8 short texts');
  for (const k of ['cleared', 'pilotLost', 'victory', 'defeat'] as const)
    if (!isText(c[k], 40)) e.push(`cards.${k} must be a short text`);
  if (!isColor(c.accent)) e.push('cards.accent must be a colour');
  if (!isColor(c.text)) e.push('cards.text must be a colour');
  if (!isNum(c.duration, 0.5, 6)) e.push('cards.duration must be 0.5..6 s');
  if (!isNum(c.letterbox, 0, 0.2)) e.push('cards.letterbox must be 0..0.2');
  return e;
}

// The whole extension ---------------------------------------------------------------------

/** What a spectacle pack can add. A section left out is off (or inherited from the parent pack). */
export interface SpectacleDef {
  post?: PostDef;
  backdrop?: BackdropDef;
  ships?: ShipFxDef;
  combat?: CombatFxDef;
  cards?: CardsDef;
}

export const SPECTACLE_SECTIONS = ['post', 'backdrop', 'ships', 'combat', 'cards'] as const;
export type SpectacleSection = (typeof SPECTACLE_SECTIONS)[number];

export function validateSpectacle(s: SpectacleDef): string[] {
  const e: string[] = [];
  for (const k of Object.keys(s))
    if (!(SPECTACLE_SECTIONS as readonly string[]).includes(k))
      e.push(`spectacle.${k} is not a section`);
  if (s.post) e.push(...validatePost(s.post));
  if (s.backdrop) e.push(...validateBackdrop(s.backdrop));
  if (s.ships) e.push(...validateShipFx(s.ships));
  if (s.combat) e.push(...validateCombat(s.combat));
  if (s.cards) e.push(...validateCards(s.cards));
  return e;
}

/**
 * Merges a pack's spectacle over its base's, section by section, as independent copies (the panel
 * edits the resolved copy live, which must never write through to the data module). `null` when
 * neither has any.
 */
export function mergeSpectacle(
  own: SpectacleDef | null | undefined,
  base: SpectacleDef | null,
): SpectacleDef | null {
  if (own === null) return null;
  if (!own && !base) return null;
  const out: SpectacleDef = {};
  for (const k of SPECTACLE_SECTIONS) {
    const v = own?.[k] ?? base?.[k];
    if (v) (out as Record<string, unknown>)[k] = structuredClone(v);
  }
  return out;
}

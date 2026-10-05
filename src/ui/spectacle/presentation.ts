import type { EntityKind } from '../../core/world/target';
import type { PresetName } from './settings';

/**
 * The presentation definition a style pack can provide (`data/styles/<id>/presentation.ts`): the
 * interface colours, the tuning of every camera and feel effect, combo tiers, banner and kill-feed
 * wording and the palettes of the procedural pilot portraits. A style without one keeps the classic
 * HUD and menus. Pure data and validation: no DOM, no three.
 */

/** Interface colours (CSS colour strings). */
export interface UiColors {
  /** Main friendly accent: panels, rings, readouts. */
  accent: string;
  /** Enemies, damage, warnings. */
  hot: string;
  /** Locks, rank, highlights. */
  gold: string;
  /** Rescue and healing. */
  mint: string;
  /** Darkest background of panels. */
  ink: string;
  /** Panel fill (translucent). */
  panel: string;
  text: string;
  dim: string;
}

/** What one kind of event does to the picture: zoom punch, extra shake (both 0..1) and a drawing-only freeze (s). */
export interface Impact {
  punch: number;
  shake: number;
  freeze: number;
}

export const IMPACT_KEYS = [
  'drone',
  'fighter',
  'turret',
  'static',
  'wingman',
  'salvo',
  'missileImpact',
  'hit',
  'damage',
  'rescue',
  'cleared',
  'lost',
] as const;
export type ImpactKey = (typeof IMPACT_KEYS)[number];

export interface FeelDef {
  impacts: Record<ImpactKey, Impact>;
  /** Zoom-in at a full punch (a share of the view: 0.07 = 7% closer). */
  maxZoom: number;
  /** Decay rates, 1/s. */
  punchDecay: number;
  shakeDecay: number;
  /** Largest extra shake offset on screen at full trauma, px. */
  maxShakePx: number;
  /** Roll at the sharpest turn, degrees; the turn rate (rad/s) that counts as sharpest; smoothing, 1/s. */
  maxRollDeg: number;
  turnRateFull: number;
  rollSmooth: number;
  /** Longest drawing-only freeze, s. */
  maxFreeze: number;
  killCam: {
    /** Kills inside `window` seconds, with a salvo launched in the last `salvoWindow` seconds, that trigger it. */
    kills: number;
    window: number;
    salvoWindow: number;
    /** The freeze frame, s, and the pause before it can trigger again, s. */
    freeze: number;
    cooldown: number;
  };
  /** The tension vignette starts below this hull fraction and pulses at `pulseHz`. */
  vignette: { from: number; pulseHz: number };
}

export interface ComboTier {
  /** Kills in the streak at which the tier starts. */
  at: number;
  label: string;
}

export interface ComboDef {
  /** Seconds a streak survives without a kill. */
  window: number;
  /** A multiplier step every this many kills (x1, x1.5, x2 ...), capped at `maxMultiplier`. */
  step: number;
  maxMultiplier: number;
  tiers: readonly ComboTier[];
}

export interface PortraitPalette {
  /** Helmet and suit colours (0xRRGGBB). */
  helmets: readonly number[];
  /** Visor glass colours. */
  visors: readonly number[];
  /** Stripe and badge accents. */
  accents: readonly number[];
}

export interface PresentationDef {
  /** The style flag: false keeps the classic HUD and menus whatever the panel says. */
  enabled: boolean;
  /** The preset the style starts with (`?spectacle=` overrides it). */
  preset: PresetName;
  colors: UiColors;
  feel: FeelDef;
  combo: ComboDef;
  /** Score per kind of enemy, before the combo multiplier. */
  points: Record<EntityKind, number>;
  /** Kill-feed names of what was destroyed. */
  killLabels: Record<EntityKind, string>;
  portraits: PortraitPalette;
  /** Seconds a banner or title card takes: slide in, hold, slide out. */
  banner: { in: number; hold: number; out: number };
  /** Seconds a comm window slides in and out. */
  commSlide: number;
  /** Seconds a kill-feed line lasts and how many are shown. */
  feedLife: number;
  feedLines: number;
  /** Words for the title cards and the screens. */
  words: {
    tagline: string;
    battle: string;
    wave: string;
    cleared: string;
    pilotLost: string;
    rescued: string;
    victory: string;
    defeat: string;
    multiKill: string;
  };
}

const COLOR_KEYS: readonly (keyof UiColors)[] = [
  'accent',
  'hot',
  'gold',
  'mint',
  'ink',
  'panel',
  'text',
  'dim',
];

/** Returns what is wrong with a presentation definition (empty = fine). */
export function validatePresentation(p: PresentationDef): string[] {
  const errors: string[] = [];
  for (const k of COLOR_KEYS) if (!p.colors[k]) errors.push(`colors.${k} is missing`);
  const finite = (name: string, v: number, min: number, max: number): void => {
    if (!Number.isFinite(v) || v < min || v > max)
      errors.push(`${name} must be a number from ${min} to ${max}`);
  };
  for (const k of IMPACT_KEYS) {
    const i = p.feel.impacts[k];
    if (!i) {
      errors.push(`feel.impacts.${k} is missing`);
      continue;
    }
    finite(`feel.impacts.${k}.punch`, i.punch, 0, 1);
    finite(`feel.impacts.${k}.shake`, i.shake, 0, 1);
    finite(`feel.impacts.${k}.freeze`, i.freeze, 0, 0.5);
  }
  finite('feel.maxZoom', p.feel.maxZoom, 0, 0.3);
  finite('feel.punchDecay', p.feel.punchDecay, 0.5, 40);
  finite('feel.shakeDecay', p.feel.shakeDecay, 0.5, 40);
  finite('feel.maxShakePx', p.feel.maxShakePx, 0, 60);
  finite('feel.maxRollDeg', p.feel.maxRollDeg, 0, 8);
  finite('feel.turnRateFull', p.feel.turnRateFull, 0.1, 20);
  finite('feel.rollSmooth', p.feel.rollSmooth, 0.5, 40);
  finite('feel.maxFreeze', p.feel.maxFreeze, 0, 0.5);
  finite('feel.killCam.kills', p.feel.killCam.kills, 2, 20);
  finite('feel.killCam.window', p.feel.killCam.window, 0.1, 10);
  finite('feel.killCam.salvoWindow', p.feel.killCam.salvoWindow, 0.5, 15);
  finite('feel.killCam.freeze', p.feel.killCam.freeze, 0, 1);
  finite('feel.killCam.cooldown', p.feel.killCam.cooldown, 0, 30);
  finite('feel.vignette.from', p.feel.vignette.from, 0, 1);
  finite('feel.vignette.pulseHz', p.feel.vignette.pulseHz, 0, 6);
  finite('combo.window', p.combo.window, 0.5, 20);
  finite('combo.step', p.combo.step, 1, 50);
  finite('combo.maxMultiplier', p.combo.maxMultiplier, 1, 99);
  if (p.combo.tiers.length === 0) errors.push('combo.tiers needs at least one tier');
  for (let i = 1; i < p.combo.tiers.length; i++)
    if (p.combo.tiers[i]!.at <= p.combo.tiers[i - 1]!.at)
      errors.push('combo.tiers must be in increasing order of `at`');
  for (const [name, list] of Object.entries(p.portraits))
    if (list.length === 0) errors.push(`portraits.${name} needs at least one colour`);
  finite('banner.in', p.banner.in, 0.05, 5);
  finite('banner.hold', p.banner.hold, 0.1, 10);
  finite('banner.out', p.banner.out, 0.05, 5);
  finite('commSlide', p.commSlide, 0.05, 2);
  finite('feedLife', p.feedLife, 0.5, 30);
  finite('feedLines', p.feedLines, 1, 12);
  return errors;
}

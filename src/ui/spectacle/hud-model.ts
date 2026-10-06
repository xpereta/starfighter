import { WING_CUE } from '../../../data/content/cues';
import { TRAITS } from '../../../data/content/traits';
import { createCapitalBar, fillCapitalBar } from '../../core/enemies/capital-hud';
import type { PartRole } from '../../core/enemies/capital-parts';
import { createMissileWarning, missileWarning } from '../../core/enemies/enemy-missiles-warning';
import { lockLimit } from '../../core/lockon/lockon';
import { livingWingmen } from '../../core/squadron/squadron';
import type { World } from '../../core/world/world';
import {
  evadeReadiness,
  orderCueText,
  speedBar,
  squadronReadout,
  throttleState,
} from '../../render/hud/layout';
import { lockPanel } from '../../render/hud/locks';
import { cueText } from '../cues';
import { splitName } from './comm';
import type { Combo } from './combo';
import { multiplierOf, streakFill, tierOf } from './combo';
import type { PresentationDef } from './presentation';
import { hostileCount, pilotHull } from '../roster';

/**
 * What the spectacle HUD shows, as plain data computed from the world and the UI-only combo state.
 * Pure: no DOM, no world mutation. `hud-dom.ts` only maps this onto elements, so the numbers (hull
 * segments, pips, readiness, formatted score) are unit-tested here.
 */

export type Pip = 'on' | 'off';

export interface RosterCard {
  name: string;
  first: string;
  callsign: string;
  trait: string;
  /** One entry per hull point (empty for a fallen pilot). */
  hull: Pip[];
  fallen: boolean;
}

/** One part of the capital ship's bar (see `core/enemies/capital-hud.ts`). */
export interface CapitalSegment {
  role: PartRole;
  /** 0..1 of its hit points left; 0 when destroyed. */
  fraction: number;
  alive: boolean;
  /** A standing plate shields it. */
  covered: boolean;
  isCore: boolean;
  /** A plate that still shields the core. */
  coversCore: boolean;
}

/** The capital ship's health bar of parts, its caption and whether the core is bare. */
export interface CapitalModel {
  segments: CapitalSegment[];
  label: string;
  caption: string;
  exposed: boolean;
  dying: boolean;
  plates: { standing: number; total: number };
}

/** The MISSILE warning line: text with the nearest missile's time, and whether impact is close. */
export interface MissileModel {
  text: string;
  count: number;
  urgent: boolean;
}

export interface HudModel {
  inRun: boolean;
  hull: { pips: Pip[]; low: boolean; critical: boolean; text: string };
  objective: { battle: string; wave: string; hostiles: number } | null;
  score: string;
  kills: number;
  speed: { value: number; fill: number; corner: number; cruise: number; state: string };
  evade: { ready: boolean; fill: number };
  locks: {
    count: number;
    limit: number;
    pips: Pip[];
    salvoText: string;
    salvoReady: boolean;
    salvoFill: number;
    /** 0..1 lock-in progress of the target being acquired, 0 when none. */
    acquiring: number;
  };
  squad: { wingmen: string; formation: string; order: string | null; cue: string | null } | null;
  roster: RosterCard[];
  warning: string | null;
  /** Prototype 5 enemy cues, all null when there is nothing to say. */
  missile: MissileModel | null;
  /** WING INBOUND while a new wing is arriving. */
  cue: string | null;
  /** The capital ship's bar, while one is on the field. */
  capital: CapitalModel | null;
  trial: string | null;
  combo: {
    active: boolean;
    count: number;
    multiplier: string;
    fill: number;
    tier: string | null;
    call: string;
    pop: number;
    best: number;
  };
}

/** `003250`: the score padded to six digits (and never shorter, so the panel does not jump). */
export function scoreText(n: number): string {
  return String(Math.max(0, Math.round(n))).padStart(6, '0');
}

/** `on` pips for `value` out of `max` (rounded), `off` for the rest. At least one pip. */
export function pips(value: number, max: number): Pip[] {
  const total = Math.max(1, Math.round(max));
  const on = Math.max(0, Math.min(total, Math.round(value)));
  return Array.from({ length: total }, (_, i) => (i < on ? 'on' : 'off'));
}

/** `x2.5`: the multiplier as shown (one decimal only when it has one). */
export function multiplierText(m: number): string {
  return `x${Number.isInteger(m) ? m : m.toFixed(1)}`;
}

const warning = createMissileWarning();
const capitalBar = createCapitalBar();
/** Seconds to impact at or below which the MISSILE warning turns urgent. */
export const MISSILE_URGENT_ETA = 1.5;

/** The MISSILE line (null when no enemy missile is in flight). */
export function missileModel(world: World, def: PresentationDef): MissileModel | null {
  const w = missileWarning(world, warning);
  if (!w.active) return null;
  const words = def.enemies.cues;
  const head = w.count > 1 ? `${words.missiles} ${w.count}` : words.missile;
  const eta = Number.isFinite(w.eta) ? `  ${w.eta.toFixed(1)}s` : '';
  return { text: `${head}${eta}`, count: w.count, urgent: w.eta <= MISSILE_URGENT_ETA };
}

/** The capital ship's bar, or null with no ship, after it died or outside a battle (as the classic bar). */
export function capitalModel(world: World, def: PresentationDef): CapitalModel | null {
  const cap = world.enemies.capital;
  if (!cap || cap.phase === 2) return null;
  if (world.run.mode === 'run' && world.run.phase !== 'battle') return null;
  const bar = fillCapitalBar(capitalBar, cap);
  const words = def.enemies.cues;
  const caption =
    bar.phase !== 0
      ? words.breakingUp
      : bar.coreExposed
        ? words.coreExposed
        : `${words.coreShielded}  ${bar.corePlates.standing}/${bar.corePlates.total}`;
  return {
    segments: bar.segments.map((g) => ({
      role: g.role,
      fraction: g.fraction,
      alive: g.alive,
      covered: g.covered,
      isCore: g.isCore,
      coversCore: g.coversCore,
    })),
    label: words.capitalBar,
    caption,
    exposed: bar.coreExposed && bar.phase === 0,
    dying: bar.phase !== 0,
    plates: { standing: bar.corePlates.standing, total: bar.corePlates.total },
  };
}

/** The text cue (WING INBOUND), in the style's words. */
export function cueModel(world: World, def: PresentationDef): string | null {
  const text = cueText(world);
  return text === WING_CUE ? def.enemies.cues.wing : text;
}

export function buildHudModel(world: World, combo: Combo, def: PresentationDef): HudModel {
  const { run, tuning, ship, stats, trial } = world;
  const inRun = run.mode === 'run';
  const flight = tuning.flight;

  const maxHull = Math.max(1, tuning.run.playerHull);
  // Practice mode has no hull to lose: the bar shows full.
  const hullValue = inRun ? run.hull : maxHull;
  const hullFrac = hullValue / maxHull;
  const hull = {
    pips: pips(hullValue, maxHull),
    low: hullFrac <= def.feel.vignette.from * 0.7,
    critical: inRun && hullValue <= 1,
    text: inRun ? `${Math.max(0, Math.round(hullValue))}/${maxHull}` : '--',
  };

  const objective =
    inRun && run.phase === 'battle'
      ? {
          battle: `BATTLE ${run.battle}/${tuning.run.battleCount}`,
          wave: `WAVE ${Math.max(1, run.wave)}/${Math.max(1, run.waveTotal)}`,
          hostiles: hostileCount(world),
        }
      : null;

  const bar = speedBar(ship.speed, flight);
  const limit = lockLimit(world);
  const panel = lockPanel(
    world.lockon.locks.length,
    limit,
    world.missiles.salvo.cooldown,
    tuning.missiles.salvoCooldown,
  );
  const acquiring =
    world.lockon.acquiringId >= 0
      ? Math.max(0, Math.min(1, world.lockon.progress / tuning.lockon.lockTime))
      : 0;

  const ro = squadronReadout(
    world.squadron,
    livingWingmen(world.squadron),
    world.squadron.wingmen.length,
  );
  const cue = orderCueText(world.squadron);

  const roster: RosterCard[] = world.pilots.roster.map((p) => {
    const h = pilotHull(world, p);
    const { first, callsign } = splitName(p.name);
    return {
      name: p.name,
      first,
      callsign,
      trait: TRAITS[p.trait].label,
      hull: h ? pips(h.hp, h.max) : [],
      fallen: p.status === 'lost',
    };
  });

  const best = trial.best === null ? '--' : `${trial.best.toFixed(1)}s`;
  const trialText = trial.active
    ? `TRIAL ${trial.time.toFixed(1)}s  BEST ${best}`
    : inRun
      ? null
      : `T: TIME TRIAL  BEST ${best}`;

  return {
    inRun,
    hull,
    objective,
    score: scoreText(combo.score),
    kills: stats.kills,
    speed: {
      value: Math.round(ship.speed),
      fill: bar.fill,
      corner: bar.corner,
      cruise: bar.cruise,
      state: throttleState(world.actions.throttle, flight.throttleDeadband),
    },
    evade: {
      ready: evadeReadiness(ship.evadeCooldown, flight.evadeCooldown) >= 1,
      fill: evadeReadiness(ship.evadeCooldown, flight.evadeCooldown),
    },
    locks: {
      count: world.lockon.locks.length,
      limit,
      pips: pips(world.lockon.locks.length, limit),
      salvoText: panel.salvoText,
      salvoReady: panel.ready,
      salvoFill: panel.readiness,
      acquiring,
    },
    squad: ro
      ? {
          wingmen: ro.wingmen,
          formation: ro.formation,
          order: ro.order,
          cue,
        }
      : cue
        ? { wingmen: '', formation: '', order: null, cue }
        : null,
    roster,
    warning: ship.outside ? 'RETURN TO ARENA' : null,
    missile: missileModel(world, def),
    cue: cueModel(world, def),
    capital: capitalModel(world, def),
    trial: trialText,
    combo: {
      active: combo.count > 0,
      count: combo.count,
      multiplier: multiplierText(multiplierOf(combo.count, def.combo)),
      fill: streakFill(combo, def.combo),
      tier: tierOf(combo.count, def.combo),
      call: combo.callTimer > 0 ? combo.call : '',
      pop: combo.pop,
      best: combo.best,
    },
  };
}

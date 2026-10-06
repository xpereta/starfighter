import type { GameEvent } from '../../core/events/events';
import { clamp, DEG, wrapAngle } from '../../core/math';
import type { FeelDef, Impact, ImpactKey, PresentationDef } from './presentation';
import type { SpectacleSettings } from './settings';

/**
 * Camera and game feel, render side only. This reads the step's events and a few read-only numbers
 * (heading, hull) and produces a picture transform: a zoom punch, a roll into turns, extra screen
 * shake, a drawing-only freeze (hit-stop and the kill-cam), flashes and a tension vignette. It never
 * changes the world or the core camera, so the simulation and the replay hash are untouched. The
 * intensities come from the panel settings; 0 turns an effect off.
 */

export interface FeelState {
  /** Zoom punch amplitude 0..1, decays. */
  punch: number;
  /** Extra shake trauma 0..1, decays. */
  shake: number;
  /** Seconds left of a drawing-only freeze (hit-stop). */
  freeze: number;
  /** Kill-cam: seconds left and its total (0 = not running). */
  killCam: number;
  killCamTotal: number;
  killCamCooldown: number;
  /** How many enemies the last kill-cam counted (for its call-out). */
  killCamKills: number;
  /** Seconds left in which a kill counts as a missile kill, kills seen inside the open window, and its time left. */
  salvoLeft: number;
  windowKills: number;
  windowLeft: number;
  /** White flash 0..1 (kill-cam, big blasts) and red damage flash 0..1. */
  flash: number;
  damageFlash: number;
  /** Speed-line flash 0..1 (the kill-cam's burst). */
  speedFlash: number;
  /** Raw turn rate (rad/s, positive = counter-clockwise) seen over the last step, and the last heading. */
  turnRate: number;
  lastHeading: number | null;
  /** Smoothed roll, radians (positive = the picture turns clockwise, as the camera follows a left turn). */
  roll: number;
  /** Smoothed tension 0..1 (low hull) and the heartbeat phase. */
  tension: number;
  pulse: number;
}

export function createFeel(): FeelState {
  return {
    punch: 0,
    shake: 0,
    freeze: 0,
    killCam: 0,
    killCamTotal: 0,
    killCamCooldown: 0,
    killCamKills: 0,
    salvoLeft: 0,
    windowKills: 0,
    windowLeft: 0,
    flash: 0,
    damageFlash: 0,
    speedFlash: 0,
    turnRate: 0,
    lastHeading: null,
    roll: 0,
    tension: 0,
    pulse: 0,
  };
}

/** Forgets everything in flight (a menu came up, a new run). */
export function resetFeel(s: FeelState): void {
  Object.assign(s, createFeel());
}

const ENEMY_IMPACT: Partial<Record<string, ImpactKey>> = {
  drone: 'drone',
  fighter: 'fighter',
  gunship: 'gunship',
  turret: 'turret',
  static: 'static',
  wingman: 'wingman',
};

/** Decay rates (1/s) of the flashes, the seconds a speed-line flash lasts, and how fast the turn rate follows the heading. */
const FLASH_DECAY = 9;
const DAMAGE_FLASH_DECAY = 5;
const SPEED_FLASH_SECONDS = 0.7;
const TURN_BLEND = 0.35;

function apply(s: FeelState, i: Impact, def: FeelDef, st: SpectacleSettings): void {
  s.punch = clamp(s.punch + i.punch, 0, 1);
  s.shake = clamp(s.shake + i.shake, 0, 1);
  if (i.freeze > 0 && st.hitStop > 0) {
    s.freeze = Math.max(s.freeze, Math.min(def.maxFreeze, i.freeze * st.hitStop));
  }
}

/** Reads this step's events. Call once per simulation step (events live for one step). */
export function feedFeel(
  s: FeelState,
  events: readonly GameEvent[],
  def: PresentationDef,
  st: SpectacleSettings,
): void {
  const f = def.feel;
  for (const e of events) {
    switch (e.type) {
      case 'Killed': {
        const key = ENEMY_IMPACT[e.kind];
        if (key) apply(s, f.impacts[key], f, st);
        if (e.kind !== 'wingman' && s.salvoLeft > 0) {
          if (s.windowLeft <= 0) {
            s.windowLeft = f.killCam.window;
            s.windowKills = 0;
          }
          s.windowKills++;
          if (
            s.windowKills >= f.killCam.kills &&
            s.killCamCooldown <= 0 &&
            st.killCam > 0 &&
            st.enabled
          ) {
            s.killCamTotal = f.killCam.freeze * Math.min(1, st.killCam);
            s.killCam = s.killCamTotal;
            s.killCamCooldown = f.killCam.cooldown;
            s.killCamKills = s.windowKills;
            s.flash = 1;
            s.speedFlash = 1;
            s.punch = 1;
            s.shake = clamp(s.shake + 0.5, 0, 1);
            s.windowKills = 0;
            s.windowLeft = 0;
          }
        }
        break;
      }
      case 'SalvoFired':
        apply(s, f.impacts.salvo, f, st);
        s.salvoLeft = f.killCam.salvoWindow;
        s.windowKills = 0;
        s.windowLeft = 0;
        break;
      case 'MissileImpact':
        apply(s, f.impacts.missileImpact, f, st);
        break;
      case 'PartDestroyed':
        apply(s, f.impacts.capitalPart, f, st);
        if (e.role === 'core') s.flash = Math.max(s.flash, 0.6);
        break;
      case 'CapitalDestroyed':
        apply(s, f.impacts.capital, f, st);
        s.flash = 1;
        break;
      case 'Hit':
        apply(s, f.impacts.hit, f, st);
        break;
      case 'PlayerDamaged':
        apply(s, f.impacts.damage, f, st);
        s.damageFlash = 1;
        break;
      case 'PodRescued':
        apply(s, f.impacts.rescue, f, st);
        break;
      case 'BattleCleared':
        apply(s, f.impacts.cleared, f, st);
        s.flash = Math.max(s.flash, 0.5);
        break;
      case 'PilotLost':
        apply(s, f.impacts.lost, f, st);
        break;
      default:
        break;
    }
  }
}

/** Notes the player's heading after a simulation step of `dt` seconds (the roll follows the turn rate). */
export function observeTurn(s: FeelState, heading: number, dt: number, def: PresentationDef): void {
  if (s.lastHeading !== null && dt > 0) {
    const raw = wrapAngle(heading - s.lastHeading) / dt;
    const cap = def.feel.turnRateFull * 1.5;
    s.turnRate += (clamp(raw, -cap, cap) - s.turnRate) * TURN_BLEND;
  }
  s.lastHeading = heading;
}

/**
 * Advances the effects by a frame of `dt` seconds of wall time. `hullFraction` is the player's hull
 * from 1 (full) to 0, or null when there is no hull to show (practice mode).
 */
export function stepFeel(
  s: FeelState,
  dt: number,
  def: PresentationDef,
  st: SpectacleSettings,
  hullFraction: number | null,
): void {
  const f = def.feel;
  s.punch *= Math.exp(-f.punchDecay * dt);
  s.shake *= Math.exp(-f.shakeDecay * dt);
  s.flash *= Math.exp(-FLASH_DECAY * dt);
  s.damageFlash *= Math.exp(-DAMAGE_FLASH_DECAY * dt);
  s.speedFlash = Math.max(0, s.speedFlash - dt / SPEED_FLASH_SECONDS);
  s.freeze = Math.max(0, s.freeze - dt);
  s.killCam = Math.max(0, s.killCam - dt);
  s.killCamCooldown = Math.max(0, s.killCamCooldown - dt);
  s.salvoLeft = Math.max(0, s.salvoLeft - dt);
  s.windowLeft = Math.max(0, s.windowLeft - dt);
  if (s.windowLeft <= 0) s.windowKills = 0;

  const rollTarget =
    clamp(s.turnRate / f.turnRateFull, -1, 1) * f.maxRollDeg * DEG * Math.max(0, st.roll);
  s.roll += (rollTarget - s.roll) * (1 - Math.exp(-f.rollSmooth * dt));

  const tensionTarget =
    hullFraction === null || hullFraction >= f.vignette.from
      ? 0
      : clamp(1 - hullFraction / f.vignette.from, 0, 1);
  s.tension += (tensionTarget - s.tension) * (1 - Math.exp(-3 * dt));
  s.pulse += dt * f.vignette.pulseHz * Math.PI * 2 * (1 + s.tension);
}

/** What the picture should look like this frame. */
export interface FeelOutput {
  /** CSS scale of the world picture (zoom punch and the extra fill the roll needs). */
  scale: number;
  /** CSS rotation, radians (positive = clockwise). */
  roll: number;
  /** Extra shake offset, CSS px. */
  shakeX: number;
  shakeY: number;
  /** True while the picture is frozen (hit-stop or the kill-cam): skip drawing the world. */
  frozen: boolean;
  /** Kill-cam progress: 0 when idle, 1 -> 0 over its freeze, for the overlay. */
  killCam: number;
  /** Enemies the kill-cam counted, for its call-out. */
  killCamKills: number;
  /** White flash 0..1. */
  flash: number;
  /** Red damage flash 0..1. */
  damage: number;
  /** Tension vignette strength 0..1 (includes the heartbeat). */
  vignette: number;
  /** Speed-line flash 0..1. */
  speedFlash: number;
}

/** The extra zoom that keeps a screen of the given aspect covered while it is rotated by `angle`. */
export function rollFill(angle: number, aspect: number): number {
  const a = Math.abs(angle);
  const long = Math.max(aspect, 1 / Math.max(aspect, 1e-6));
  return Math.cos(a) + Math.sin(a) * long;
}

export function feelOutput(
  s: FeelState,
  def: PresentationDef,
  st: SpectacleSettings,
  time: number,
  aspect: number,
): FeelOutput {
  const f = def.feel;
  const zoom = 1 + f.maxZoom * s.punch * Math.max(0, st.zoomPunch);
  const amp = s.shake * s.shake * f.maxShakePx * Math.max(0, st.shake);
  const beat = 0.65 + 0.35 * Math.sin(s.pulse);
  return {
    scale: zoom * rollFill(s.roll, aspect),
    roll: s.roll,
    shakeX: amp > 0.01 ? Math.sin(time * 57) * amp : 0,
    shakeY: amp > 0.01 ? Math.cos(time * 73) * amp : 0,
    frozen: s.freeze > 0 || s.killCam > 0,
    killCam: s.killCam > 0 && s.killCamTotal > 0 ? s.killCam / s.killCamTotal : 0,
    killCamKills: s.killCamKills,
    flash: s.flash * Math.min(1, Math.max(st.killCam, st.speedFlash)),
    damage: s.damageFlash * Math.min(1, st.vignette),
    vignette: s.tension * beat * Math.min(1.5, st.vignette),
    speedFlash: s.speedFlash * st.speedFlash,
  };
}

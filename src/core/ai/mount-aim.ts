import type { WeaponMount } from '../enemies/mounts';
import { wrapAngle } from '../math';

/**
 * Pure helpers for weapon mounts (spec section 1): firing arcs, swinging an aim, burst windows.
 * Angles are radians relative to the ship heading unless said otherwise.
 */

/** Live state of one mount on a ship. All of it is in the replay hash (`mixFighters`). */
export interface MountState {
  /** Where the barrel points now, relative to the heading (rad). Always inside the arc. */
  aim: number;
  /** Seconds until the next shot. Counts below zero between steps; the remainder is kept so the rate is exact. */
  cooldown: number;
  /** Shots left in the current burst. */
  burstLeft: number;
  /** Seconds left of the pause between bursts (no fire while above 0). */
  pause: number;
}

/** A fresh mount at rest: aim at the middle of its arc, a full burst ready. */
export function createMountState(mount: WeaponMount): MountState {
  return { aim: mount.arcCenter, cooldown: 0, burstLeft: mount.burst.shots, pause: 0 };
}

/** True when `angle` (relative to the heading) lies inside the arc `center +- half`. pi = all round. */
export function inArc(angle: number, center: number, half: number): boolean {
  return Math.abs(wrapAngle(angle - center)) <= half;
}

/** The nearest angle inside the arc: `angle` itself when inside, else the closer edge. */
export function clampToArc(angle: number, center: number, half: number): number {
  const off = wrapAngle(angle - center);
  if (Math.abs(off) <= half) return angle;
  return wrapAngle(center + Math.sign(off) * half);
}

/** Turns `current` towards `target` by at most `maxStep` the short way round. */
export function slewAngle(current: number, target: number, maxStep: number): number {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxStep) return wrapAngle(target);
  return wrapAngle(current + Math.sign(diff) * maxStep);
}

/**
 * Advances one mount's fire timers by `dt` and says whether it fires this step. `wantFire` is "a
 * target is in arc, in range and under the barrel". A burst is `burst.shots` shots at `fireRate`;
 * after it the mount pauses `burst.pause` seconds (the window for the player). `shots` of 1 means
 * no bursts: a steady stream with no pause.
 */
export function stepBurst(
  state: MountState,
  burst: WeaponMount['burst'],
  fireRate: number,
  dt: number,
  wantFire: boolean,
): boolean {
  state.cooldown -= dt;
  state.pause = Math.max(0, state.pause - dt);
  if (!wantFire || state.pause > 0 || state.cooldown > 0) return false;
  // Carry the remainder of the interval, but never bank more than one step of it.
  state.cooldown = Math.max(state.cooldown, -dt) + 1 / fireRate;
  state.burstLeft--;
  if (state.burstLeft <= 0) {
    state.burstLeft = burst.shots;
    if (burst.shots > 1) state.pause = burst.pause;
  }
  return true;
}

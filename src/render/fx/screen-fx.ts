import * as THREE from 'three';
import type { QualitySettings } from '../../../data/quality';
import { palette } from '../palette';
import { activeStyle } from '../style-active';
import type { DeathFxHooks } from './death-fx';

/** The panel's switch for every screen effect (flash frames, hit-stop, speed lines). */
export const screenFxSettings = { enabled: true };

/** Brightest the flash gets (share of full white-out) and the longest a hit-stop may last (s). */
const FLASH_PEAK = 0.55;
const MAX_HIT_STOP = 0.12;
const FRAME_SECONDS = 1 / 60;
/** Speed lines appear above this share of top speed and reach full strength at 1. */
const SPEED_LINES_FROM = 0.7;
const LINES = 32;
/** Streak geometry in shares of the view's half height: inner radius range and length range. */
const LINE_INNER = [0.35, 0.8] as const;
const LINE_LENGTH = [0.18, 0.5] as const;
const LINE_OPACITY = 0.5;
/** The streaks re-roll this many times per second, so they flicker like drawn speed lines. */
const LINE_FLICKER_HZ = 16;

export interface ScreenView {
  x: number;
  y: number;
  /** Visible world size, u. */
  width: number;
  height: number;
}

export interface ScreenFx {
  readonly speedLines: THREE.LineSegments;
  readonly hooks: DeathFxHooks;
  /**
   * Advances the effects by a frame. Returns true while the picture is frozen (hit-stop): the
   * caller should then draw the previous frame again instead of updating the scene.
   */
  update(dt: number, view: ScreenView, speedFactor: number, time: number): boolean;
  dispose(): void;
}

const hash = (n: number): number => {
  let h = Math.imul(n | 0, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

/**
 * The render-only screen effects: a full-screen flash on big blasts (a DOM layer, `container`),
 * a drawing-only freeze (hit-stop) and speed lines. All scale with `quality.screenFx` and stop
 * when `screenFxSettings.enabled` is false or the strength is 0.
 */
export function createScreenFx(container: HTMLElement, quality: QualitySettings): ScreenFx {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;pointer-events:none;opacity:0;z-index:1;background:#fff;';
  container.appendChild(overlay);

  const positions = new Float32Array(LINES * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(positions, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attr);
  geometry.setDrawRange(0, 0);
  const material = new THREE.LineBasicMaterial({
    color: palette.dust,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.renderOrder = 20;
  lines.position.z = 0.9;

  const strength = (): number => (screenFxSettings.enabled ? quality.screenFx : 0);
  let flashLeft = 0;
  let flashTotal = 1;
  let flashStrength = 0;
  let stopLeft = 0;

  return {
    speedLines: lines,
    hooks: {
      flash(frames, color) {
        const s = strength();
        if (s <= 0 || frames <= 0) return;
        // Overlapping blasts keep the brighter, longer flash.
        const dur = frames * FRAME_SECONDS;
        if (flashLeft <= 0 || s >= flashStrength || dur > flashLeft) {
          flashLeft = dur;
          flashTotal = dur;
          flashStrength = s;
          overlay.style.background = `#${color.toString(16).padStart(6, '0')}`;
        }
      },
      hitStop(seconds) {
        const s = strength();
        if (s <= 0 || seconds <= 0) return;
        stopLeft = Math.max(stopLeft, Math.min(MAX_HIT_STOP, seconds * s));
      },
    },
    update(dt, view, speedFactor, time) {
      // Flash.
      if (flashLeft > 0) {
        flashLeft -= dt;
        overlay.style.opacity = String(
          Math.max(0, (flashLeft / flashTotal) * FLASH_PEAK * flashStrength),
        );
      } else if (overlay.style.opacity !== '0') overlay.style.opacity = '0';

      // Speed lines.
      const amount =
        strength() *
        activeStyle().theme.speedLines *
        Math.min(1, Math.max(0, (speedFactor - SPEED_LINES_FROM) / (1 - SPEED_LINES_FROM)));
      if (amount > 0) {
        const half = view.height / 2;
        const frame = Math.floor(time * LINE_FLICKER_HZ);
        for (let i = 0; i < LINES; i++) {
          const a = ((i + hash(frame * 131 + i) * 0.8) / LINES) * Math.PI * 2;
          const inner =
            half * (LINE_INNER[0] + (LINE_INNER[1] - LINE_INNER[0]) * hash(frame * 17 + i * 3));
          const len =
            half * (LINE_LENGTH[0] + (LINE_LENGTH[1] - LINE_LENGTH[0]) * hash(frame * 29 + i * 7));
          const c = Math.cos(a);
          const s = Math.sin(a);
          const o = i * 6;
          positions[o] = view.x + c * inner;
          positions[o + 1] = view.y + s * inner;
          positions[o + 3] = view.x + c * (inner + len);
          positions[o + 4] = view.y + s * (inner + len);
        }
        geometry.setDrawRange(0, LINES * 2);
        attr.needsUpdate = true;
        material.opacity = amount * LINE_OPACITY;
      } else geometry.setDrawRange(0, 0);

      // Hit-stop: the caller keeps the last picture while this is true.
      if (stopLeft > 0) {
        stopLeft -= dt;
        return true;
      }
      return false;
    },
    dispose() {
      overlay.remove();
      geometry.dispose();
      material.dispose();
    },
  };
}

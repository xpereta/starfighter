import type { GameEvent } from '../../core/events/events';
import { viewSize } from '../../core/camera/view';
import type { World } from '../../core/world/world';
import { menuVisible } from '../menu-model';
import { spectacleOn } from './active';
import {
  createFeel,
  feedFeel,
  feelOutput,
  observeTurn,
  resetFeel,
  stepFeel,
  type FeelOutput,
  type FeelState,
} from './feel';
import { collectIndicators, type Indicator } from './indicators';
import type { PresentationDef } from './presentation';
import { setPreviewTarget } from './preview';
import { drawScreenLayer } from './screen-layer';
import { spectacle } from './settings';
import { drawWorldLayer } from './world-layer';

/**
 * The spectacle layer's controller: owns the effect states, two overlay canvases (world-anchored and
 * screen-space) and the CSS transform of the world picture (zoom punch, roll, extra shake). All
 * render and UI side: it reads the world and its events, and never writes either.
 *
 * Frame order in `app/main.ts`: `step` after every simulation step, `update` once per frame before
 * the renderer (it says whether the picture is frozen), `draw` once per frame after it.
 */

export interface Spectacle {
  readonly feel: FeelState;
  /** Feeds synthetic events to the effects only (never to the world): the dev panel's previews and the tests. */
  inject(events: readonly GameEvent[]): void;
  /** Once per simulation step, after the world step (reads this step's events). */
  step(world: World, dt: number): void;
  /** Once per frame: advances the effects and moves the world picture. Returns true while it is frozen (do not draw the world). */
  update(world: World, frameDt: number, now: number): { frozen: boolean };
  /** Once per frame, after the world was drawn. */
  draw(world: World, now: number): void;
  dispose(): void;
}

const pulseLife = 1;

export function createSpectacle(container: HTMLElement, def: PresentationDef): Spectacle {
  const worldCanvas = document.createElement('canvas');
  worldCanvas.id = 'spectacle-world';
  const screenCanvas = document.createElement('canvas');
  screenCanvas.id = 'spectacle-screen';
  const base = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;';
  worldCanvas.style.cssText = `${base}z-index:1;will-change:transform;`;
  screenCanvas.style.cssText = `${base}z-index:2;`;
  container.append(worldCanvas, screenCanvas);
  const wg = worldCanvas.getContext('2d');
  const sg = screenCanvas.getContext('2d');
  if (!wg || !sg) throw new Error('2D canvas is not available for the spectacle layer');
  // The renderer's canvas: the first canvas without an id that the app appended.
  const picture = container.querySelector<HTMLCanvasElement>(':scope > canvas:not([id])');

  const screen = { width: 0, height: 0 };
  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    screen.width = window.innerWidth;
    screen.height = window.innerHeight;
    for (const c of [worldCanvas, screenCanvas]) {
      c.width = Math.round(screen.width * dpr);
      c.height = Math.round(screen.height * dpr);
    }
    wg!.setTransform(dpr, 0, 0, dpr, 0, 0);
    sg!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const feel = createFeel();
  const pulses = new Map<number, number>();
  const indicators: Indicator[] = [];
  let out: FeelOutput = feelOutput(feel, def, spectacle, 0, 1.6);
  let appliedTransform = '';
  let wasOn = false;

  function setTransform(value: string): void {
    if (value === appliedTransform) return;
    appliedTransform = value;
    if (picture) picture.style.transform = value;
    worldCanvas.style.transform = value;
  }

  let hidden = false;
  function hide(value: boolean): void {
    if (value === hidden) return;
    hidden = value;
    worldCanvas.style.display = value ? 'none' : '';
    screenCanvas.style.display = value ? 'none' : '';
  }

  function off(): void {
    if (wasOn) {
      wasOn = false;
      resetFeel(feel);
      pulses.clear();
      setTransform('');
    }
    hide(true);
  }

  const inject = (events: readonly GameEvent[]): void => {
    if (spectacleOn()) feedFeel(feel, events, def, spectacle);
  };
  setPreviewTarget(inject);

  return {
    feel,
    inject,
    step(world, dt) {
      if (!spectacleOn()) return off();
      wasOn = true;
      if (world.run.mode === 'run' && menuVisible(world.run)) {
        resetFeel(feel); // nothing in flight behind a menu
        return;
      }
      const events = world.events.events;
      feedFeel(feel, events, def, spectacle);
      observeTurn(feel, world.ship.heading, dt, def);
      for (const e of events) {
        if (e.type === 'LockAcquired') pulses.set(e.targetId, 0);
        else if (e.type === 'LockLost') pulses.delete(e.targetId);
      }
    },
    update(world, frameDt, now) {
      if (!spectacleOn()) {
        off();
        return { frozen: false };
      }
      hide(false);
      wasOn = true;
      const hull =
        world.run.mode === 'run' && world.run.phase === 'battle'
          ? world.run.hull / Math.max(1, world.tuning.run.playerHull)
          : null;
      stepFeel(feel, frameDt, def, spectacle, hull);
      for (const [id, age] of pulses) {
        if (age + frameDt > pulseLife) pulses.delete(id);
        else pulses.set(id, age + frameDt);
      }
      out = feelOutput(feel, def, spectacle, now, world.camera.aspect);
      // A frozen picture keeps the transform it froze with (the punch is part of the impact frame).
      if (!out.frozen) {
        // The picture grows by the shake it moves, so its edges never show.
        const shake = Math.max(Math.abs(out.shakeX), Math.abs(out.shakeY));
        const scale =
          out.scale * (1 + (2 * shake) / Math.max(1, Math.min(screen.width, screen.height)));
        setTransform(
          `translate(${out.shakeX.toFixed(2)}px, ${out.shakeY.toFixed(2)}px) rotate(${out.roll.toFixed(5)}rad) scale(${scale.toFixed(4)})`,
        );
      }
      return { frozen: out.frozen };
    },
    draw(world, now) {
      if (!spectacleOn()) return;
      const cam = world.camera;
      const center = { x: cam.x + cam.shakeX, y: cam.y + cam.shakeY };
      const view = viewSize(cam.view, cam.aspect);
      if (!out.frozen) {
        wg.clearRect(0, 0, screen.width, screen.height);
        wg.textBaseline = 'alphabetic';
        drawWorldLayer(wg, {
          world,
          center,
          view,
          screen,
          time: now,
          pulses,
          dramatic: spectacle.locks,
          colors: def.colors,
        });
      }
      sg.clearRect(0, 0, screen.width, screen.height);
      if (spectacle.indicators)
        collectIndicators(indicators, world, center, view, screen, world.tuning.hud);
      else indicators.length = 0;
      drawScreenLayer(sg, {
        screen,
        time: now,
        feel: out,
        indicators,
        showIndicators: spectacle.indicators,
        colors: def.colors,
      });
    },
    dispose() {
      window.removeEventListener('resize', resize);
      setPreviewTarget(null);
      setTransform('');
      worldCanvas.remove();
      screenCanvas.remove();
    },
  };
}

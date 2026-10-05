import * as THREE from 'three';
import type { QualityLevel } from '../../../data/quality';
import { spectacleQualityPresets } from '../../../data/spectacle-quality';
import type { GameEvent } from '../../core/events/events';
import type { World } from '../../core/world/world';
import { palette } from '../palette';
import { activeStyle } from '../style-active';
import { createBackdrop, type Backdrop, type BackdropStats } from './backdrop';
import { createPost, type Post } from './post';
import { createShipFx, type ShipFx, type ShipFxStats } from './ship-fx';
import { currentFxLevel, fxLevelRevision, spectacleSettings } from './settings';

/** What the renderer tells the spectacle each frame. */
export interface SpectacleFrame {
  /** Wall-clock seconds since the last frame, and wall-clock seconds for animation. */
  dt: number;
  time: number;
  /** Camera centre and visible world size (u). */
  camX: number;
  camY: number;
  viewW: number;
  viewH: number;
  /** 0..1 of the ship's speed range. */
  speedFactor: number;
}

/**
 * The scene objects of the spectacle (no GL needed: the tests run it headless over a simulation).
 * Parts exist only for the sections the active style has, and hide when their switch is off.
 */
export interface SpectaclePartsStats {
  backdrop: BackdropStats | null;
  ships: ShipFxStats | null;
}

export interface SpectacleParts {
  readonly object: THREE.Group;
  /** Feed each simulation step's events. */
  consume(events: readonly GameEvent[]): void;
  /** Per frame, after the scene is updated and before drawing. */
  update(frame: SpectacleFrame): void;
  /** The sky colour to clear to, or null to leave the style's own background. */
  skyColor(): number | null;
  stats(): SpectaclePartsStats;
  dispose(): void;
}

export function createSpectacleParts(world: World, level: QualityLevel): SpectacleParts {
  const quality = spectacleQualityPresets[level];
  const group = new THREE.Group();
  let backdrop: Backdrop | null = null;
  let shipFx: ShipFx | null = null;
  let sky: number | null = null;

  const spec = () => activeStyle().spectacle;

  return {
    object: group,
    consume(events) {
      const s = spec();
      if (!s) return;
      for (const e of events) {
        if (e.type === 'Killed') backdrop?.excite(e.kind === 'turret' ? 1 : 0.4);
      }
      if (spectacleSettings.ships) shipFx?.consume(events);
    },
    update(f) {
      const s = spec();
      const on = s?.backdrop !== undefined && spectacleSettings.backdrop;
      if (s?.backdrop && !backdrop) {
        backdrop = createBackdrop(quality, world.seed);
        group.add(backdrop.object);
      }
      sky = null;
      if (backdrop && s?.backdrop) {
        let enemies = 0;
        for (const fighter of world.fighters) if (fighter.alive) enemies++;
        backdrop.update(
          {
            camX: f.camX,
            camY: f.camY,
            viewW: f.viewW,
            viewH: f.viewH,
            time: f.time,
            dt: f.dt,
            battle: spectacleSettings.sky || (world.run.mode === 'run' ? world.run.battle : 0),
            enemies,
          },
          s.backdrop,
          on,
        );
        if (on) sky = backdrop.skyColor();
      } else if (backdrop) backdrop.object.visible = false;

      if (s?.ships && !shipFx) {
        shipFx = createShipFx(world, quality);
        group.add(shipFx.object);
      }
      if (shipFx) {
        if (s?.ships)
          shipFx.update(
            { dt: f.dt, time: f.time, speedFactor: f.speedFactor },
            s.ships,
            spectacleSettings.ships,
          );
        else shipFx.object.visible = false;
      }
    },
    skyColor: () => sky,
    stats: () => ({
      backdrop: backdrop?.object.visible ? backdrop.stats() : null,
      ships: shipFx?.object.visible ? shipFx.stats() : null,
    }),
    dispose() {
      backdrop?.dispose();
      backdrop = null;
      shipFx?.dispose();
      shipFx = null;
      group.clear();
    },
  };
}

/**
 * The render-only spectacle of a style pack: post-processing and the scene parts (backdrop and,
 * in later parts, ship and combat effects, cards). Everything is built lazily the first time a
 * spectacle pack is on, so `plain` and `anime-80s` pay nothing; with another pack (or a peek at
 * one) the plain render runs.
 */
export interface Spectacle {
  /** True while the active style has a spectacle. */
  active(): boolean;
  /** Feed each simulation step's events. */
  consume(events: readonly GameEvent[]): void;
  /** Per frame, after the scene is updated and before drawing. */
  update(frame: SpectacleFrame): void;
  /** Draws the scene (through the post passes when they are on). */
  render(dt: number, time: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export function createSpectacle(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  world: World,
): Spectacle {
  let post: Post | null = null;
  let parts: SpectacleParts | null = null;
  let builtFor = -1;
  let ownsBackground = false;
  let size = { w: 1, h: 1 };

  const quality = () => spectacleQualityPresets[currentFxLevel()];
  const spec = () => activeStyle().spectacle;

  /** (Re)builds the passes and parts for the current quality level. */
  function ensure(): void {
    const rev = fxLevelRevision();
    if (rev === builtFor) return;
    builtFor = rev;
    post?.dispose();
    post = null;
    if (parts) {
      scene.remove(parts.object);
      parts.dispose();
    }
    parts = createSpectacleParts(world, currentFxLevel());
    scene.add(parts.object);
    // Pool readout for the screenshot and frame-time scripts (and a look in the console).
    (globalThis as { __spectacle?: unknown }).__spectacle = {
      stats: () => parts?.stats() ?? null,
      level: currentFxLevel(),
      settings: spectacleSettings,
    };
    if (quality().post > 0) {
      post = createPost(renderer, scene, camera, quality());
      post?.resize(size.w, size.h);
    }
  }

  const restoreBackground = (): void => {
    if (!ownsBackground) return;
    ownsBackground = false;
    (scene.background as THREE.Color).setHex(palette.background);
  };

  return {
    active: () => spec() !== null,
    consume(events) {
      if (!spec()) return;
      parts?.consume(events);
      if (!post) return;
      for (const e of events) {
        if (e.type === 'PlayerDamaged') post.hit(1);
        else if (e.type === 'WingmanDown') post.hit(0.5);
        else if (e.type === 'Killed') post.hit(0.3);
      }
    },
    update(frame) {
      if (!spec()) {
        if (parts) parts.object.visible = false;
        restoreBackground();
        return;
      }
      ensure();
      parts!.object.visible = true;
      parts!.update(frame);
      const sky = parts!.skyColor();
      if (sky !== null) {
        (scene.background as THREE.Color).setHex(sky);
        ownsBackground = true;
      } else restoreBackground();
    },
    render(dt, time) {
      const s = spec();
      if (s?.post && post && post.render(dt, time, s.post)) return;
      renderer.render(scene, camera);
    },
    resize(width, height) {
      size = { w: width, h: height };
      post?.resize(width, height);
    },
    dispose() {
      post?.dispose();
      post = null;
      if (parts) {
        scene.remove(parts.object);
        parts.dispose();
        parts = null;
      }
    },
  };
}

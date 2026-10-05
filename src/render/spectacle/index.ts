import type * as THREE from 'three';
import { spectacleQualityPresets } from '../../../data/spectacle-quality';
import type { GameEvent } from '../../core/events/events';
import { activeStyle } from '../style-active';
import { createPost, type Post } from './post';
import { currentFxLevel, fxLevelRevision } from './settings';

/** What the renderer tells the spectacle each frame. */
export interface SpectacleFrame {
  /** Wall-clock seconds since the last frame. */
  dt: number;
  /** Wall-clock seconds, for animation. */
  time: number;
}

/**
 * The render-only spectacle of a style pack (post-processing and, in later parts, backdrop, ship
 * and combat effects, cards). Everything is built lazily the first time a spectacle pack is on, so
 * `plain` and `anime-80s` pay nothing; with another pack (or a peek at one) the plain render runs.
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
): Spectacle {
  let post: Post | null = null;
  let postFor = -1;
  let size = { w: 1, h: 1 };

  const quality = () => spectacleQualityPresets[currentFxLevel()];
  const spec = () => activeStyle().spectacle;

  /** Builds the post passes for the current quality level (rebuilt when the level changes). */
  function ensurePost(): void {
    const rev = fxLevelRevision();
    if (rev === postFor) return;
    postFor = rev;
    post?.dispose();
    post = null;
    if (quality().post > 0) {
      post = createPost(renderer, scene, camera, quality());
      post?.resize(size.w, size.h);
    }
  }

  return {
    active: () => spec() !== null,
    consume(events) {
      if (!spec() || !post) return;
      for (const e of events) {
        if (e.type === 'PlayerDamaged') post.hit(1);
        else if (e.type === 'WingmanDown') post.hit(0.5);
        else if (e.type === 'Killed') post.hit(0.3);
      }
    },
    update() {
      if (spec()) ensurePost();
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
    },
  };
}

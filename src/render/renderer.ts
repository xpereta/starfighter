import * as THREE from 'three';
import { clamp } from '../core/math';
import type { World } from '../core/world/world';
import type { GameEvent } from '../core/events/events';
import { createBackground } from './background';
import { qualityPresets, type QualityLevel } from '../../data/quality';
import { createBulletRenderer } from './bullets';
import { createFighterRenderer } from './fighters';
import { createWingmanRenderer } from './wingmen';
import { createMissileRenderer } from './missiles';
import { viewSize } from '../core/camera/view';
import { createShards } from './shards';
import { createDeathFx } from './fx/death-fx';
import { createScreenFx } from './fx/screen-fx';
import { createSparks } from './sparks';
import { createPodRenderer } from './pods';
import { createTargetRenderer } from './targets';
import { palette } from './palette';
import { styleRevision } from './style-active';
import { createShipArt, rollSquash } from './ship-art';

/** The player's shape is authored in radius units; this is its drawn size (about 100 u long). */
const PLAYER_SCALE = 60;

export interface Renderer {
  /** Feed each simulation step's events (FX attach here). */
  consumeEvents(events: readonly GameEvent[]): void;
  render(world: World): void;
  dispose(): void;
}

export function createRenderer(
  container: HTMLElement,
  world: World,
  quality: QualityLevel = 'high',
): Renderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.background);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

  const background = createBackground();
  scene.add(background.object);

  const bullets = createBulletRenderer(world.bullets.capacity);
  scene.add(bullets.object);
  const enemyShots = createBulletRenderer(world.enemyShots.capacity, palette.enemyShot, {
    length: 14,
    width: 14,
  });
  scene.add(enemyShots.object);
  const missiles = createMissileRenderer(world.missiles.capacity);
  scene.add(missiles.object);
  const targets = createTargetRenderer(world.targets);
  scene.add(targets.object);
  const fighters = createFighterRenderer();
  scene.add(fighters.object);
  const wingmen = createWingmanRenderer();
  scene.add(wingmen.object);
  const pods = createPodRenderer();
  scene.add(pods.object);
  const sparks = createSparks();
  scene.add(sparks.object);
  const shards = createShards(qualityPresets[quality]);
  scene.add(shards.object);
  // Death sequences (styles that define them) and the screen effects; plain keeps the shards.
  const screenFx = createScreenFx(container, qualityPresets[quality]);
  scene.add(screenFx.speedLines);
  const deathFx = createDeathFx(qualityPresets[quality], world, screenFx.hooks);
  scene.add(deathFx.object);
  let lastTime = performance.now();
  let seenRevision = styleRevision();

  const shipArt = createShipArt('player', () => palette.friendly);
  scene.add(shipArt.object);

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    consumeEvents(events) {
      sparks.consume(events);
      deathFx.consume(events);
      shards.consume(events, (kind) => deathFx.handles(kind));
    },
    render(world) {
      const { ship: s } = world;
      const { minSpeed, maxSpeed } = world.tuning.flight;
      // A live style edit or a peek changes the background colour too.
      if (styleRevision() !== seenRevision) {
        seenRevision = styleRevision();
        (scene.background as THREE.Color).setHex(palette.background);
      }
      const now = performance.now();
      const frameDt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      // Camera state comes from core/camera; the visible area is the same on every screen shape.
      const cam = world.camera;
      const view = viewSize(cam.view, cam.aspect);
      const speedFactor = clamp((s.speed - minSpeed) / (maxSpeed - minSpeed), 0, 1);
      // Hit-stop is drawing only: the simulation keeps running, the picture is simply not updated.
      const frozen = screenFx.update(
        frameDt,
        { x: cam.x, y: cam.y, width: view.width, height: view.height },
        speedFactor,
        now / 1000,
      );
      if (frozen) {
        renderer.render(scene, camera);
        return;
      }
      camera.left = -view.width / 2;
      camera.right = view.width / 2;
      camera.top = view.height / 2;
      camera.bottom = -view.height / 2;
      camera.updateProjectionMatrix();
      camera.position.set(cam.x + cam.shakeX, cam.y + cam.shakeY, 0);
      shipArt.update({
        x: s.x,
        y: s.y,
        heading: s.heading,
        scale: PLAYER_SCALE,
        squash: rollSquash(s.roll), // evade roll: the wingspan squashes like a barrel roll seen from above
        thrust: speedFactor,
      });
      background.update(cam.x, cam.y, s.vx, s.vy, speedFactor);
      bullets.update(world.bullets);
      enemyShots.update(world.enemyShots);
      targets.update(world.targets);
      fighters.update(world.fighters);
      wingmen.update(world.squadron.wingmen, world.tuning.squadron.radius);
      pods.update(world.pods, world.tuning.rescue.podRadius);
      missiles.update(world, frameDt);
      sparks.update(frameDt);
      shards.update(frameDt);
      deathFx.update(frameDt);
      renderer.render(scene, camera);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      background.dispose();
      bullets.dispose();
      sparks.dispose();
      shards.dispose();
      deathFx.dispose();
      screenFx.dispose();
      targets.dispose();
      fighters.dispose();
      wingmen.dispose();
      pods.dispose();
      enemyShots.dispose();
      missiles.dispose();
      shipArt.dispose();
      renderer.dispose();
    },
  };
}

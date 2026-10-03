import * as THREE from 'three';
import { clamp } from '../core/math';
import type { World } from '../core/world/world';
import type { GameEvent } from '../core/events/events';
import { createBackground } from './background';
import { qualityPresets, type QualityLevel } from '../../data/quality';
import { createBulletRenderer } from './bullets';
import { createMissileRenderer } from './missiles';
import { createFighterRenderer } from './fighters';
import { createWingmanRenderer } from './wingmen';
import { viewSize } from '../core/camera/view';
import { createShards } from './shards';
import { createSparks } from './sparks';
import { createTargetRenderer } from './targets';
import { palette } from './palette';

/** Narrowest the ship gets mid-roll, so it never vanishes. */
const MIN_ROLL_WIDTH = 0.15;

export interface Renderer {
  /** Feed each simulation step's events (FX attach here). */
  consumeEvents(events: readonly GameEvent[]): void;
  render(world: World): void;
  dispose(): void;
}

/** Flat fighter silhouette, nose along +y, about 100 u long. */
function fighterShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 60);
  s.lineTo(9, 28);
  s.lineTo(14, 4);
  s.lineTo(46, -26);
  s.lineTo(46, -38);
  s.lineTo(14, -24);
  s.lineTo(8, -40);
  s.lineTo(0, -34);
  s.lineTo(-8, -40);
  s.lineTo(-14, -24);
  s.lineTo(-46, -38);
  s.lineTo(-46, -26);
  s.lineTo(-14, 4);
  s.lineTo(-9, 28);
  s.closePath();
  return s;
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
  const sparks = createSparks();
  scene.add(sparks.object);
  const shards = createShards(qualityPresets[quality]);
  scene.add(shards.object);
  let lastTime = performance.now();

  const shipGeometry = new THREE.ShapeGeometry(fighterShape());
  const shipMaterial = new THREE.MeshBasicMaterial({ color: palette.friendly });
  const ship = new THREE.Mesh(shipGeometry, shipMaterial);
  scene.add(ship);

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
      shards.consume(events);
    },
    render(world) {
      const { ship: s } = world;
      const { minSpeed, maxSpeed } = world.tuning.flight;
      // The mesh points up (+y); heading 0 means +x.
      ship.position.set(s.x, s.y, 0);
      ship.rotation.z = s.heading - Math.PI / 2;
      // Evade roll: squash the wingspan like a barrel roll seen from above.
      ship.scale.x = s.roll === 0 ? 1 : Math.max(MIN_ROLL_WIDTH, Math.abs(Math.cos(s.roll)));
      // Camera state comes from core/camera; the visible area is the same on every screen shape.
      const cam = world.camera;
      const view = viewSize(cam.view, cam.aspect);
      camera.left = -view.width / 2;
      camera.right = view.width / 2;
      camera.top = view.height / 2;
      camera.bottom = -view.height / 2;
      camera.updateProjectionMatrix();
      camera.position.set(cam.x + cam.shakeX, cam.y + cam.shakeY, 0);
      const speedFactor = clamp((s.speed - minSpeed) / (maxSpeed - minSpeed), 0, 1);
      background.update(cam.x, cam.y, s.vx, s.vy, speedFactor);
      bullets.update(world.bullets);
      enemyShots.update(world.enemyShots);
      targets.update(world.targets);
      fighters.update(world.fighters);
      wingmen.update(world.squadron.wingmen, world.tuning.squadron.radius);
      const now = performance.now();
      const frameDt = Math.min((now - lastTime) / 1000, 0.1);
      missiles.update(world, frameDt);
      sparks.update(frameDt);
      shards.update(frameDt);
      lastTime = now;
      renderer.render(scene, camera);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      background.dispose();
      bullets.dispose();
      sparks.dispose();
      shards.dispose();
      targets.dispose();
      fighters.dispose();
      wingmen.dispose();
      enemyShots.dispose();
      missiles.dispose();
      shipGeometry.dispose();
      shipMaterial.dispose();
      renderer.dispose();
    },
  };
}

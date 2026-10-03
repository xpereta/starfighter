import * as THREE from 'three';
import { clamp } from '../core/math';
import type { World } from '../core/world/world';
import { createBackground } from './background';
import { viewSize } from '../core/camera/view';
import { palette } from './palette';

export interface Renderer {
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

export function createRenderer(container: HTMLElement): Renderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.background);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

  const background = createBackground();
  scene.add(background.object);

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
    render(world) {
      const { ship: s } = world;
      const { minSpeed, maxSpeed } = world.tuning.flight;
      // The mesh points up (+y); heading 0 means +x.
      ship.position.set(s.x, s.y, 0);
      ship.rotation.z = s.heading - Math.PI / 2;
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
      renderer.render(scene, camera);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      background.dispose();
      shipGeometry.dispose();
      shipMaterial.dispose();
      renderer.dispose();
    },
  };
}

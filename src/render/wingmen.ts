import * as THREE from 'three';
import type { Wingman } from '../core/squadron/squadron';
import { palette } from './palette';

/**
 * Unit-radius wingman silhouette, nose along +y: a broad, straight-winged delta with a short tail.
 * Friendly green, and deliberately unlike the player's slim cyan ship and the enemy's forked darts.
 */
function deltaShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 1.25);
  s.lineTo(0.22, 0.4);
  s.lineTo(1.0, -0.4);
  s.lineTo(1.0, -0.75);
  s.lineTo(0.35, -0.55);
  s.lineTo(0.3, -1.0);
  s.lineTo(-0.3, -1.0);
  s.lineTo(-0.35, -0.55);
  s.lineTo(-1.0, -0.75);
  s.lineTo(-1.0, -0.4);
  s.lineTo(-0.22, 0.4);
  s.closePath();
  return s;
}

export interface WingmanRenderer {
  readonly object: THREE.Group;
  update(wingmen: readonly Wingman[], radius: number): void;
  dispose(): void;
}

/** One mesh per wingman slot, created on demand (the count is tunable); hidden while shot down. */
export function createWingmanRenderer(): WingmanRenderer {
  const group = new THREE.Group();
  group.position.z = 0.1;
  const geometry = new THREE.ShapeGeometry(deltaShape());
  const material = new THREE.MeshBasicMaterial({ color: palette.wingman });
  const meshes: THREE.Mesh[] = [];
  return {
    object: group,
    update(wingmen, radius) {
      while (meshes.length < wingmen.length) {
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
        meshes.push(mesh);
      }
      meshes.forEach((mesh, i) => {
        const w = wingmen[i];
        if (!w || !w.alive) {
          mesh.visible = false;
          return;
        }
        mesh.visible = true;
        mesh.position.set(w.ship.x, w.ship.y, 0);
        mesh.rotation.z = w.ship.heading - Math.PI / 2;
        mesh.scale.setScalar(radius);
      });
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

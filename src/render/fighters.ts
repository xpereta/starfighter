import * as THREE from 'three';
import type { Fighter } from '../core/ai/fighter';
import { palette } from './palette';

/** Narrowest a fighter gets mid-roll, so it never vanishes. */
const MIN_ROLL_WIDTH = 0.15;

/**
 * Unit-radius enemy fighter silhouette, nose along +y: a swept dart with a forked tail. Deliberately
 * unlike the player's fat-bodied straight-winged ship and the drones' plain diamonds.
 */
function dartShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 1.3);
  s.lineTo(0.28, 0.35);
  s.lineTo(1.05, -0.85);
  s.lineTo(0.5, -0.7);
  s.lineTo(0.18, -1.0);
  s.lineTo(0, -0.45);
  s.lineTo(-0.18, -1.0);
  s.lineTo(-0.5, -0.7);
  s.lineTo(-1.05, -0.85);
  s.lineTo(-0.28, 0.35);
  s.closePath();
  return s;
}

export interface FighterRenderer {
  readonly object: THREE.Group;
  update(fighters: readonly Fighter[]): void;
  dispose(): void;
}

/** One mesh per fighter slot, created on demand (waves can change size); hidden while dead. */
export function createFighterRenderer(): FighterRenderer {
  const group = new THREE.Group();
  group.position.z = 0.25;
  const geometry = new THREE.ShapeGeometry(dartShape());
  const material = new THREE.MeshBasicMaterial({ color: palette.fighter });
  const meshes: THREE.Mesh[] = [];
  return {
    object: group,
    update(fighters) {
      while (meshes.length < fighters.length) {
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
        meshes.push(mesh);
      }
      meshes.forEach((mesh, i) => {
        const f = fighters[i];
        if (!f || !f.alive) {
          mesh.visible = false;
          return;
        }
        const s = f.ship;
        mesh.visible = true;
        mesh.position.set(f.x, f.y, 0);
        mesh.rotation.z = s.heading - Math.PI / 2;
        mesh.scale.set(
          f.radius * (s.roll === 0 ? 1 : Math.max(MIN_ROLL_WIDTH, Math.abs(Math.cos(s.roll)))),
          f.radius,
          1,
        );
      });
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

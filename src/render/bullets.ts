import * as THREE from 'three';
import type { BulletPool } from '../core/weapons/guns';
import { palette } from './palette';

const LENGTH = 22;
const WIDTH = 5;

export interface BulletRenderer {
  readonly object: THREE.InstancedMesh;
  /** Writes one instance per live bullet. Allocation-free. */
  update(bullets: BulletPool): void;
  dispose(): void;
}

/** One InstancedMesh sized to the pool cap: a single draw call for every bullet. */
export function createBulletRenderer(capacity: number): BulletRenderer {
  const geometry = new THREE.PlaneGeometry(LENGTH, WIDTH); // long axis along +x
  const material = new THREE.MeshBasicMaterial({ color: palette.projectile });
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.position.z = 0.5;
  const dummy = new THREE.Object3D();
  return {
    object: mesh,
    update(bullets) {
      const { x, y, vx, vy } = bullets.data;
      mesh.count = bullets.count;
      for (let i = 0; i < bullets.count; i++) {
        dummy.position.set(x[i]!, y[i]!, 0);
        dummy.rotation.z = Math.atan2(vy[i]!, vx[i]!);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

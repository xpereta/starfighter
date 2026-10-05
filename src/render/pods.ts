import * as THREE from 'three';
import type { Pod } from '../core/world/pods';
import { palette } from './palette';

/** Most pods drawn at once (one per battle, so this is generous). */
const MAX_PODS = 4;
const INNER_RING = 0.62; // inner radius of the pod's ring, as a fraction of its radius
const CORE = 0.28; // radius of the bright core

export interface PodRenderer {
  readonly object: THREE.Group;
  update(pods: readonly Pod[], radius: number): void;
  dispose(): void;
}

/**
 * Escape pods: a flat ring with a bright core, in the pod blue, so a pod reads at a glance and
 * differently from every enemy shape (hexagons, diamonds, squares, darts) and from the wingmen.
 */
export function createPodRenderer(): PodRenderer {
  const group = new THREE.Group();
  const ringGeometry = new THREE.RingGeometry(INNER_RING, 1, 28);
  const coreGeometry = new THREE.CircleGeometry(CORE, 16);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: palette.pod });
  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const meshes: THREE.Group[] = [];
  for (let i = 0; i < MAX_PODS; i++) {
    const pod = new THREE.Group();
    pod.add(new THREE.Mesh(ringGeometry, ringMaterial));
    pod.add(new THREE.Mesh(coreGeometry, coreMaterial));
    pod.visible = false;
    pod.position.z = 0.25;
    group.add(pod);
    meshes.push(pod);
  }
  return {
    object: group,
    update(pods, radius) {
      meshes.forEach((mesh, i) => {
        const p = pods[i];
        mesh.visible = !!p && p.alive;
        if (p && p.alive) {
          mesh.position.set(p.x, p.y, 0.25);
          mesh.scale.setScalar(radius);
        }
      });
    },
    dispose() {
      ringGeometry.dispose();
      coreGeometry.dispose();
      ringMaterial.dispose();
      coreMaterial.dispose();
    },
  };
}

import * as THREE from 'three';
import type { Pod } from '../core/world/pods';
import { palette } from './palette';
import { createShipArt, type ShipArt } from './ship-art';

/** Most pods drawn at once (one per battle, so this is generous). */
const MAX_PODS = 4;
/** Pods, statics and turrets have no facing: shapes are authored nose along +x, and these draw 'up'. */
const STILL = Math.PI / 2;

export interface PodRenderer {
  readonly object: THREE.Group;
  update(pods: readonly Pod[], radius: number): void;
  dispose(): void;
}

/**
 * Escape pods: a ring with a bright core in the pod blue (the shape comes from the active style's
 * `ships.pod`), so a pod reads at a glance and differently from every enemy and from the wingmen.
 */
export function createPodRenderer(): PodRenderer {
  const group = new THREE.Group();
  const arts: ShipArt[] = [];
  for (let i = 0; i < MAX_PODS; i++) {
    const art = createShipArt('pod', () => palette.pod);
    group.add(art.object);
    arts.push(art);
  }
  return {
    object: group,
    update(pods, radius) {
      arts.forEach((art, i) => {
        const p = pods[i];
        if (!p || !p.alive) {
          art.hide();
          return;
        }
        art.update({ x: p.x, y: p.y, heading: STILL, scale: radius });
        art.object.position.z = 0.25;
      });
    },
    dispose() {
      for (const a of arts) a.dispose();
    },
  };
}

import * as THREE from 'three';
import type { Fighter } from '../core/ai/fighter';
import { palette } from './palette';
import { createShipArt, rollSquash, type ShipArt } from './ship-art';

export interface FighterRenderer {
  readonly object: THREE.Group;
  update(fighters: readonly Fighter[]): void;
  dispose(): void;
}

/**
 * One drawn ship per fighter slot, created on demand (waves can change size); hidden while dead,
 * squashed during an evade roll. The silhouette comes from the active style (`ships.fighter`).
 */
export function createFighterRenderer(): FighterRenderer {
  const group = new THREE.Group();
  group.position.z = 0.25;
  const arts: ShipArt[] = [];
  return {
    object: group,
    update(fighters) {
      while (arts.length < fighters.length) {
        const art = createShipArt('fighter', () => palette.fighter);
        group.add(art.object);
        arts.push(art);
      }
      arts.forEach((art, i) => {
        const f = fighters[i];
        if (!f || !f.alive) {
          art.hide();
          return;
        }
        const s = f.ship;
        art.update({
          x: f.x,
          y: f.y,
          heading: s.heading,
          scale: f.radius,
          squash: rollSquash(s.roll),
        });
      });
    },
    dispose() {
      for (const a of arts) a.dispose();
    },
  };
}

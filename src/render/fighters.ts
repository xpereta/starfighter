import * as THREE from 'three';
import type { Fighter } from '../core/ai/fighter';
import { palette } from './palette';
import type { ShipKind } from './style';
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
  /** Which look each slot's art was made for (a slot can be reused by a lancer after a fighter). */
  const looks: ShipKind[] = [];
  return {
    object: group,
    update(fighters) {
      while (arts.length < fighters.length) {
        const art = createShipArt('fighter', () => palette.fighter);
        group.add(art.object);
        arts.push(art);
        looks.push('fighter');
      }
      arts.forEach((art0, i) => {
        const f = fighters[i];
        if (!f || !f.alive) {
          art0.hide();
          return;
        }
        let art = art0;
        const look: ShipKind = f.lancer ? 'lancer' : 'fighter';
        if (looks[i] !== look) {
          // The slot was reused by the other kind: swap in the matching silhouette.
          group.remove(art0.object);
          art0.dispose();
          art = createShipArt(look, () => palette.fighter);
          group.add(art.object);
          arts[i] = art;
          looks[i] = look;
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

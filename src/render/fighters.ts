import * as THREE from 'three';
import { SHIP_GUNSHIP, type Fighter } from '../core/ai/fighter';
import { palette } from './palette';
import { createShipArt, rollSquash, type ShipArt } from './ship-art';
import type { ShipKind } from './style';

export interface FighterRenderer {
  readonly object: THREE.Group;
  update(fighters: readonly Fighter[]): void;
  dispose(): void;
}

/** The style's shape name for a fighter-list entry. */
const kindOf = (f: Fighter): ShipKind => (f.shipType === SHIP_GUNSHIP ? 'gunship' : 'fighter');

/**
 * One drawn ship per fighter slot, created on demand (waves can change size); hidden while dead,
 * squashed during an evade roll. The silhouette comes from the active style (`ships.fighter`, or
 * `ships.gunship` for a gunship); a slot reused by another kind of ship gets a new drawing.
 */
export function createFighterRenderer(): FighterRenderer {
  const group = new THREE.Group();
  group.position.z = 0.25;
  const arts: ShipArt[] = [];
  const kinds: ShipKind[] = [];
  return {
    object: group,
    update(fighters) {
      while (arts.length < fighters.length) {
        const art = createShipArt('fighter', () => palette.fighter);
        group.add(art.object);
        arts.push(art);
        kinds.push('fighter');
      }
      arts.forEach((art, i) => {
        const f = fighters[i];
        if (!f || !f.alive) {
          art.hide();
          return;
        }
        if (kinds[i] !== kindOf(f)) {
          group.remove(art.object);
          art.dispose();
          kinds[i] = kindOf(f);
          art = createShipArt(kinds[i]!, () => palette.fighter);
          group.add(art.object);
          arts[i] = art;
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

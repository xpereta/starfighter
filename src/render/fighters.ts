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
const kindOf = (f: Fighter): ShipKind =>
  f.shipType === SHIP_GUNSHIP ? 'gunship' : f.lancer ? 'lancer' : 'fighter';

/**
 * One drawn ship per fighter slot, created on demand (waves can change size); hidden while dead,
 * squashed during an evade roll. The silhouette comes from the active style (`ships.fighter`, or
 * `ships.gunship` for a gunship); a slot reused by another kind of ship gets a new drawing.
 */
export function createFighterRenderer(): FighterRenderer {
  const group = new THREE.Group();
  group.position.z = 0.25;
  const arts: ShipArt[] = [];
  /** Which look each slot's art was made for (a slot can be reused by another kind of ship). */
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
      arts.forEach((art0, i) => {
        const f = fighters[i];
        if (!f || !f.alive) {
          art0.hide();
          return;
        }
        let art = art0;
        const look = kindOf(f);
        if (kinds[i] !== look) {
          group.remove(art0.object);
          art0.dispose();
          art = createShipArt(look, () => palette.fighter);
          group.add(art.object);
          arts[i] = art;
          kinds[i] = look;
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

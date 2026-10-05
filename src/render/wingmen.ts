import * as THREE from 'three';
import type { Wingman } from '../core/squadron/squadron';
import { palette } from './palette';
import { createShipArt, type ShipArt } from './ship-art';

export interface WingmanRenderer {
  readonly object: THREE.Group;
  update(wingmen: readonly Wingman[], radius: number): void;
  dispose(): void;
}

/** One drawn ship per wingman slot, created on demand (the count is tunable); hidden while shot down. */
export function createWingmanRenderer(): WingmanRenderer {
  const group = new THREE.Group();
  group.position.z = 0.1;
  const arts: ShipArt[] = [];
  return {
    object: group,
    update(wingmen, radius) {
      while (arts.length < wingmen.length) {
        const art = createShipArt('wingman', () => palette.wingman);
        group.add(art.object);
        arts.push(art);
      }
      arts.forEach((art, i) => {
        const w = wingmen[i];
        if (!w || !w.alive) {
          art.hide();
          return;
        }
        art.update({ x: w.ship.x, y: w.ship.y, heading: w.ship.heading, scale: radius });
      });
    },
    dispose() {
      for (const a of arts) a.dispose();
    },
  };
}

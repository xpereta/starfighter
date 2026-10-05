import * as THREE from 'three';
import type { Target, TargetKind } from '../core/world/target';
import { palette } from './palette';
import { createShipArt, type ShipArt } from './ship-art';

const COLORS: Record<TargetKind, () => number> = {
  static: () => palette.enemyStatic,
  drone: () => palette.enemy,
  turret: () => palette.turret,
};

/** Turrets and statics have no facing: shapes are authored nose along +x, and these draw 'up'. */
const STILL = Math.PI / 2;

export interface TargetRenderer {
  readonly object: THREE.Group;
  update(targets: readonly Target[]): void;
  dispose(): void;
}

/** One drawn ship per arena target (about 30), from the active style's shape for its kind; hidden while destroyed. */
export function createTargetRenderer(targets: readonly Target[]): TargetRenderer {
  const group = new THREE.Group();
  const arts: ShipArt[] = targets.map((t) => {
    const art = createShipArt(t.kind, COLORS[t.kind]);
    group.add(art.object);
    return art;
  });
  return {
    object: group,
    update(current) {
      arts.forEach((art, i) => {
        const t = current[i];
        if (!t || !t.alive) {
          art.hide();
          return;
        }
        // Moving drones point where they fly.
        const heading = t.kind === 'drone' ? Math.atan2(t.vy, t.vx) : STILL;
        art.update({ x: t.x, y: t.y, heading, scale: t.radius });
        art.object.position.z = 0.2;
      });
    },
    dispose() {
      for (const a of arts) a.dispose();
    },
  };
}

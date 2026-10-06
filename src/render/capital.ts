import * as THREE from 'three';
import { CAPITAL_PARTS } from '../../data/content/capital';
import { partCenter, scaleOf } from '../core/enemies/capital';
import type { PartRole } from '../core/enemies/capital-parts';
import type { World } from '../core/world/world';
import { palette } from './palette';
import { createShipArt, type ShipArt } from './ship-art';
import type { ShipKind } from './style';

/**
 * The capital ship (spec section 5), drawn from the active style's data: its hull silhouette
 * (`ships.capital`, hull radius units) behind one shape per living part (`ships.capital<Role>`, part
 * radius units; a capsule part is stretched along the ship's axis). A part below `HURT_SHARE` of its
 * hit points is drawn in a hotter colour, a dead part leaves a dark wreck. A style that lacks these
 * shapes falls back to `plain`'s placeholders (see style.ts). Visual only: reads core state.
 */

/** A part under this share of its hit points shows as damaged. */
const HURT_SHARE = 0.5;
/** How far a damaged part's colour moves to the hot colour, and how dark a wreck is (share of the hull colour). */
const HURT_MIX = 0.55;
const WRECK_TONE = 0.3;
const HOT_COLOR = 0xff6a3d;

const PART_KIND: Record<PartRole, ShipKind> = {
  turret: 'capitalTurret',
  engine: 'capitalEngine',
  armour: 'capitalArmour',
  bridge: 'capitalBridge',
  core: 'capitalCore',
};

/** Layer of each role (z offset): what is over what. The core sits under its plates. */
const LAYER: Record<PartRole, number> = {
  core: 0.08,
  bridge: 0.11,
  engine: 0.14,
  armour: 0.17,
  turret: 0.2,
};
const Z_HULL = 0.02;
const Z_WRECK = 0.05;

/** Placeholder colours from the palette: turrets purple, plates orange, engines pink, the bridge pale blue, the core red. */
const baseColor = (role: PartRole): number => {
  switch (role) {
    case 'turret':
      return palette.turret;
    case 'armour':
      return palette.enemyStatic;
    case 'engine':
      return palette.fighter;
    case 'bridge':
      return palette.pod;
    case 'core':
      return palette.enemy;
  }
};

function mixColor(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

export interface CapitalRenderer {
  readonly object: THREE.Group;
  update(world: World): void;
  dispose(): void;
}

interface PartArts {
  live: ShipArt;
  hurt: ShipArt;
  wreck: ShipArt;
}

export function createCapitalRenderer(): CapitalRenderer {
  const group = new THREE.Group();
  const hull = createShipArt('capital', () => mixColor(palette.enemy, palette.background, 0.8));
  hull.object.position.z = Z_HULL;
  group.add(hull.object);
  const parts: PartArts[] = CAPITAL_PARTS.map((def) => {
    const kind = PART_KIND[def.role];
    const arts: PartArts = {
      live: createShipArt(kind, () => baseColor(def.role)),
      hurt: createShipArt(kind, () => mixColor(baseColor(def.role), HOT_COLOR, HURT_MIX)),
      wreck: createShipArt(kind, () =>
        mixColor(baseColor(def.role), palette.background, 1 - WRECK_TONE),
      ),
    };
    arts.live.object.position.z = LAYER[def.role];
    arts.hurt.object.position.z = LAYER[def.role];
    arts.wreck.object.position.z = Z_WRECK;
    group.add(arts.live.object, arts.hurt.object, arts.wreck.object);
    return arts;
  });
  const at = { x: 0, y: 0 };
  const pose = { x: 0, y: 0, heading: 0, scale: 1, squash: 1 }; // reused every frame
  return {
    object: group,
    update(world) {
      const cap = world.enemies.capital;
      if (!cap || cap.phase === 2) {
        // Gone, or destroyed: the death sequence (render/fx) draws the break-up from here.
        hull.hide();
        for (const p of parts) {
          p.live.hide();
          p.hurt.hide();
          p.wreck.hide();
        }
        return;
      }
      const s = scaleOf(cap);
      hull.update({ x: cap.x, y: cap.y, heading: cap.heading, scale: cap.hullRadius });
      CAPITAL_PARTS.forEach((def, i) => {
        const state = cap.parts[i]!;
        const arts = parts[i]!;
        partCenter(at, cap, def);
        // A capsule is drawn stretched along the axis: the shape's x runs half its length, y the radius.
        const half = (def.radius + (def.length ?? 0) / 2) * s;
        pose.x = at.x;
        pose.y = at.y;
        pose.heading = cap.heading;
        pose.scale = half;
        pose.squash = (def.radius * s) / half;
        const hurt = state.hp < state.maxHp * HURT_SHARE;
        if (!state.alive) {
          arts.live.hide();
          arts.hurt.hide();
          arts.wreck.update(pose);
        } else {
          arts.wreck.hide();
          if (hurt) {
            arts.live.hide();
            arts.hurt.update(pose);
          } else {
            arts.hurt.hide();
            arts.live.update(pose);
          }
        }
      });
    },
    dispose() {
      hull.dispose();
      for (const p of parts) {
        p.live.dispose();
        p.hurt.dispose();
        p.wreck.dispose();
      }
    },
  };
}

import { validateMount, type WeaponMount } from './mounts';
import { checkId, checkNumber, checkOneOf } from './validate';

export const PART_ROLES = ['turret', 'engine', 'armour', 'bridge', 'core'] as const;
export type PartRole = (typeof PART_ROLES)[number];

/**
 * One independent body of the capital ship (spec section 5), as data. Position is local to the
 * hull (x forward, y left, u), rotated with the ship's heading. Units: u, hit points, radians.
 */
export interface CapitalPartDef {
  id: string;
  role: PartRole;
  /** Local position of the part centre (u). */
  x: number;
  y: number;
  /** Hit circle radius (u); with a `length` the shape is a capsule of that radius. */
  radius: number;
  /** Capsule length along the ship's forward axis (u); 0 or absent = a circle. */
  length?: number;
  hp: number;
  /** Ids of the parts this one shields: a covered part cannot be damaged while this one stands. Armour only. */
  covers: string[];
  /** The gun, for a `turret` part (required there, forbidden elsewhere). */
  mount?: WeaponMount;
}

/**
 * Throws unless the parts make a legal capital ship: unique ids, exactly one core, at most one
 * bridge, at least one engine, turrets with a mount, only armour covering, covers pointing at
 * existing other parts, every plate-covered part reachable by some plate, and (when `hullRadius`
 * is given) every part inside the hull circle.
 */
export function validateCapitalParts(parts: readonly CapitalPartDef[], hullRadius?: number): void {
  const ids = new Set<string>();
  for (const p of parts) {
    checkId('part.id', p.id);
    if (ids.has(p.id)) throw new Error(`Capital part "${p.id}" is listed twice`);
    ids.add(p.id);
  }
  const count = (role: PartRole): number => parts.filter((p) => p.role === role).length;
  for (const p of parts) {
    const at = `part "${p.id}"`;
    checkOneOf(`${at}.role`, p.role, PART_ROLES);
    checkNumber(`${at}.x`, p.x, -3000, 3000);
    checkNumber(`${at}.y`, p.y, -3000, 3000);
    checkNumber(`${at}.radius`, p.radius, 5, 1500);
    checkNumber(`${at}.length`, p.length ?? 0, 0, 3000);
    checkNumber(`${at}.hp`, p.hp, 1, 1000);
    if (p.role === 'turret') {
      if (!p.mount) throw new Error(`${at} is a turret and needs a mount`);
      validateMount(p.mount, `${at}.mount`);
    } else if (p.mount) {
      throw new Error(`${at} is not a turret and cannot have a mount`);
    }
    if (p.covers.length > 0 && p.role !== 'armour') {
      throw new Error(`${at} covers other parts but is not armour`);
    }
    for (const c of p.covers) {
      if (c === p.id) throw new Error(`${at} covers itself`);
      if (!ids.has(c)) throw new Error(`${at} covers "${c}", which does not exist`);
    }
    if (hullRadius !== undefined) {
      const reach = Math.hypot(p.x, p.y) + p.radius + (p.length ?? 0) / 2;
      if (reach > hullRadius) {
        throw new Error(`${at} reaches ${Math.round(reach)} u, outside the hull (${hullRadius} u)`);
      }
    }
  }
  if (count('core') !== 1)
    throw new Error(`A capital ship needs exactly one core, has ${count('core')}`);
  if (count('bridge') > 1) throw new Error('A capital ship has at most one bridge');
  if (count('engine') < 1) throw new Error('A capital ship needs at least one engine');
  const core = parts.find((p) => p.role === 'core')!;
  if (!parts.some((p) => p.role === 'armour' && p.covers.includes(core.id))) {
    throw new Error('No armour plate covers the core, so there is no order of play');
  }
}

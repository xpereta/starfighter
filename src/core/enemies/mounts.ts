import { checkId, checkInteger, checkNumber } from './validate';

/**
 * A gun on an enemy ship (spec section 1). Position and aim limits are in ship space: x points
 * forward along the heading, y to the left. Angles are radians, lengths world units (u), times
 * seconds (s). Turrets and the gunship use mounts; a plain fighter has one fixed nose mount.
 */
export interface WeaponMount {
  id: string;
  /** Muzzle position in ship space (u). */
  x: number;
  y: number;
  /** Middle of the firing arc, relative to the ship heading (rad). */
  arcCenter: number;
  /** Half-width of the firing arc (rad); the mount can only aim inside `arcCenter +- arcHalf`. pi = all round. */
  arcHalf: number;
  /** Shots per second while firing. */
  fireRate: number;
  /** Bullet speed on top of the ship's own (u/s). */
  bulletSpeed: number;
  /** Hull points one bullet takes off its target. */
  bulletDamage: number;
  /** Seconds a bullet flies before it fades. */
  bulletLife: number;
  /** Farthest distance at which the mount opens fire (u). */
  range: number;
  /** Random aim error, maximum angle (rad). */
  spread: number;
  /** Burst pattern: `shots` in a row, then `pause` seconds with no fire (a window for the player). shots 1 = no bursts. */
  burst: { shots: number; pause: number };
}

/** Throws unless the mount is complete and sane. `path` names it in the error. */
export function validateMount(mount: WeaponMount, path = `mount "${mount.id}"`): void {
  checkId(`${path}.id`, mount.id);
  checkNumber(`${path}.x`, mount.x, -2000, 2000);
  checkNumber(`${path}.y`, mount.y, -2000, 2000);
  checkNumber(`${path}.arcCenter`, mount.arcCenter, -Math.PI, Math.PI);
  checkNumber(`${path}.arcHalf`, mount.arcHalf, 0, Math.PI);
  checkNumber(`${path}.fireRate`, mount.fireRate, 0.1, 60);
  checkNumber(`${path}.bulletSpeed`, mount.bulletSpeed, 50, 3000);
  checkNumber(`${path}.bulletDamage`, mount.bulletDamage, 0.1, 20);
  checkNumber(`${path}.bulletLife`, mount.bulletLife, 0.1, 10);
  checkNumber(`${path}.range`, mount.range, 50, 6000);
  checkNumber(`${path}.spread`, mount.spread, 0, Math.PI / 4);
  checkInteger(`${path}.burst.shots`, mount.burst?.shots, 1, 100);
  checkNumber(`${path}.burst.pause`, mount.burst?.pause, 0, 20);
}

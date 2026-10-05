import { checkInteger, checkNumber, checkOneOf, checkText } from './validate';
import { validateMount, type WeaponMount } from './mounts';

/** Enemy kinds that exist as ships. */
export const ENEMY_KIND_IDS = ['fighter', 'gunship', 'lancer', 'capital'] as const;
export type EnemyKindId = (typeof ENEMY_KIND_IDS)[number];

/** What a battle table can ask for: a kind, or a formation `wing` of fighters (a group type, not a ship kind). */
export const ENEMY_GROUP_IDS = [...ENEMY_KIND_IDS, 'wing'] as const;
export type EnemyGroupId = (typeof ENEMY_GROUP_IDS)[number];

/** Which behaviour drives a kind. Each profile is implemented by one track (see docs/p5-tracks.md). */
export const AI_PROFILE_IDS = ['fighter', 'gunship', 'lancer', 'capital', 'wing-follower'] as const;
export type AiProfileId = (typeof AI_PROFILE_IDS)[number];

/**
 * An enemy kind as data (spec section 1), validated at load like parameters. Units: world units (u),
 * seconds (s), radians. The existing fighter is the `fighter` kind and behaves exactly as before.
 */
export interface EnemyKind {
  id: EnemyKindId;
  label: string;
  /** Hit points. */
  hull: number;
  /** Hit circle radius (u). */
  radius: number;
  /** Speed range compared with the player's (x). */
  speedScale: number;
  /** Turn rate compared with the player's (x). */
  turnScale: number;
  /** Guns, in ship space. A capital ship keeps its guns in its parts and leaves this empty. */
  mounts: WeaponMount[];
  ai: AiProfileId;
  /** How dangerous it is, for wingman target choice and the battle table's budget (a fighter is 1). */
  threat: number;
  /** First battle (1-based) in which it may appear. */
  fromBattle: number;
}

export type EnemyKindTable = Record<EnemyKindId, EnemyKind>;

export function validateEnemyKind(kind: EnemyKind): void {
  const at = `kind "${String(kind.id)}"`;
  checkOneOf(`${at}.id`, kind.id, ENEMY_KIND_IDS);
  checkText(`${at}.label`, kind.label);
  checkNumber(`${at}.hull`, kind.hull, 1, 1000);
  checkNumber(`${at}.radius`, kind.radius, 5, 2000);
  checkNumber(`${at}.speedScale`, kind.speedScale, 0, 3);
  checkNumber(`${at}.turnScale`, kind.turnScale, 0, 3);
  checkOneOf(`${at}.ai`, kind.ai, AI_PROFILE_IDS);
  checkNumber(`${at}.threat`, kind.threat, 0, 1000);
  checkInteger(`${at}.fromBattle`, kind.fromBattle, 1, 99);
  const seen = new Set<string>();
  for (const mount of kind.mounts) {
    validateMount(mount, `${at}.mounts["${mount.id}"]`);
    if (seen.has(mount.id)) throw new Error(`${at} has two mounts called "${mount.id}"`);
    seen.add(mount.id);
  }
}

/** Every kind present once, keyed by its own id. Throws on the first problem. */
export function validateEnemyKinds(table: EnemyKindTable): void {
  for (const id of ENEMY_KIND_IDS) {
    const kind = table[id] as EnemyKind | undefined;
    if (!kind) throw new Error(`Enemy kind "${id}" is missing`);
    if (kind.id !== id) throw new Error(`Enemy kind keyed "${id}" has id "${String(kind.id)}"`);
    validateEnemyKind(kind);
  }
}

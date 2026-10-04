import { TRAITS, type TraitMultipliers } from '../../../data/content/traits';
import { createSquadronConfig, type SquadronConfig } from '../../../data/tuning/squadron';
import type { World } from '../world/world';
import { findPilot } from './pilots';

/**
 * A wingman's squadron settings with its pilot's trait applied. This is the ONE place trait effects
 * are computed: the AI, the guns and the missiles all read what they need from here, so a trait can
 * never be half applied. A wingman with no pilot (practice mode) gets the plain tuning values.
 */
export interface EffectiveSquadronConfig extends SquadronConfig {
  /** x top speed. */
  speedScale: number;
  /** x damage of the missile this wingman fires. */
  missileDamage: number;
  /** 0..1: how strongly it prefers enemies chasing the player. */
  guardBias: number;
  /** Added to its hit points. */
  healthBonus: number;
}

const NEUTRAL: TraitMultipliers = {
  fireCone: 1,
  gunDamage: 1,
  healthBonus: 0,
  slotHold: 1,
  engageRange: 1,
  speed: 1,
  missileDamage: 1,
  guardBias: 0,
};

/** A reusable scratch object (every field is overwritten by `effectiveSquadronConfig` before use). */
export function createEffectiveConfig(): EffectiveSquadronConfig {
  return {
    ...createSquadronConfig(),
    speedScale: 1,
    missileDamage: 1,
    guardBias: 0,
    healthBonus: 0,
  };
}

/** Fills `out` (a reusable scratch object) with the wingman's effective settings and returns it. */
export function effectiveSquadronConfig(
  out: EffectiveSquadronConfig,
  world: World,
  pilotId: number,
): EffectiveSquadronConfig {
  Object.assign(out, world.tuning.squadron);
  const pilot = pilotId > 0 ? findPilot(world.pilots, pilotId) : undefined;
  const m = pilot ? TRAITS[pilot.trait].multipliers : NEUTRAL;
  out.fireCone *= m.fireCone;
  out.gunDamage *= m.gunDamage;
  out.slotHoldRadius *= m.slotHold;
  out.tightEngageRange *= m.engageRange;
  out.spreadEngageRange *= m.engageRange;
  out.speedScale = m.speed;
  out.missileDamage = m.missileDamage;
  out.guardBias = m.guardBias;
  out.healthBonus = m.healthBonus;
  return out;
}

const scratch = createEffectiveConfig();

/** Hit points a wingman of this pilot starts with (and is restored to): at least 1. */
export function maxHpOf(world: World, pilotId: number): number {
  return Math.max(
    1,
    world.tuning.squadron.health + effectiveSquadronConfig(scratch, world, pilotId).healthBonus,
  );
}

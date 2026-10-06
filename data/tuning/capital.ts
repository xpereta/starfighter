import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/**
 * Capital ship tuning (spec section 5, owned by track C): how the boss moves, how its turrets
 * behave, its escorts and its death chain. The parts themselves (positions, hp, guns) are content
 * data in `data/content/capital.ts`. Units: u, s; degrees here, radians inside core.
 */
export const capitalParams = {
  hullRadius: {
    default: 700,
    min: 300,
    max: 1500,
    unit: 'u',
    note: 'Radius of the whole capital ship; every part is scaled with it (the parts are designed for 700 u). Higher = a bigger ship, parts farther apart; lower = a compact boss. Applies to the next capital ship that spawns.',
  },
  cruiseSpeed: {
    default: 60,
    min: 0,
    max: 300,
    unit: 'u/s',
    note: 'How fast the capital ship drifts towards the player while its engines work (halved with one engine left, stopped with none). 0 = it never moves; higher = it closes in quickly.',
  },
  turnRate: {
    default: 8,
    min: 0,
    max: 60,
    unit: '°/s',
    note: 'How fast the capital ship turns to keep its broadside on the player. Higher = harder to get behind it; lower = easy to flank.',
  },
  standoff: {
    default: 1600,
    min: 400,
    max: 4000,
    unit: 'u',
    note: 'Distance from the player at which the capital ship stops closing in. Higher = it shells you from afar; lower = it sits on top of you.',
  },
  edgeMargin: {
    default: 150,
    min: 0,
    max: 1000,
    unit: 'u',
    note: 'How far inside the arena edge the capital ship appears at the start of the battle. Parts always stay inside the arena.',
  },
  partHpScale: {
    default: 0.5,
    min: 0.1,
    max: 10,
    step: 0.1,
    unit: 'x',
    note: 'Multiplies the hit points of every part when the ship spawns. Higher = a longer boss fight; lower = a quick one.',
  },
  fireScale: {
    default: 0.6,
    min: 0,
    max: 4,
    step: 0.1,
    unit: 'x',
    note: 'Multiplies the rate of fire of every turret (bursts keep their length, so the pauses between them stay). 0 = the guns are silent; higher = a heavier barrage.',
  },
  lockPartCap: {
    default: 3,
    min: 1,
    max: 8,
    unit: 'parts',
    note: 'Most parts of one capital ship a missile salvo may lock, so a salvo is not wasted on tiny parts. Higher = more spread; lower = focused fire.',
  },
  blindAccuracyScale: {
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
    unit: 'x',
    note: 'How accurate its turrets stay once the bridge is destroyed (1 = unchanged, 0 = the full aim error below). Lower = a destroyed bridge makes the guns much worse.',
  },
  blindSpread: {
    default: 10,
    min: 0,
    max: 45,
    unit: '°',
    note: 'Extra random aim error of a blinded turret at accuracy 0 (scaled down by the accuracy above); blinded turrets also stop leading the target. Higher = a bridge kill makes the barrage wild.',
  },
  blindReaction: {
    default: 0.8,
    min: 0,
    max: 5,
    unit: 's',
    note: 'Extra seconds a blinded turret waits after each burst before it fires again. Higher = longer windows once the bridge is gone.',
  },
  escortWings: {
    default: 2,
    min: 0,
    max: 6,
    unit: 'wings',
    note: 'Formation wings escorting the capital ship. The first arrives with it, the next ones follow after the delay below. Higher = the player cannot hover at the capital; lower = a duel.',
  },
  escortWingSize: {
    default: 3,
    min: 2,
    max: 5,
    unit: 'fighters',
    note: 'Fighters in each escort wing (3 to 5 in the spec). Higher = a harder fight around the capital.',
  },
  escortWingDelay: {
    default: 25,
    min: 0,
    max: 120,
    unit: 's',
    note: 'Seconds between one escort wing arriving and the next. Higher = the pressure builds slowly; lower = everything at once.',
  },
  escortLancers: {
    default: 2,
    min: 0,
    max: 8,
    unit: 'ships',
    note: 'Missile fighters that join the battle halfway through the capital ship’s approach. 0 = none.',
  },
  lancerFallbackTime: {
    default: 45,
    min: 5,
    max: 300,
    unit: 's',
    note: 'The missile fighters also join after this many seconds, even if the capital ship has not covered half its approach (for example because its engines are dead).',
  },
  deathChainTime: {
    default: 4.5,
    min: 0.5,
    max: 12,
    unit: 's',
    note: 'How long the death chain lasts after the core dies: the remaining parts blow up one after another, then the hull breaks apart. The battle is won when it ends. Higher = a longer spectacle before the debrief.',
  },
} as const satisfies Record<string, ParamDef>;

export type CapitalConfig = { -readonly [K in keyof typeof capitalParams]: number };

export function createCapitalConfig(): CapitalConfig {
  return defaultsOf(capitalParams);
}

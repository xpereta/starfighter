import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Wingmen tuning (spec: docs/specs/prototype-2-squadron.md sections 4 and 5). Angles in degrees here. */
export const squadronParams = {
  wingmanCount: {
    default: 2,
    min: 0,
    max: 4,
    unit: 'wingmen',
    note: 'How many wingmen fly with you. 0 = fly alone. They are created from this setting, so changing it live adds or removes wingmen straight away. More wingmen = more firepower and (later) bigger missile salvos.',
  },
  health: {
    default: 3,
    min: 1,
    max: 10,
    unit: 'hp',
    note: 'Hit points of a wingman. Every enemy bullet that hits takes one. Higher = they survive longer; lower = they fall quickly, so you have to protect them.',
  },
  radius: {
    default: 24,
    min: 10,
    max: 80,
    unit: 'u',
    note: 'Size of a wingman hit circle, used for enemy bullets. Higher = a bigger target that is easier to hit; lower = harder for enemies to hit.',
  },
  respawnDelay: {
    default: 12,
    min: 1,
    max: 60,
    unit: 's',
    note: 'How long a fallen wingman takes to return in this test arena, so practice never stops. Higher = losing one hurts for longer; lower = back in the fight quickly.',
  },
  tightRadius: {
    default: 160,
    min: 60,
    max: 500,
    unit: 'u',
    note: 'Tight formation: how close wingmen fly behind you on either side (extra wingmen stack further back). Higher = a wider, looser pair; lower = they hug your tail.',
  },
  spreadRadius: {
    default: 650,
    min: 200,
    max: 1500,
    unit: 'u',
    note: 'Spread formation: the radius of the ring around you that wingmen spread out on to cover the area. Higher = they cover more space but are farther from you; lower = a compact ring.',
  },
  separation: {
    default: 120,
    min: 40,
    max: 400,
    unit: 'u',
    note: 'Closer than this to you or to another wingman, a wingman steers away to avoid a collision. Higher = more personal space and a looser formation; lower = they can bunch up.',
  },
  separationGain: {
    default: 1.5,
    min: 0,
    max: 5,
    unit: 'x',
    note: 'How strongly a wingman pushes away when someone is inside the separation distance, compared with steering to its slot. Higher = dodges aggressively and may lose its slot; lower = more likely to bump.',
  },
  slotHoldRadius: {
    default: 80,
    min: 20,
    max: 300,
    unit: 'u',
    note: 'Within this distance of its slot a wingman stops chasing it and just matches your heading. Higher = looser formation flying with less weaving; lower = constant small corrections.',
  },
  slotLeadTime: {
    default: 0.4,
    min: 0,
    max: 2,
    unit: 's',
    note: 'How far ahead of its slot a wingman aims, based on your movement, so it keeps up through your turns. Higher = anticipates you more but can overshoot; lower = lags behind turns.',
  },
  catchUpRange: {
    default: 500,
    min: 100,
    max: 2000,
    unit: 'u',
    note: 'How far behind its slot a wingman must be to use full throttle to catch up. Higher = gentler catch-up that lets them trail further; lower = they surge forward quickly.',
  },
  fireCone: {
    default: 8,
    min: 1,
    max: 30,
    unit: '°',
    note: 'How well a wingman must be pointing at its target before it shoots, as a half-angle. Higher = sprays from wider angles and wastes more bullets; lower = fires only when lined up.',
  },
  fireRange: {
    default: 800,
    min: 200,
    max: 3000,
    unit: 'u',
    note: 'Farthest distance at which a wingman shoots. Higher = they support you from afar; lower = they must close in before they fire.',
  },
  fireRate: {
    default: 5,
    min: 0.5,
    max: 20,
    unit: 'shots/s',
    note: 'How fast a wingman fires its guns. Higher = more bullets in the air and more help; lower = a lighter touch that leaves the kills to you.',
  },
  spread: {
    default: 1.5,
    min: 0,
    max: 10,
    unit: '°',
    note: 'Random aim error of wingman guns, as a maximum angle. Higher = inaccurate fire that often misses; lower = sharp shooting that can steal kills.',
  },
  muzzleOffset: {
    default: 40,
    min: 0,
    max: 120,
    unit: 'u',
    note: 'How far in front of its centre a wingman bullet appears. Mostly cosmetic: it keeps bullets from starting inside the ship.',
  },
  gunDamage: {
    default: 0.6,
    min: 0.1,
    max: 2,
    unit: 'hp',
    note: 'Damage of each wingman bullet (yours does 1). Lower than yours on purpose, so your own aim still matters. Higher = wingmen kill fast and can take over; lower = they only soften enemies.',
  },
  tightEngageRange: {
    default: 700,
    min: 200,
    max: 2000,
    unit: 'u',
    note: 'In tight formation a wingman only attacks enemies this close to YOU, then returns to its slot. Higher = they venture further from you; lower = strictly defensive.',
  },
  spreadEngageRange: {
    default: 1100,
    min: 300,
    max: 3000,
    unit: 'u',
    note: 'In spread formation a wingman attacks any enemy within this distance of itself, then returns to its slot. Higher = they hunt over a wide area; lower = they only take what is close.',
  },
  attackOrderTime: {
    default: 8,
    min: 1,
    max: 30,
    unit: 's',
    note: 'How long the Attack my target order lasts. Wingmen drop everything to chase and shoot your target, then fall back into formation. Higher = a longer commitment (and a more exposed squadron); lower = a quick strike.',
  },
  orderCueTime: {
    default: 1.2,
    min: 0.3,
    max: 4,
    unit: 's',
    note: 'How long the "NO TARGET" / "NO WINGMEN" message stays on screen when Attack my target cannot do anything. Higher = harder to miss; lower = less clutter.',
  },
  attackSearchRange: {
    default: 2500,
    min: 500,
    max: 8000,
    unit: 'u',
    note: 'With nothing locked, Attack my target picks the enemy closest to where your nose points, but only within this distance. Higher = it can send wingmen after faraway enemies; lower = only nearby ones.',
  },
} as const satisfies Record<string, ParamDef>;

export type SquadronConfig = { -readonly [K in keyof typeof squadronParams]: number };

export function createSquadronConfig(): SquadronConfig {
  return defaultsOf(squadronParams);
}

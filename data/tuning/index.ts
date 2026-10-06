import { createArenaConfig, type ArenaConfig } from './arena';
import { arenaParams } from './arena';
import { cameraParams } from './camera';
import { flightParams } from './flight';
import { hudParams } from './hud';
import { weaponsParams } from './weapons';
import { createCameraConfig, type CameraConfig } from './camera';
import { createHudConfig, type HudConfig } from './hud';
import { createFlightConfig, type FlightConfig } from './flight';
import { createWeaponsConfig, type WeaponsConfig } from './weapons';
import { createLockOnConfig, lockonParams, type LockOnConfig } from './lockon';
import { createMissilesConfig, missilesParams, type MissilesConfig } from './missiles';
import { createFighterConfig, fighterParams, type FighterConfig } from './fighter';
import { createLancerConfig, lancerParams, type LancerConfig } from './lancer';
import { createSquadronConfig, squadronParams, type SquadronConfig } from './squadron';
import { createRunConfig, runParams, type RunConfig } from './run';
import { createPilotsConfig, pilotsParams, type PilotsConfig } from './pilots';
import { createRescueConfig, rescueParams, type RescueConfig } from './rescue';
import { createChatterConfig, chatterParams, type ChatterConfig } from './chatter';
import { createGunshipConfig, gunshipParams, type GunshipConfig } from './gunship';
import { createWingsConfig, wingsParams, type WingsConfig } from './wings';
import { capitalParams, createCapitalConfig, type CapitalConfig } from './capital';

/** All live-tunable values. Core reads these through `world.tuning`; the dev panel edits them. */
export interface Tuning {
  flight: FlightConfig;
  camera: CameraConfig;
  weapons: WeaponsConfig;
  arena: ArenaConfig;
  hud: HudConfig;
  lockon: LockOnConfig;
  missiles: MissilesConfig;
  fighter: FighterConfig;
  lancer: LancerConfig;
  squadron: SquadronConfig;
  run: RunConfig;
  pilots: PilotsConfig;
  rescue: RescueConfig;
  chatter: ChatterConfig;
  gunship: GunshipConfig;
  wings: WingsConfig;
  /** Prototype 5, track C: the capital ship. */
  capital: CapitalConfig;
}

export function createTuning(): Tuning {
  return {
    flight: createFlightConfig(),
    camera: createCameraConfig(),
    weapons: createWeaponsConfig(),
    arena: createArenaConfig(),
    hud: createHudConfig(),
    lockon: createLockOnConfig(),
    missiles: createMissilesConfig(),
    fighter: createFighterConfig(),
    lancer: createLancerConfig(),
    squadron: createSquadronConfig(),
    run: createRunConfig(),
    pilots: createPilotsConfig(),
    rescue: createRescueConfig(),
    chatter: createChatterConfig(),
    gunship: createGunshipConfig(),
    wings: createWingsConfig(),
    capital: createCapitalConfig(),
  };
}

/** Parameter definitions (default, range, unit) for every tuning group. */
export const tuningParams = {
  flight: flightParams,
  camera: cameraParams,
  weapons: weaponsParams,
  arena: arenaParams,
  hud: hudParams,
  lockon: lockonParams,
  missiles: missilesParams,
  fighter: fighterParams,
  lancer: lancerParams,
  squadron: squadronParams,
  run: runParams,
  pilots: pilotsParams,
  rescue: rescueParams,
  chatter: chatterParams,
  gunship: gunshipParams,
  wings: wingsParams,
  capital: capitalParams,
} as const;

/** Non-numeric tuning values and the options they accept. */
export const tuningToggles: Record<keyof Tuning, Record<string, readonly (string | boolean)[]>> = {
  flight: { steering: ['point', 'rotate'], evadeSidestep: [true, false] },
  camera: { lookMode: ['velocity', 'nose'], shakeEnabled: [true, false] },
  weapons: {},
  arena: { enemiesFrozen: [false, true] },
  hud: {},
  lockon: {},
  missiles: {},
  fighter: { enemiesEvadeMissiles: [true, false] },
  lancer: {},
  squadron: { slotAnchor: ['velocity', 'nose'] },
  run: { ramp: ['authored', 'classic'] },
  pilots: {},
  rescue: {},
  chatter: {},
  gunship: {},
  wings: { shape: ['mixed', 'v', 'line', 'box'] },
  capital: {},
};

/** Plain-language tooltip for each toggle, keyed `group.name` (what it does, and what each option means). */
export const tuningToggleNotes: Record<string, string> = {
  'wings.shape':
    'Formation every wing flies. Mixed = each wing gets a V, a line abreast or a box at random; or force one to compare. A V trails behind the leader, a line is abreast of it, a box wraps the leader.',
  'run.ramp':
    "Where each battle's enemies come from. Authored = the battle table (data/content/battles.ts: fighters, formation wings, gunships and so on); Classic = the old ramp of fighter-only waves from the wave and size numbers above (useful to compare, and for tests).",
  'flight.steering':
    'How the stick steers. Point = the ship turns toward the direction you push, and a centered stick keeps its heading; Rotate = left/right turns the ship like a plane, proportional to the push. Keyboard A/D always rotates.',
  'flight.evadeSidestep':
    'Evade variant. On = the roll slides the ship sideways and gives brief invulnerability; off = no sidestep, only invulnerability and a tighter break turn.',
  'fighter.enemiesEvadeMissiles':
    'Whether enemy fighters try to dodge missiles homing on them. On = a fighter that notices a missile may roll at the right moment (the roll makes it immune, so the missile passes through and loses its lock) or get the timing wrong and be hit anyway; off = fighters ignore missiles, as before.',
  'camera.lookMode':
    'What the camera leans toward. Velocity = where the ship is actually moving, so drifting shows the direction of travel; Nose = where the ship points, so you see what you are aiming at.',
  'arena.enemiesFrozen':
    'Debug: freezes every enemy (fighters, drones, turrets). They stop moving and shooting, no new waves come and nothing respawns, but you can still shoot, lock and kill them, and your wingmen still fight. Use it to test flying, locks and missiles in peace.',
  'squadron.slotAnchor':
    'What the tight formation holds its shape against. Velocity = the direction you are actually moving, so hard turns and spins do not swing the slots around and wingmen stay in place; Nose = where you point, so the formation follows your aim but whips around when you spin.',
  'camera.shakeEnabled':
    'Screen shake when you fire or get hit. On = more punch, but can tire the eyes; off = a steady view. Strength is set by Shake.',
};

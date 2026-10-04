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
import { createSquadronConfig, squadronParams, type SquadronConfig } from './squadron';

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
  squadron: SquadronConfig;
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
    squadron: createSquadronConfig(),
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
  squadron: squadronParams,
} as const;

/** Non-numeric tuning values and the options they accept. */
export const tuningToggles: Record<keyof Tuning, Record<string, readonly (string | boolean)[]>> = {
  flight: { steering: ['point', 'rotate'], evadeSidestep: [true, false] },
  camera: { lookMode: ['velocity', 'nose'], shakeEnabled: [true, false] },
  weapons: {},
  arena: {},
  hud: {},
  lockon: {},
  missiles: {},
  fighter: {},
  squadron: { slotAnchor: ['velocity', 'nose'] },
};

/** Plain-language tooltip for each toggle, keyed `group.name` (what it does, and what each option means). */
export const tuningToggleNotes: Record<string, string> = {
  'flight.steering':
    'How the stick steers. Point = the ship turns toward the direction you push, and a centered stick keeps its heading; Rotate = left/right turns the ship like a plane, proportional to the push. Keyboard A/D always rotates.',
  'flight.evadeSidestep':
    'Evade variant. On = the roll slides the ship sideways and gives brief invulnerability; off = no sidestep, only invulnerability and a tighter break turn.',
  'camera.lookMode':
    'What the camera leans toward. Velocity = where the ship is actually moving, so drifting shows the direction of travel; Nose = where the ship points, so you see what you are aiming at.',
  'squadron.slotAnchor':
    'What the tight formation holds its shape against. Velocity = the direction you are actually moving, so hard turns and spins do not swing the slots around and wingmen stay in place; Nose = where you point, so the formation follows your aim but whips around when you spin.',
  'camera.shakeEnabled':
    'Screen shake when you fire or get hit. On = more punch, but can tire the eyes; off = a steady view. Strength is set by Shake.',
};

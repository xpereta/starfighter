/** Minimal thing bullets can hit. */
export interface Collider {
  x: number;
  y: number;
  radius: number;
  hp: number;
  alive: boolean;
  /** True while bullets pass through it (e.g. a fighter in its evade i-frames). */
  immune?: boolean;
  /** Who last damaged it: a pilot id (a wingman's bullet or missile), or 0 for the player or nobody. Used for kill credit. */
  lastHitBy?: number;
}

export type TargetKind = 'static' | 'drone' | 'turret';
/** Anything that can be destroyed with a `Killed` event. */
export type EntityKind = TargetKind | 'fighter' | 'wingman';
export type TargetMode = 'static' | 'straight' | 'circle';

/** Arena target: static drone, moving drone (straight or orbiting) or turret. */
export interface Target extends Collider {
  kind: TargetKind;
  mode: TargetMode;
  maxHp: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  /** Straight drones: heading, rad. Circle drones: current orbit angle, rad. */
  angle: number;
  speed: number;
  /** Circle drones: orbit center, radius and angular speed. */
  orbitX: number;
  orbitY: number;
  orbitRadius: number;
  omega: number;
  /** Turrets: seconds until the next shot. */
  cooldown: number;
  /** Seconds until a destroyed target returns. */
  respawnTimer: number;
}

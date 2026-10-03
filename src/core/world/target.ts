/** Minimal thing bullets can hit. */
export interface Collider {
  x: number;
  y: number;
  radius: number;
  hp: number;
  alive: boolean;
}

export type TargetKind = 'static' | 'drone' | 'turret';
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

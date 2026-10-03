import type { FlightConfig } from '../../../data/tuning/flight';
import type { EventQueue } from '../events/events';
import { clamp, DEG, lerp, TAU, wrapAngle } from '../math';
import type { Actions } from '../world/actions';
import { sampleCurve } from './curve';

/** Plane-like ship. Heading is radians counter-clockwise from +x; y is up. */
export interface Ship {
  x: number;
  y: number;
  heading: number;
  /** Angular velocity, rad/s (positive = counter-clockwise). */
  omega: number;
  /** Scalar speed along the velocity direction, u/s. */
  speed: number;
  vx: number;
  vy: number;
  /** True while beyond the arena radius (HUD warning, soft push back). */
  outside: boolean;
  /** Set by evade (i-frames); enemy shots pass through while true. */
  invulnerable: boolean;
  /** Seconds left in the current evade (0 = not evading). */
  evadeTimer: number;
  /** Seconds until evade is available again (HUD shows this). */
  evadeCooldown: number;
  /** -1 right, +1 left of the nose. */
  evadeSide: -1 | 1;
  /** Roll angle for the renderer to squash the silhouette, radians (0 when not evading). */
  roll: number;
  /** Evade is edge-triggered: the button must be released and pressed again. */
  evadeHeld: boolean;
}

export function createShip(cfg: FlightConfig): Ship {
  return {
    x: 0,
    y: 0,
    heading: 0,
    omega: 0,
    speed: cfg.cruiseSpeed,
    vx: cfg.cruiseSpeed,
    vy: 0,
    outside: false,
    invulnerable: false,
    evadeTimer: 0,
    evadeCooldown: 0,
    evadeSide: 1,
    roll: 0,
    evadeHeld: false,
  };
}

/** Max turn rate (rad/s) at a speed: the "corner speed" curve, peak at cornerSpeed. */
export function turnRateLimit(cfg: FlightConfig, speed: number): number {
  return (
    DEG *
    sampleCurve(
      [
        [cfg.minSpeed, cfg.turnRateAtMin],
        [cfg.cornerSpeed, cfg.maxTurnRate],
        [cfg.maxSpeed, cfg.turnRateAtMax],
      ],
      speed,
    )
  );
}

function stepThrottle(ship: Ship, throttle: number, cfg: FlightConfig, dt: number): void {
  if (throttle > cfg.throttleDeadband) ship.speed += cfg.accel * throttle * dt;
  else if (throttle < -cfg.throttleDeadband) ship.speed += cfg.brake * throttle * dt;
  else {
    const diff = cfg.cruiseSpeed - ship.speed;
    const step = cfg.cruiseReturnRate * dt;
    ship.speed += Math.abs(diff) < step ? diff : Math.sign(diff) * step;
  }
  ship.speed = clamp(ship.speed, cfg.minSpeed, cfg.maxSpeed);
}

/** Desired angular velocity (rad/s) for the chosen scheme, or toward the arena when outside it. */
function desiredOmega(ship: Ship, actions: Actions, cfg: FlightConfig, maxTurn: number): number {
  if (ship.outside) {
    const toCenter = Math.atan2(-ship.y, -ship.x);
    return clamp(wrapAngle(toCenter - ship.heading) * cfg.boundaryTurnGain, -1, 1) * maxTurn;
  }
  // Keyboard rotate always works; scheme B also uses the stick's X axis.
  const rotate =
    actions.rotate !== 0 ? actions.rotate : cfg.steering === 'rotate' ? actions.steerX : 0;
  if (rotate !== 0) return -clamp(rotate, -1, 1) * maxTurn;
  if (cfg.steering === 'point' && (actions.steerX !== 0 || actions.steerY !== 0)) {
    const desired = Math.atan2(actions.steerY, actions.steerX);
    return clamp(wrapAngle(desired - ship.heading) * cfg.steerGain, -1, 1) * maxTurn;
  }
  return 0;
}

/** Which side to evade toward: the stick/rotate side, else left. */
function evadeSide(ship: Ship, actions: Actions, cfg: FlightConfig): -1 | 1 {
  const rotate =
    actions.rotate !== 0 ? actions.rotate : cfg.steering === 'rotate' ? actions.steerX : 0;
  if (rotate !== 0) return Math.abs(rotate) > cfg.evadeStickThreshold ? (rotate > 0 ? -1 : 1) : 1;
  if (
    cfg.steering === 'point' &&
    Math.hypot(actions.steerX, actions.steerY) > cfg.evadeStickThreshold
  ) {
    // Cross product of the nose and the stick: positive = stick is to the left of the nose.
    const cross = Math.cos(ship.heading) * actions.steerY - Math.sin(ship.heading) * actions.steerX;
    return cross >= 0 ? 1 : -1;
  }
  return 1;
}

function stepEvade(
  ship: Ship,
  actions: Actions,
  cfg: FlightConfig,
  events: EventQueue,
  dt: number,
): void {
  ship.evadeCooldown = Math.max(0, ship.evadeCooldown - dt);
  if (actions.evade && !ship.evadeHeld && ship.evadeCooldown <= 0 && ship.evadeTimer <= 0) {
    ship.evadeTimer = cfg.evadeTime;
    ship.evadeCooldown = cfg.evadeCooldown;
    ship.evadeSide = evadeSide(ship, actions, cfg);
    events.emit({ type: 'EvadeStarted', x: ship.x, y: ship.y, side: ship.evadeSide });
  }
  ship.evadeHeld = actions.evade;
  const evading = ship.evadeTimer > 0;
  const elapsed = cfg.evadeTime - ship.evadeTimer;
  ship.invulnerable = evading && elapsed < cfg.evadeIFrames;
  ship.roll = evading ? (elapsed / cfg.evadeTime) * TAU * ship.evadeSide : 0;
}

export function stepFlight(
  ship: Ship,
  actions: Actions,
  cfg: FlightConfig,
  events: EventQueue,
  dt: number,
): void {
  stepEvade(ship, actions, cfg, events, dt);
  const evading = ship.evadeTimer > 0;
  stepThrottle(ship, actions.throttle, cfg, dt);

  ship.outside = Math.hypot(ship.x, ship.y) > cfg.arenaRadius;
  let maxTurn = turnRateLimit(cfg, ship.speed);
  if (evading && !cfg.evadeSidestep) maxTurn *= cfg.evadeBreakTurnBoost;
  const target = desiredOmega(ship, actions, cfg, maxTurn);
  const maxStep = cfg.turnAccel * DEG * dt;
  ship.omega += clamp(target - ship.omega, -maxStep, maxStep);
  ship.heading = wrapAngle(ship.heading + ship.omega * dt);

  // Grip: the velocity direction chases the nose; lower grip = more drift.
  const speedFactor = clamp((ship.speed - cfg.minSpeed) / (cfg.maxSpeed - cfg.minSpeed), 0, 1);
  const grip = lerp(cfg.grip, cfg.gripAtMaxSpeed, speedFactor);
  const velocityAngle = Math.atan2(ship.vy, ship.vx);
  const newAngle =
    velocityAngle + wrapAngle(ship.heading - velocityAngle) * (1 - Math.exp(-grip * dt));
  const speed = ship.speed * (evading ? 1 + cfg.evadeSpeedBonus : 1);
  ship.vx = Math.cos(newAngle) * speed;
  ship.vy = Math.sin(newAngle) * speed;
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  if (evading && cfg.evadeSidestep) {
    // Sidestep: a steady lateral slide that adds up to `evadeOffset` over the evade.
    const lateral = (cfg.evadeOffset / cfg.evadeTime) * ship.evadeSide * dt;
    ship.x -= Math.sin(ship.heading) * lateral;
    ship.y += Math.cos(ship.heading) * lateral;
  }
  ship.evadeTimer = Math.max(0, ship.evadeTimer - dt);
}

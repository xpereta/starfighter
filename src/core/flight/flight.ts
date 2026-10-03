import type { FlightConfig } from '../../../data/tuning/flight';
import { clamp, DEG, lerp, wrapAngle } from '../math';
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

export function stepFlight(ship: Ship, actions: Actions, cfg: FlightConfig, dt: number): void {
  stepThrottle(ship, actions.throttle, cfg, dt);

  ship.outside = Math.hypot(ship.x, ship.y) > cfg.arenaRadius;
  const maxTurn = turnRateLimit(cfg, ship.speed);
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
  ship.vx = Math.cos(newAngle) * ship.speed;
  ship.vy = Math.sin(newAngle) * ship.speed;
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
}

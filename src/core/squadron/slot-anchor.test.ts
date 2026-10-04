import { describe, expect, it } from 'vitest';
import { createFlightConfig } from '../../../data/tuning/flight';
import { createSquadronConfig } from '../../../data/tuning/squadron';
import { createEventQueue } from '../events/events';
import { createShip, stepFlight } from '../flight/flight';
import { createActions } from '../world/actions';
import { slotFrame, slotPosition } from './formation';

const frame = () => ({ x: 0, y: 0, heading: 0 });
const cfg = createSquadronConfig();
const DT = 1 / 60;

describe('slotFrame', () => {
  const ship = { x: 10, y: 20, heading: 1, vx: 0, vy: 100 };

  it('velocity anchor uses the direction of travel, nose anchor uses the heading', () => {
    expect(slotFrame(frame(), ship, 'velocity').heading).toBeCloseTo(Math.PI / 2);
    expect(slotFrame(frame(), ship, 'nose').heading).toBe(1);
    expect(slotFrame(frame(), ship, 'velocity')).toMatchObject({ x: 10, y: 20 });
  });

  it('falls back to the nose when the ship is not moving', () => {
    expect(slotFrame(frame(), { ...ship, vx: 0, vy: 0 }, 'velocity').heading).toBe(1);
  });

  it('defaults to the velocity anchor', () => {
    expect(cfg.slotAnchor).toBe('velocity');
  });
});

describe('tight slots follow the anchor', () => {
  it('sit behind the travel direction when the nose points elsewhere (velocity), or behind the nose (nose)', () => {
    // Travelling along +x while the nose points up (+y).
    const ship = { x: 0, y: 0, heading: Math.PI / 2, vx: 200, vy: 0 };
    const p = { x: 0, y: 0 };
    slotPosition(p, 'tight', 0, 2, slotFrame(frame(), ship, 'velocity'), cfg);
    expect(p.x).toBeLessThan(0); // behind the motion
    expect(Math.abs(p.y)).toBeLessThan(Math.abs(p.x) + cfg.tightRadius); // beside it, not behind the nose
    slotPosition(p, 'tight', 0, 2, slotFrame(frame(), ship, 'nose'), cfg);
    expect(p.y).toBeLessThan(0); // behind the nose (nose points up)
  });
});

describe('steadiness in hard turns', () => {
  /** Largest and total distance slot 0 moves in one tick while the ship spins hard. */
  function slotTravel(anchor: 'velocity' | 'nose'): { maxStep: number; total: number } {
    const flight = createFlightConfig();
    const ship = createShip(flight);
    const events = createEventQueue();
    const actions = createActions();
    const p = { x: 0, y: 0 };
    const last = { x: 0, y: 0 };
    let maxStep = 0;
    let total = 0;
    for (let i = 0; i < 60 * 4; i++) {
      actions.rotate = 1; // a full-rate spin
      actions.throttle = 0;
      stepFlight(ship, actions, flight, events, DT);
      slotPosition(p, 'tight', 0, 2, slotFrame(frame(), ship, anchor), cfg);
      if (i > 0) {
        // Compare slot movement relative to the ship, which is what wingmen have to chase.
        const step = Math.hypot(p.x - ship.x - last.x, p.y - ship.y - last.y);
        maxStep = Math.max(maxStep, step);
        total += step;
      }
      last.x = p.x - ship.x;
      last.y = p.y - ship.y;
    }
    return { maxStep, total };
  }

  it('the slot swings around the ship less with the velocity anchor than with the nose anchor', () => {
    const velocity = slotTravel('velocity');
    const nose = slotTravel('nose');
    expect(velocity.maxStep).toBeLessThan(nose.maxStep);
    expect(velocity.total).toBeLessThan(nose.total);
  });
});

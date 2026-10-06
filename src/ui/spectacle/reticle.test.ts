import { describe, expect, it } from 'vitest';
import {
  armLength,
  beaconRing,
  BEACON_RINGS,
  bracketDistance,
  BRACKET_FAR,
  BRACKET_NEAR,
  lockPulse,
  PULSE_SECONDS,
  reticleSpin,
} from './reticle';

describe('lock reticle', () => {
  it('brackets close in from far to near as the lock fills', () => {
    expect(bracketDistance(10, 0)).toBeCloseTo(10 * BRACKET_FAR);
    expect(bracketDistance(10, 1)).toBeCloseTo(10 * BRACKET_NEAR);
    expect(bracketDistance(10, 0.5)).toBeLessThan(bracketDistance(10, 0.2));
    expect(bracketDistance(10, 7)).toBeCloseTo(10 * BRACKET_NEAR);
  });

  it('spins faster while acquiring than once locked', () => {
    expect(reticleSpin(1, false)).toBeGreaterThan(reticleSpin(1, true));
  });

  it('the lock pulse grows and fades out', () => {
    expect(lockPulse(0)).toEqual({ scale: 1, alpha: 1 });
    expect(lockPulse(PULSE_SECONDS)).toMatchObject({ alpha: 0 });
    expect(lockPulse(PULSE_SECONDS / 2).scale).toBeGreaterThan(1);
  });
});

describe('beacon', () => {
  it('its rings are staggered, expand, and fade', () => {
    const a = beaconRing(0.4, 0);
    const b = beaconRing(0.4, 1);
    expect(a.scale).not.toBe(b.scale);
    expect(BEACON_RINGS).toBeGreaterThan(1);
    for (let i = 0; i < BEACON_RINGS; i++) {
      const r = beaconRing(3.3, i);
      expect(r.alpha).toBeGreaterThanOrEqual(0);
      expect(r.alpha).toBeLessThanOrEqual(1);
      expect(r.scale).toBeGreaterThanOrEqual(0.6);
    }
  });
});

describe('brackets', () => {
  it('arms never vanish on small targets', () => {
    expect(armLength(2)).toBe(6);
    expect(armLength(100)).toBeGreaterThan(6);
  });
});

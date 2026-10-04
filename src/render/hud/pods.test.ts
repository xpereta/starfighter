import { describe, expect, it } from 'vitest';
import {
  pipOffsets,
  podDistanceLabel,
  podLabel,
  progressEnd,
  progressRingRadius,
  rescueRingRadius,
} from './pods';

describe('pod HUD placement', () => {
  it('the progress ring is never smaller than a readable minimum, and grows with zoomed-in pods', () => {
    expect(progressRingRadius(30, 0.1)).toBeGreaterThanOrEqual(20); // maximum zoom-out
    expect(progressRingRadius(30, 1)).toBeGreaterThan(progressRingRadius(30, 0.5));
    for (const scale of [0.1, 0.3, 0.8, 1.2]) {
      // The ring always sits outside the pod's body.
      expect(progressRingRadius(30, scale)).toBeGreaterThan(30 * scale);
    }
  });

  it('the progress arc starts at 12 o clock and sweeps a full turn at 100%, clamped', () => {
    expect(progressEnd(0)).toBeCloseTo(-Math.PI / 2);
    expect(progressEnd(0.5)).toBeCloseTo(Math.PI / 2);
    expect(progressEnd(1)).toBeCloseTo(-Math.PI / 2 + Math.PI * 2);
    expect(progressEnd(2)).toBeCloseTo(progressEnd(1));
    expect(progressEnd(-1)).toBeCloseTo(progressEnd(0));
  });

  it('the rescue circle is the rescue radius scaled to pixels', () => {
    expect(rescueRingRadius(160, 0.5)).toBe(80);
  });

  it('hit-point pips are centered in a row', () => {
    expect(pipOffsets(1)).toEqual([0]);
    const three = pipOffsets(3);
    expect(three).toHaveLength(3);
    expect(three[0]! + three[2]!).toBeCloseTo(0);
    expect(three[1]).toBeCloseTo(0);
    expect(pipOffsets(0)).toEqual([]);
    expect(pipOffsets(-2)).toEqual([]);
  });

  it('labels: the distance next to the arrow, and the progress once the rescue has started', () => {
    expect(podDistanceLabel(2143.6)).toBe('POD 2144 u');
    expect(podLabel(0)).toBe('RESCUE');
    expect(podLabel(0.456)).toBe('RESCUE 46%');
    expect(podLabel(3)).toBe('RESCUE 100%');
  });
});

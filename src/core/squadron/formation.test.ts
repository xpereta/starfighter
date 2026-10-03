import { describe, expect, it } from 'vitest';
import { createSquadronConfig } from '../../../data/tuning/squadron';
import { TAU } from '../math';
import { slotPosition } from './formation';

const cfg = createSquadronConfig();
const out = { x: 0, y: 0 };

/** The slot in the player's own frame: forward along the nose, left of the nose. */
function inPlayerFrame(
  index: number,
  count: number,
  heading: number,
  formation: 'tight' | 'spread',
) {
  const player = { x: 1000, y: -500, heading };
  const p = slotPosition({ x: 0, y: 0 }, formation, index, count, player, cfg);
  const dx = p.x - player.x;
  const dy = p.y - player.y;
  return {
    forward: dx * Math.cos(heading) + dy * Math.sin(heading),
    left: -dx * Math.sin(heading) + dy * Math.cos(heading),
  };
}

describe('tight formation', () => {
  it('puts wingmen behind the player, index 0 on the left and index 1 on the right', () => {
    for (const heading of [0, 1, -2.5]) {
      const first = inPlayerFrame(0, 4, heading, 'tight');
      const second = inPlayerFrame(1, 4, heading, 'tight');
      expect(first.forward).toBeLessThan(0);
      expect(second.forward).toBeLessThan(0);
      expect(first.left).toBeGreaterThan(0);
      expect(second.left).toBeLessThan(0);
      expect(first.left).toBeCloseTo(-second.left); // mirror images
      expect(first.forward).toBeCloseTo(second.forward);
    }
  });

  it('scales with tightRadius and stacks further pairs further back and out', () => {
    const near = inPlayerFrame(0, 4, 0, 'tight');
    const far = inPlayerFrame(2, 4, 0, 'tight');
    expect(far.forward).toBeLessThan(near.forward); // further back
    expect(far.left).toBeGreaterThan(near.left); // and further out
    const wide = slotPosition(
      { x: 0, y: 0 },
      'tight',
      0,
      2,
      { x: 0, y: 0, heading: 0 },
      {
        ...cfg,
        tightRadius: cfg.tightRadius * 2,
      },
    );
    const base = slotPosition({ x: 0, y: 0 }, 'tight', 0, 2, { x: 0, y: 0, heading: 0 }, cfg);
    expect(Math.hypot(wide.x, wide.y)).toBeCloseTo(2 * Math.hypot(base.x, base.y));
  });

  it('gives every wingman a distinct slot with 1 to 4 wingmen, none on top of the player', () => {
    for (let count = 1; count <= 4; count++) {
      const slots: [number, number][] = [];
      for (let i = 0; i < count; i++) {
        const s = slotPosition(
          { x: 0, y: 0 },
          'tight',
          i,
          count,
          { x: 0, y: 0, heading: 0.7 },
          cfg,
        );
        slots.push([s.x, s.y]);
        expect(Math.hypot(s.x, s.y)).toBeGreaterThan(cfg.separation);
      }
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          expect(
            Math.hypot(slots[i]![0] - slots[j]![0], slots[i]![1] - slots[j]![1]),
          ).toBeGreaterThan(cfg.separation);
        }
      }
    }
  });
});

describe('spread formation', () => {
  it('places wingmen on a ring of spreadRadius around the player, evenly spaced', () => {
    for (let count = 1; count <= 4; count++) {
      const angles: number[] = [];
      for (let i = 0; i < count; i++) {
        slotPosition(out, 'spread', i, count, { x: 300, y: 200, heading: 1.2 }, cfg);
        expect(Math.hypot(out.x - 300, out.y - 200)).toBeCloseTo(cfg.spreadRadius);
        angles.push(Math.atan2(out.y - 200, out.x - 300));
      }
      if (count > 1) {
        const step = TAU / count;
        for (let i = 1; i < count; i++) {
          const gap = (angles[i]! - angles[i - 1]! + TAU) % TAU;
          expect(gap).toBeCloseTo(step);
        }
      }
    }
  });

  it('does not rotate with the player heading (the ring is fixed in the world)', () => {
    const a = slotPosition({ x: 0, y: 0 }, 'spread', 1, 3, { x: 0, y: 0, heading: 0 }, cfg);
    const b = slotPosition({ x: 0, y: 0 }, 'spread', 1, 3, { x: 0, y: 0, heading: 2 }, cfg);
    expect(a).toEqual(b);
  });

  it('is wider than the tight formation', () => {
    const tight = inPlayerFrame(0, 2, 0, 'tight');
    const spread = inPlayerFrame(0, 2, 0, 'spread');
    expect(Math.hypot(spread.forward, spread.left)).toBeGreaterThan(
      Math.hypot(tight.forward, tight.left),
    );
  });
});

import { describe, expect, it } from 'vitest';
import type { Pilot } from '../pilots/pilots';
import {
  applyFinishedRun,
  applyRunEnd,
  battlesCleared,
  createMeta,
  veteranOffers,
  type MetaData,
} from './meta';

const pilot = (over: Partial<Pilot> & { id: number }): Pilot => ({
  name: `Pilot ${over.id}`,
  trait: 'bold',
  kills: 0,
  battles: 3,
  status: 'active',
  veteran: false,
  ...over,
});

const meta = (): MetaData => ({
  veterans: [
    { id: 1, name: 'Old Hand', trait: 'steady', kills: 10, runs: 2 },
    { id: 2, name: 'Quiet One', trait: 'hunter', kills: 3, runs: 1 },
  ],
  bestRun: 2,
});

describe('promotion at the end of a run', () => {
  it('every pilot still active becomes a new veteran', () => {
    const next = applyRunEnd(createMeta(), [pilot({ id: 1, kills: 4 }), pilot({ id: 2 })], 4, 8);
    expect(next.veterans).toEqual([
      { id: 1, name: 'Pilot 1', trait: 'bold', kills: 4, runs: 1 },
      { id: 2, name: 'Pilot 2', trait: 'bold', kills: 0, runs: 1 },
    ]);
  });

  it('a saved veteran who survives stays one: runs + 1 and its kills updated', () => {
    const next = applyRunEnd(
      meta(),
      [pilot({ id: 5, name: 'Old Hand', trait: 'steady', kills: 13, veteran: true, veteranId: 1 })],
      4,
      8,
    );
    expect(next.veterans.find((v) => v.id === 1)).toEqual({
      id: 1,
      name: 'Old Hand',
      trait: 'steady',
      kills: 13,
      runs: 3,
    });
  });

  it('a saved veteran who is lost is deleted for good', () => {
    const next = applyRunEnd(
      meta(),
      [pilot({ id: 5, name: 'Old Hand', veteran: true, veteranId: 1, status: 'lost' })],
      1,
      8,
    );
    expect(next.veterans.map((v) => v.id)).toEqual([2]);
  });

  it('a lost pilot who was never a veteran leaves no trace', () => {
    const next = applyRunEnd(meta(), [pilot({ id: 5, status: 'lost', kills: 9 })], 1, 8);
    expect(next.veterans).toEqual(meta().veterans);
  });

  it('veterans who stayed home are untouched, and new ids never collide', () => {
    const next = applyRunEnd(meta(), [pilot({ id: 5 })], 2, 8);
    expect(next.veterans.map((v) => v.id)).toEqual([1, 2, 3]);
    expect(next.veterans[0]).toEqual(meta().veterans[0]);
  });

  it('a new pilot with the same name as a saved veteran is a separate veteran', () => {
    const next = applyRunEnd(meta(), [pilot({ id: 5, name: 'Old Hand', kills: 1 })], 2, 8);
    expect(next.veterans.filter((v) => v.name === 'Old Hand')).toHaveLength(2);
  });

  it('past the cap the veterans with the fewest kills are dropped, best first by kills then runs', () => {
    const roster = [1, 2, 3].map((i) => pilot({ id: i, kills: i }));
    const next = applyRunEnd(meta(), roster, 2, 4);
    expect(next.veterans).toHaveLength(4);
    expect(next.veterans.map((v) => v.kills).sort((a, b) => b - a)).toEqual([10, 3, 3, 2]);
    expect(applyRunEnd(meta(), roster, 2, 1).veterans.map((v) => v.kills)).toEqual([10]);
  });

  it('does not change its input', () => {
    const before = meta();
    applyRunEnd(before, [pilot({ id: 5, veteranId: 1, veteran: true, status: 'lost' })], 3, 8);
    expect(before).toEqual(meta());
  });
});

describe('best run', () => {
  it('counts battles cleared: all of them on a victory, the ones before the lost one on defeat', () => {
    expect(battlesCleared({ battle: 4, result: 'victory' })).toBe(4);
    expect(battlesCleared({ battle: 3, result: 'defeat' })).toBe(2);
    expect(battlesCleared({ battle: 1, result: 'defeat' })).toBe(0);
  });

  it('improves only when the run did better', () => {
    expect(applyRunEnd(createMeta(), [], 0, 8).bestRun).toBe(0);
    expect(applyRunEnd(meta(), [], 3, 8).bestRun).toBe(3);
    expect(applyRunEnd(meta(), [], 1, 8).bestRun).toBe(2);
  });

  it('applyFinishedRun reads the battle and result from the run', () => {
    const next = applyFinishedRun(meta(), [], { battle: 4, result: 'victory' }, 8);
    expect(next.bestRun).toBe(4);
  });
});

describe('what the Start screen offers', () => {
  it('lists every veteran with its save id', () => {
    expect(veteranOffers(meta())).toEqual([
      { id: 1, name: 'Old Hand', trait: 'steady', kills: 10, veteran: true },
      { id: 2, name: 'Quiet One', trait: 'hunter', kills: 3, veteran: true },
    ]);
  });
});

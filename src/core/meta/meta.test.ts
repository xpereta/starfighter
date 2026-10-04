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

  it('past the cap the fewest-kills veteran who stayed home is dropped; veterans who flew are protected', () => {
    // 10 and 3 stayed home; the three new pilots (kills 1, 2, 3) flew. Cap 4: one of the five goes.
    const roster = [1, 2, 3].map((i) => pilot({ id: i, kills: i }));
    const next = applyRunEnd(meta(), roster, 2, 4);
    expect(next.veterans).toHaveLength(4);
    // Quiet One (3 kills) stayed home and is dropped, although two fliers have fewer kills.
    expect(next.veterans.map((v) => v.name)).not.toContain('Quiet One');
    expect(next.veterans.map((v) => v.kills).sort((a, b) => b - a)).toEqual([10, 3, 2, 1]);
  });

  it('the dropped veteran who stayed home is the one with the fewest kills; a tie goes to the fewer runs, then the newer id', () => {
    const home = (id: number, kills: number, runs: number): MetaData['veterans'][number] => ({
      id,
      name: `Home ${id}`,
      trait: 'steady',
      kills,
      runs,
    });
    const roster = [pilot({ id: 1, kills: 20 })];
    const names = (m: MetaData) => m.veterans.map((v) => v.name).sort();
    // Cap 3 with a flier and three at home: one at home goes. Fewest kills first.
    const fewest = applyRunEnd(
      { veterans: [home(1, 5, 1), home(2, 2, 1), home(3, 9, 1)], bestRun: null },
      roster,
      1,
      3,
    );
    expect(names(fewest)).toEqual(['Home 1', 'Home 3', 'Pilot 1']);
    // A tie on kills: fewer runs goes.
    const tieRuns = applyRunEnd(
      { veterans: [home(1, 4, 3), home(2, 4, 1), home(3, 9, 1)], bestRun: null },
      roster,
      1,
      3,
    );
    expect(names(tieRuns)).toEqual(['Home 1', 'Home 3', 'Pilot 1']);
    // A tie on kills and runs: the newer id goes.
    const tieId = applyRunEnd(
      { veterans: [home(1, 4, 1), home(2, 4, 1), home(3, 9, 1)], bestRun: null },
      roster,
      1,
      3,
    );
    expect(names(tieId)).toEqual(['Home 1', 'Home 3', 'Pilot 1']);
  });

  it('when everyone left flew, the fewest-kills veteran goes, as before', () => {
    const saved: MetaData = {
      veterans: [
        { id: 1, name: 'A', trait: 'steady', kills: 10, runs: 1 },
        { id: 2, name: 'B', trait: 'bold', kills: 1, runs: 1 },
      ],
      bestRun: null,
    };
    const roster = [
      pilot({ id: 11, name: 'A', veteran: true, veteranId: 1, kills: 12 }),
      pilot({ id: 12, name: 'B', veteran: true, veteranId: 2, kills: 2 }),
      pilot({ id: 13, name: 'C', kills: 7 }),
    ];
    const next = applyRunEnd(saved, roster, 4, 2);
    expect(next.veterans.map((v) => v.name)).toEqual(['A', 'C']);
  });

  it('a cap of zero keeps nobody', () => {
    expect(applyRunEnd(meta(), [pilot({ id: 1 })], 1, 0).veterans).toEqual([]);
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

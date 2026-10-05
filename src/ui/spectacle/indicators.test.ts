import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { createFighter } from '../../core/ai/fighter';
import { createWorld } from '../../core/world/world';
import {
  collectIndicators,
  compareIndicators,
  distanceLabel,
  MAX_INDICATORS,
  THREAT_RANGE,
  type Indicator,
} from './indicators';

const view = { width: 1000, height: 600 };
const screen = { width: 1000, height: 600 };
const center = { x: 0, y: 0 };

function worldWith() {
  const world = createWorld(1, createTuning());
  world.targets.length = 0;
  world.fighters.length = 0;
  world.pods.length = 0;
  world.squadron.wingmen.length = 0;
  return world;
}

const fighterAt = (world: ReturnType<typeof worldWith>, x: number, y: number, chasing: boolean) => {
  const f = createFighter(world.tuning.flight, x, y, 0, 3, 20, 1);
  f.targetIndex = chasing ? -1 : 0;
  world.fighters.push(f);
};

describe('distance label', () => {
  it('rounds near distances to tens and far ones to thousands', () => {
    expect(distanceLabel(347)).toBe('350');
    expect(distanceLabel(999)).toBe('1000');
    expect(distanceLabel(1240)).toBe('1.2K');
    expect(distanceLabel(12000)).toBe('12.0K');
  });
});

describe('collectIndicators', () => {
  it('lists nothing for targets that are on screen', () => {
    const world = worldWith();
    fighterAt(world, 100, 50, true);
    expect(collectIndicators([], world, center, view, screen, world.tuning.hud)).toHaveLength(0);
  });

  it('marks a close chasing fighter as a threat and a far one as not', () => {
    const world = worldWith();
    fighterAt(world, THREAT_RANGE * 0.5, 0, true);
    fighterAt(world, -THREAT_RANGE * 3, 0, true);
    fighterAt(world, 0, THREAT_RANGE * 0.5, false);
    world.ship.x = 0;
    world.ship.y = 0;
    const out = collectIndicators([], world, center, view, screen, world.tuning.hud);
    expect(out.filter((i) => i.threat)).toHaveLength(1);
    expect(out).toHaveLength(3);
    expect(out.find((i) => i.threat)!.opacity).toBe(1);
  });

  it('puts the arrow on the screen edge in the target direction and gives it a label', () => {
    const world = worldWith();
    world.pods.push({
      x: 3000,
      y: 0,
      vx: 0,
      vy: 0,
      hp: 3,
      alive: true,
      progress: 0,
      pilotId: 0,
      battle: 1,
      rescued: false,
    });
    const [i] = collectIndicators([], world, center, view, screen, world.tuning.hud);
    expect(i!.kind).toBe('pod');
    expect(i!.x).toBeGreaterThan(screen.width / 2);
    expect(i!.angle).toBeCloseTo(0);
    expect(i!.label).toBe('3.0K');
  });

  it('caps the list, keeping threats and pods first, then the nearest', () => {
    const world = worldWith();
    for (let n = 0; n < MAX_INDICATORS + 6; n++) fighterAt(world, 2000 + n * 300, 0, false);
    fighterAt(world, 99999, 0, false);
    const out = collectIndicators([], world, center, view, screen, world.tuning.hud);
    expect(out).toHaveLength(MAX_INDICATORS);
    expect(Math.max(...out.map((o) => o.distance))).toBeLessThan(99999);
  });

  it('orders threats before others and pods before enemies', () => {
    const base: Indicator = {
      kind: 'drone',
      x: 0,
      y: 0,
      angle: 0,
      distance: 100,
      threat: false,
      size: 1,
      opacity: 1,
      label: '',
    };
    const threat = { ...base, kind: 'fighter' as const, threat: true, distance: 900 };
    const pod = { ...base, kind: 'pod' as const, distance: 500 };
    expect([base, pod, threat].sort(compareIndicators)).toEqual([threat, pod, base]);
  });
});

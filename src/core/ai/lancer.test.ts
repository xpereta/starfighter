import { describe, expect, it } from 'vitest';
import { createLancerConfig } from '../../../data/tuning/lancer';
import { createTuning } from '../../../data/tuning';
import { lancerKind } from '../../../data/content/kinds/lancer';
import { DEG, wrapAngle } from '../math';
import { hashWorld } from '../replay/hash';
import { createWorld, type World } from '../world/world';
import { stepFighters } from './fighters';
import {
  burstSizeFor,
  canLaunch,
  CIRCLE_ANGLE,
  convertWaveToLancers,
  createLancer,
  FLEE_ANGLE,
  lancerMove,
  lancersInWave,
  spawnLancer,
  type LancerMove,
} from './lancer';
import { spawnFighter } from './waves';

const DT = 1 / 60;
const cfg = createLancerConfig();
const out = (): LancerMove => ({ desired: 0, throttle: 0, mode: 'circle' });

describe('lancerMove', () => {
  it('pursues flat out beyond the maximum range', () => {
    const m = lancerMove(out(), 0.4, cfg.rangeMax + 1, 1, false, cfg);
    expect(m).toMatchObject({ mode: 'pursue', desired: 0.4, throttle: 1 });
  });
  it('flees nearly straight away flat out inside the minimum range, on its side', () => {
    const left = lancerMove(out(), 0, cfg.rangeMin - 1, 1, true, cfg);
    const right = lancerMove(out(), 0, cfg.rangeMin - 1, -1, true, cfg);
    expect(left.mode).toBe('flee');
    expect(left.throttle).toBe(1);
    expect(left.desired).toBeCloseTo(FLEE_ANGLE);
    expect(right.desired).toBeCloseTo(-FLEE_ANGLE);
  });
  it('in the band it points at the player when a missile is due and circles otherwise', () => {
    const mid = (cfg.rangeMin + cfg.rangeMax) / 2;
    const aim = lancerMove(out(), 1, mid, 1, true, cfg);
    expect(aim).toMatchObject({ mode: 'aim', desired: 1, throttle: 0 });
    const circle = lancerMove(out(), 1, mid, -1, false, cfg);
    expect(circle.mode).toBe('circle');
    expect(circle.desired).toBeCloseTo(1 - CIRCLE_ANGLE);
  });
  it('the band edges belong to the band', () => {
    expect(lancerMove(out(), 0, cfg.rangeMin, 1, false, cfg).mode).toBe('circle');
    expect(lancerMove(out(), 0, cfg.rangeMax, 1, false, cfg).mode).toBe('circle');
  });
});

describe('a band edited the wrong way round', () => {
  const bad = { rangeMin: 1200, rangeMax: 800, launchCone: 25 };
  it('collapses to a line at rangeMin: never both pursuing and fleeing', () => {
    expect(lancerMove(out(), 0, 1199, 1, true, bad).mode).toBe('flee');
    expect(lancerMove(out(), 0, 1201, 1, true, bad).mode).toBe('pursue');
    expect(lancerMove(out(), 0, 1200, 1, true, bad).mode).toBe('aim');
    expect(canLaunch(bad, 1200, 0, false)).toBe(true);
    expect(canLaunch(bad, 1000, 0, false)).toBe(false);
  });
});

describe('canLaunch', () => {
  const mid = (cfg.rangeMin + cfg.rangeMax) / 2;
  it('needs the band, the nose within the cone and no evading', () => {
    expect(canLaunch(cfg, mid, 0, false)).toBe(true);
    expect(canLaunch(cfg, mid, cfg.launchCone * DEG - 0.01, false)).toBe(true);
    expect(canLaunch(cfg, mid, cfg.launchCone * DEG + 0.01, false)).toBe(false);
    expect(canLaunch(cfg, mid, -cfg.launchCone * DEG - 0.01, false)).toBe(false);
    expect(canLaunch(cfg, cfg.rangeMin - 1, 0, false)).toBe(false);
    expect(canLaunch(cfg, cfg.rangeMax + 1, 0, false)).toBe(false);
    expect(canLaunch(cfg, mid, 0, true)).toBe(false);
  });
});

describe('burstSizeFor and lancersInWave', () => {
  it('single shots in practice and before the burst battle, pairs from it on', () => {
    expect(burstSizeFor(cfg, false, 4)).toBe(1);
    expect(burstSizeFor(cfg, true, cfg.burstFromBattle - 1)).toBe(1);
    expect(burstSizeFor(cfg, true, cfg.burstFromBattle)).toBe(cfg.burstSize);
    expect(burstSizeFor({ ...cfg, burstSize: 0.2 }, true, 9)).toBe(1);
  });
  it('the ramp: none in battles 1-2, one then pairs in battle 3, lancers join halfway in battle 4', () => {
    expect([1, 2, 3].map((w) => lancersInWave(1, w))).toEqual([0, 0, 0]);
    expect([1, 2, 3].map((w) => lancersInWave(2, w))).toEqual([0, 0, 0]);
    expect([1, 2, 3].map((w) => lancersInWave(3, w))).toEqual([1, 2, 2]);
    expect([1, 2, 3, 4].map((w) => lancersInWave(4, w))).toEqual([0, 0, 2, 2]);
    expect(lancersInWave(3, 9)).toBe(2); // the last entry repeats
    expect(lancersInWave(9, 1)).toBe(0);
    expect(lancersInWave(3, 0)).toBe(0);
  });
});

function scene(tweak?: (w: World) => void): { world: World; k: number } {
  const tuning = createTuning();
  tuning.fighter.waveSize = 0;
  tuning.squadron.wingmanCount = 0;
  tuning.arena.turretCount = 0;
  tuning.arena.droneCount = 0;
  tuning.arena.staticCount = 0;
  const world = createWorld(9, tuning);
  tweak?.(world);
  return { world, k: -1 };
}

function ai(world: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    world.events.clear();
    world.tick += 1;
    world.time += DT;
    stepFighters(world);
  }
}

describe('a lancer', () => {
  it('is a fighter with the kind hull and radius, its own speed scale and a staggered first launch', () => {
    const { world } = scene();
    const a = createLancer(world, 0, 0, 0);
    const b = createLancer(world, 0, 0, 0);
    expect(a.hp).toBe(lancerKind.hull);
    expect(a.maxHp).toBe(lancerKind.hull);
    expect(a.radius).toBe(lancerKind.radius);
    expect(a.lancer).not.toBeNull();
    expect(a.lancer!.missileTimer).toBeGreaterThan(0);
    expect(a.lancer!.missileTimer).toBeLessThanOrEqual(world.tuning.lancer.missileInterval);
    expect(a.lancer!.missileTimer).not.toBe(b.lancer!.missileTimer);
  });

  it('spawnLancer reuses a dead slot, like fighters', () => {
    const { world } = scene();
    const k = spawnFighter(world, 0, 0, 0);
    world.fighters[k]!.alive = false;
    expect(spawnLancer(world, 5, 5, 0)).toBe(k);
    expect(world.fighters[k]!.lancer).not.toBeNull();
  });

  it('flies faster than a fighter at the default tuning', () => {
    const { world } = scene();
    const t = world.tuning;
    expect(t.lancer.speedScale).toBeGreaterThan(t.fighter.speedScale);
  });

  it('fires its first missile on time, in the band and pointing at the player, then waits the interval', () => {
    const { world } = scene();
    const mid = (world.tuning.lancer.rangeMin + world.tuning.lancer.rangeMax) / 2;
    const k = spawnLancer(world, mid, 0, Math.PI); // facing the player at the origin
    const f = world.fighters[k]!;
    f.ship.speed = world.tuning.flight.minSpeed;
    f.lancer!.missileTimer = 1;
    const firedAt: number[] = [];
    for (let i = 0; i < 20 * 60; i++) {
      world.ship.x = 0;
      world.ship.y = 0;
      ai(world);
      if (world.events.events.some((e) => e.type === 'EnemyMissileFired')) firedAt.push(world.time);
      // Keep the lancer in the band, facing the player: the test is about the timer.
      f.ship.x = f.x = mid;
      f.ship.y = f.y = 0;
      f.ship.heading = Math.PI;
    }
    expect(firedAt.length).toBeGreaterThanOrEqual(3);
    expect(firedAt[0]).toBeGreaterThan(0.9);
    expect(firedAt[0]).toBeLessThan(1.1);
    const interval = world.tuning.lancer.missileInterval;
    expect(firedAt[1]! - firedAt[0]!).toBeGreaterThanOrEqual(interval - 0.05);
    expect(firedAt[1]! - firedAt[0]!).toBeLessThanOrEqual(interval + 0.1);
  });

  it('does not fire out of range, nose off the player, or while evading', () => {
    for (const [label, setup] of [
      ['far', (f: ReturnType<typeof createLancer>) => (f.x = f.ship.x = 4000)],
      ['close', (f: ReturnType<typeof createLancer>) => (f.x = f.ship.x = 300)],
      ['side-on', (f: ReturnType<typeof createLancer>) => (f.ship.heading = Math.PI / 2)],
      ['evading', (f: ReturnType<typeof createLancer>) => (f.ship.evadeTimer = 0.4)],
    ] as const) {
      const { world } = scene();
      const k = spawnLancer(world, 1200, 0, Math.PI);
      const f = world.fighters[k]!;
      f.lancer!.missileTimer = 0;
      setup(f);
      ai(world);
      expect(
        world.events.events.some((e) => e.type === 'EnemyMissileFired'),
        label,
      ).toBe(false);
    }
  });

  it('a burst launches the pair `burstGap` apart and only from the burst battle on', () => {
    const { world } = scene();
    world.run.mode = 'run';
    world.run.battle = world.tuning.lancer.burstFromBattle;
    const k = spawnLancer(world, 1200, 0, Math.PI);
    const f = world.fighters[k]!;
    f.lancer!.missileTimer = 0;
    const times: number[] = [];
    for (let i = 0; i < 4 * 60; i++) {
      world.ship.x = 0;
      world.ship.y = 0;
      ai(world);
      if (world.events.events.some((e) => e.type === 'EnemyMissileFired')) times.push(world.time);
      f.ship.x = f.x = 1200;
      f.ship.y = f.y = 0;
      f.ship.heading = Math.PI;
    }
    expect(times.length).toBe(world.tuning.lancer.burstSize);
    expect(times[1]! - times[0]!).toBeCloseTo(world.tuning.lancer.burstGap, 1);
  });

  it('losing the burst when it must evade: the rest is dropped', () => {
    const { world } = scene();
    const k = spawnLancer(world, 1200, 0, Math.PI);
    const f = world.fighters[k]!;
    f.lancer!.burstLeft = 1;
    f.lancer!.burstTimer = 0.2;
    f.ship.evadeTimer = 0.3;
    ai(world);
    expect(f.lancer!.burstLeft).toBe(0);
  });

  it('always targets the player, never a wingman standing closer', () => {
    const { world } = scene((w) => {
      w.tuning.squadron.wingmanCount = 1;
    });
    // Run one real step so the wingman exists.
    ai(world);
    const k = spawnLancer(world, 3000, 0, Math.PI);
    const f = world.fighters[k]!;
    f.targetIndex = 0;
    ai(world, 5);
    expect(f.targetIndex).toBe(-1);
  });

  it('turns toward the player when pursuing', () => {
    const { world } = scene();
    const k = spawnLancer(world, 4000, 0, Math.PI / 2); // nose perpendicular to the player
    const f = world.fighters[k]!;
    for (let i = 0; i < 180; i++) ai(world);
    const toPlayer = Math.atan2(world.ship.y - f.y, world.ship.x - f.x);
    expect(Math.abs(wrapAngle(toPlayer - f.ship.heading))).toBeLessThan(0.6);
  });
});

describe('convertWaveToLancers', () => {
  it('turns the ramp count of a freshly spawned wave into lancers in place, keeping size and positions', () => {
    const { world } = scene();
    for (let i = 0; i < 5; i++) spawnFighter(world, 100 * i, 50, 0.1 * i);
    world.run.battle = 3;
    world.run.wave = 2;
    const before = world.fighters.map((f) => [f.x, f.y, f.ship.heading]);
    convertWaveToLancers(world);
    expect(world.fighters.length).toBe(5);
    expect(world.fighters.filter((f) => f.lancer).length).toBe(2);
    world.fighters.forEach((f, i) => {
      expect([f.x, f.y, f.ship.heading]).toEqual(before[i]);
    });
  });
  it('does nothing in battles without lancers', () => {
    const { world } = scene();
    for (let i = 0; i < 3; i++) spawnFighter(world, 100 * i, 50, 0);
    world.run.battle = 1;
    world.run.wave = 1;
    const h = hashWorld(world);
    convertWaveToLancers(world);
    expect(hashWorld(world)).toBe(h);
  });
});

describe('hash', () => {
  it('a lancer changes the hash; an ordinary fighter does not carry lancer state', () => {
    const a = scene().world;
    const b = scene().world;
    spawnFighter(a, 500, 0, 0);
    spawnFighter(b, 500, 0, 0);
    expect(hashWorld(a)).toBe(hashWorld(b));
    b.fighters[0]!.lancer = createLancer(b, 500, 0, 0).lancer;
    expect(hashWorld(a)).not.toBe(hashWorld(b));
  });
});

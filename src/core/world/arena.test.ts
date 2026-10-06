import { describe, expect, it } from 'vitest';
import { createArenaConfig, type ArenaConfig } from '../../../data/tuning/arena';
import { createFlightConfig } from '../../../data/tuning/flight';
import { createEventQueue } from '../events/events';
import { createShip } from '../flight/flight';
import { createRng } from '../rng/rng';
import {
  createEnemyShotPool,
  createTargets,
  resolveKills,
  stepEnemyShots,
  stepTargets,
} from './arena';

const DT = 1 / 60;
const flight = createFlightConfig();
const arena = (over: Partial<ArenaConfig> = {}): ArenaConfig => ({
  ...createArenaConfig(),
  ...over,
});

describe('createTargets', () => {
  it('builds 20 static drones, 10 moving drones (half orbiting) and 2 turrets', () => {
    const t = createTargets(arena(), createRng(1));
    const count = (kind: string, mode?: string) =>
      t.filter((x) => x.kind === kind && (mode === undefined || x.mode === mode)).length;
    expect(count('static')).toBe(20);
    expect(count('drone')).toBe(10);
    expect(count('drone', 'circle')).toBe(5);
    expect(count('drone', 'straight')).toBe(5);
    expect(count('turret')).toBe(2);
    expect(t.every((x) => x.alive && x.hp === x.maxHp)).toBe(true);
  });

  it('is deterministic per seed and differs between seeds', () => {
    const a = createTargets(arena(), createRng(7));
    expect(createTargets(arena(), createRng(7))).toEqual(a);
    expect(createTargets(arena(), createRng(8))).not.toEqual(a);
  });

  it('places statics inside their spawn band', () => {
    const cfg = arena();
    for (const t of createTargets(cfg, createRng(3)).filter((x) => x.kind === 'static')) {
      const r = Math.hypot(t.x, t.y);
      expect(r).toBeGreaterThanOrEqual(cfg.staticSpawnMin - 1e-6);
      expect(r).toBeLessThanOrEqual(cfg.staticSpawnMax + 1e-6);
    }
  });
});

describe('moving drones', () => {
  it('straight drones keep speed and turn back at the arena edge', () => {
    const cfg = arena({
      droneCount: 1,
      droneCircleShare: 0,
      staticCount: 0,
      turretCount: 0,
      droneSpawnMin: 100,
      droneSpawnMax: 500,
    });
    const [d] = createTargets(cfg, createRng(2));
    const ship = createShip(flight);
    const shots = createEnemyShotPool(cfg);
    const rng = createRng(2);
    let furthest = 0;
    for (let i = 0; i < 60 * 300; i++) {
      stepTargets([d!], ship, cfg, 1000, shots, rng, false, DT);
      furthest = Math.max(furthest, Math.hypot(d!.x, d!.y));
    }
    expect(Math.hypot(d!.vx, d!.vy)).toBeCloseTo(d!.speed, 3);
    expect(furthest).toBeLessThan(1000 + 2 * d!.speed);
  });

  it('circling drones stay on their orbit at the configured speed', () => {
    const cfg = arena({ droneCount: 1, droneCircleShare: 1, staticCount: 0, turretCount: 0 });
    const [d] = createTargets(cfg, createRng(4));
    const ship = createShip(flight);
    const shots = createEnemyShotPool(cfg);
    for (let i = 0; i < 600; i++) {
      stepTargets([d!], ship, cfg, 6000, shots, createRng(1), false, DT);
      expect(Math.hypot(d!.x - d!.orbitX, d!.y - d!.orbitY)).toBeCloseTo(d!.orbitRadius, 3);
    }
    expect(Math.hypot(d!.vx, d!.vy)).toBeCloseTo(d!.speed, 1);
  });
});

describe('kills and respawn', () => {
  it('emits Killed once at 0 hp, then respawns at home after the delay', () => {
    const cfg = arena({ staticCount: 1, droneCount: 0, turretCount: 0, respawnDelay: 2 });
    const targets = createTargets(cfg, createRng(1));
    const t = targets[0]!;
    const events = createEventQueue();
    const ship = createShip(flight);
    const shots = createEnemyShotPool(cfg);
    t.hp = 0;
    expect(resolveKills(targets, cfg, events)).toBe(1);
    expect(resolveKills(targets, cfg, events)).toBe(0);
    expect(events.events).toHaveLength(1);
    expect(events.events[0]).toMatchObject({
      type: 'Killed',
      kind: 'static',
      radius: cfg.staticRadius,
    });
    expect(t.alive).toBe(false);
    for (let i = 0; i < 100; i++)
      stepTargets(targets, ship, cfg, 6000, shots, createRng(1), false, DT);
    expect(t.alive).toBe(false);
    for (let i = 0; i < 40; i++)
      stepTargets(targets, ship, cfg, 6000, shots, createRng(1), false, DT);
    expect(t.alive).toBe(true);
    expect(t.hp).toBe(t.maxHp);
  });

  it('holds destroyed drones down while holdDrones is set', () => {
    const cfg = arena({ staticCount: 0, droneCount: 1, turretCount: 0, respawnDelay: 1 });
    const targets = createTargets(cfg, createRng(1));
    targets[0]!.hp = 0;
    resolveKills(targets, cfg, createEventQueue());
    const ship = createShip(flight);
    const shots = createEnemyShotPool(cfg);
    for (let i = 0; i < 300; i++)
      stepTargets(targets, ship, cfg, 6000, shots, createRng(1), true, DT);
    expect(targets[0]!.alive).toBe(false);
  });
});

describe('turrets and enemy shots', () => {
  const turretCfg = (over: Partial<ArenaConfig> = {}) =>
    arena({ staticCount: 0, droneCount: 0, turretCount: 1, ...over });

  it('fires slow shots at the player when in range, not when out of range', () => {
    const cfg = turretCfg();
    const [t] = createTargets(cfg, createRng(1));
    const ship = createShip(flight);
    const shots = createEnemyShotPool(cfg);
    ship.x = t!.x + cfg.turretRange * 2;
    for (let i = 0; i < 600; i++)
      stepTargets([t!], ship, cfg, 6000, shots, createRng(1), false, DT);
    expect(shots.count).toBe(0);
    ship.x = t!.x + 500;
    ship.y = t!.y;
    const events = createEventQueue();
    for (let i = 0; i < 600; i++)
      stepTargets([t!], ship, cfg, 6000, shots, createRng(1), false, DT, [], 0, events);
    expect(shots.count).toBeGreaterThan(0);
    const fired = events.events.filter((e) => e.type === 'EnemyShotFired');
    expect(fired.length).toBeGreaterThan(0);
    expect(fired[0]).toMatchObject({ from: 'turret' });
    expect(Math.hypot(shots.data.vx[0]!, shots.data.vy[0]!)).toBeCloseTo(cfg.enemyShotSpeed, 3);
    expect(shots.data.vx[0]!).toBeGreaterThan(0); // aimed at the ship, which is to the right
  });

  it('a shot that reaches the ship hits it once; an invulnerable ship is not hit', () => {
    const cfg = turretCfg();
    const ship = createShip(flight);
    const shots = createEnemyShotPool(cfg);
    const events = createEventQueue();
    const aim = (): void => {
      const i = shots.spawn();
      shots.data.x[i] = ship.x - 100;
      shots.data.y[i] = ship.y;
      shots.data.vx[i] = cfg.enemyShotSpeed;
      shots.data.life[i] = cfg.enemyShotLife;
    };
    ship.invulnerable = true;
    aim();
    let hits = 0;
    for (let i = 0; i < 60; i++) hits += stepEnemyShots(shots, ship, cfg, events, DT);
    expect(hits).toBe(0);
    shots.clear();
    ship.invulnerable = false;
    aim();
    for (let i = 0; i < 60; i++) hits += stepEnemyShots(shots, ship, cfg, events, DT);
    expect(hits).toBe(1);
    expect(events.events.filter((e) => e.type === 'Hit')).toHaveLength(1);
    expect(shots.count).toBe(0);
  });

  it('post-hit protection: a burst hits once, and a guarded ship is not hit', () => {
    const cfg = turretCfg();
    const ship = createShip(flight);
    const shots = createEnemyShotPool(cfg);
    const burst = (): void => {
      for (let k = 0; k < 5; k++) {
        const i = shots.spawn();
        shots.data.x[i] = ship.x - 100 - k * 5;
        shots.data.y[i] = ship.y;
        shots.data.vx[i] = cfg.enemyShotSpeed;
        shots.data.life[i] = cfg.enemyShotLife;
      }
    };
    burst();
    let hits = 0;
    for (let i = 0; i < 60; i++)
      hits += stepEnemyShots(shots, ship, cfg, createEventQueue(), DT, 5, hits > 0, true); // the world keeps the guard up between steps
    expect(hits).toBe(1); // the rest of the burst flew through
    shots.clear();
    burst();
    hits = 0;
    for (let i = 0; i < 60; i++)
      hits += stepEnemyShots(shots, ship, cfg, createEventQueue(), DT, 5, true, true);
    expect(hits).toBe(0);
    shots.clear();
    burst();
    for (let i = 0; i < 60; i++) hits += stepEnemyShots(shots, ship, cfg, createEventQueue(), DT);
    expect(hits).toBe(5); // without protection every bullet hits
  });

  it('expires shots after their life and never exceeds the pool cap', () => {
    const cfg = turretCfg({ enemyShotCap: 5, enemyShotLife: 1 });
    const shots = createEnemyShotPool(cfg);
    const ship = createShip(flight);
    for (let i = 0; i < 20; i++) {
      const s = shots.spawn();
      if (s >= 0) shots.data.life[s] = 1;
    }
    expect(shots.count).toBe(5);
    ship.x = 1e6;
    for (let i = 0; i < 61; i++) stepEnemyShots(shots, ship, cfg, createEventQueue(), DT);
    expect(shots.count).toBe(0);
  });
});

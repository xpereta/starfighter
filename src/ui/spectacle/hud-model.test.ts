import { describe, expect, it } from 'vitest';
import { presentation as def } from '../../../data/styles/anime-spectacle/presentation';
import { createTuning } from '../../../data/tuning';
import { createWorld } from '../../core/world/world';
import { createCombo } from './combo';
import { buildHudModel, multiplierText, pips, scoreText } from './hud-model';

describe('pure helpers', () => {
  it('pads the score to six digits and never goes negative', () => {
    expect(scoreText(0)).toBe('000000');
    expect(scoreText(3250.4)).toBe('003250');
    expect(scoreText(-5)).toBe('000000');
    expect(scoreText(1234567)).toBe('1234567');
  });

  it('pips fill from the left and are clamped', () => {
    expect(pips(2, 5)).toEqual(['on', 'on', 'off', 'off', 'off']);
    expect(pips(9, 3)).toEqual(['on', 'on', 'on']);
    expect(pips(-1, 2)).toEqual(['off', 'off']);
    expect(pips(0, 0)).toHaveLength(1);
  });

  it('shows the multiplier with a decimal only when it has one', () => {
    expect(multiplierText(1)).toBe('x1');
    expect(multiplierText(2.5)).toBe('x2.5');
  });
});

describe('buildHudModel', () => {
  const run = () => {
    const world = createWorld(5, createTuning());
    world.run.mode = 'run';
    world.run.phase = 'battle';
    world.run.battle = 2;
    world.run.wave = 2;
    world.run.waveTotal = 3;
    world.run.hull = 2;
    return world;
  };

  it('shows the hull as pips, low and critical states, and the objective', () => {
    const world = run();
    const m = buildHudModel(world, createCombo(), def);
    expect(m.hull.pips.filter((p) => p === 'on')).toHaveLength(2);
    expect(m.hull.pips).toHaveLength(world.tuning.run.playerHull);
    expect(m.hull.low).toBe(true);
    expect(m.hull.critical).toBe(false);
    expect(m.objective).toMatchObject({
      battle: `BATTLE 2/${world.tuning.run.battleCount}`,
      wave: 'WAVE 2/3',
    });
    world.run.hull = 1;
    expect(buildHudModel(world, createCombo(), def).hull.critical).toBe(true);
  });

  it('practice mode: a full hull bar, no objective, a time trial line', () => {
    const world = createWorld(5, createTuning());
    const m = buildHudModel(world, createCombo(), def);
    expect(m.inRun).toBe(false);
    expect(m.hull.pips.every((p) => p === 'on')).toBe(true);
    expect(m.hull.text).toBe('--');
    expect(m.objective).toBeNull();
    expect(m.trial).toContain('TIME TRIAL');
  });

  it('the roster has a card per pilot with hull pips, and fallen pilots keep a card with none', () => {
    const world = run();
    world.pilots.roster.push(
      {
        id: 1,
        name: 'Mara Vex',
        trait: 'bold',
        kills: 0,
        battles: 0,
        status: 'active',
        veteran: false,
      },
      {
        id: 2,
        name: 'Joss Hale',
        trait: 'steady',
        kills: 0,
        battles: 0,
        status: 'lost',
        veteran: false,
      },
    );
    const m = buildHudModel(world, createCombo(), def);
    expect(m.roster.map((r) => r.first)).toEqual(['Mara', 'Joss']);
    expect(m.roster[1]).toMatchObject({ fallen: true, hull: [] });
    expect(m.roster[0]!.callsign).toBe('Vex');
  });

  it('lock pips follow the locks held, the salvo state follows the cooldown', () => {
    const world = run();
    world.lockon.locks.push(1000);
    const m = buildHudModel(world, createCombo(), def);
    expect(m.locks.count).toBe(1);
    expect(m.locks.pips).toHaveLength(m.locks.limit);
    expect(m.locks.pips.filter((p) => p === 'on')).toHaveLength(1);
    expect(m.locks.salvoReady).toBe(true);
    world.missiles.salvo.cooldown = world.tuning.missiles.salvoCooldown;
    expect(buildHudModel(world, createCombo(), def).locks.salvoReady).toBe(false);
  });

  it('the combo block reports the streak, its multiplier, tier and call', () => {
    const world = run();
    const c = createCombo();
    c.count = 7;
    c.timer = def.combo.window / 2;
    c.score = 1250;
    c.call = 'GREAT';
    c.callTimer = 1;
    const m = buildHudModel(world, c, def);
    expect(m.score).toBe('001250');
    expect(m.combo).toMatchObject({
      active: true,
      count: 7,
      tier: 'GREAT',
      call: 'GREAT',
      multiplier: 'x1.5',
    });
    expect(m.combo.fill).toBeCloseTo(0.5);
  });

  it('warns when the ship is outside the arena', () => {
    const world = run();
    world.ship.outside = true;
    expect(buildHudModel(world, createCombo(), def).warning).toBe('RETURN TO ARENA');
  });
});

import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { spawnFighter } from '../ai/waves';
import { hashWorld } from '../replay/hash';
import { FIGHTER_ID_BASE } from '../world/lockable';
import { createWorld, stepWorld, type World } from '../world/world';
import { attackTarget, nearestToNose } from './orders';
import { slotPosition } from './formation';

const DT = 1 / 60;

/** An empty arena (no waves, drones or turrets) with two wingmen already flying beside the player. */
function arena(wingmen = 2): World {
  const tuning = createTuning();
  tuning.fighter.waveSize = 0;
  tuning.arena.staticCount = 0;
  tuning.arena.droneCount = 0;
  tuning.arena.turretCount = 0;
  tuning.squadron.wingmanCount = wingmen;
  const world = createWorld(1, tuning);
  stepWorld(world, DT); // creates the wingmen
  return world;
}

const steps = (world: World, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepWorld(world, DT);
};

/** Presses a button for one step and releases it for the next. */
function press(world: World, button: 'attackOrder' | 'cycleFormation'): void {
  world.actions[button] = true;
  stepWorld(world, DT);
  world.actions[button] = false;
  stepWorld(world, DT);
}

const orderEvents = (world: World) =>
  world.events.events
    .filter((e) => e.type === 'OrderGiven')
    .map((e) => (e as { order: string }).order);

/** An enemy fighter at a spot; returns its lockable id. */
const enemyAt = (world: World, x: number, y: number): number =>
  FIGHTER_ID_BASE + spawnFighter(world, x, y, 0);

describe('cycle formation', () => {
  it('toggles tight and spread, once per press, announcing the new formation', () => {
    const world = arena();
    expect(world.squadron.formation).toBe('tight');
    world.actions.cycleFormation = true;
    stepWorld(world, DT);
    expect(world.squadron.formation).toBe('spread');
    expect(orderEvents(world)).toEqual(['spread']);
    world.actions.cycleFormation = false;
    stepWorld(world, DT);
    press(world, 'cycleFormation');
    expect(world.squadron.formation).toBe('tight');
  });

  it('is edge-triggered: holding the button does not keep toggling', () => {
    const world = arena();
    world.actions.cycleFormation = true;
    for (let i = 0; i < 30; i++) stepWorld(world, DT);
    expect(world.squadron.formation).toBe('spread');
  });

  it('wingmen move to the slots of the new formation', () => {
    const world = arena(2);
    press(world, 'cycleFormation');
    expect(world.squadron.formation).toBe('spread');
    steps(world, 14);
    world.squadron.wingmen.forEach((w, i) => {
      const slot = slotPosition({ x: 0, y: 0 }, 'spread', i, 2, world.ship, world.tuning.squadron);
      expect(Math.hypot(w.ship.x - slot.x, w.ship.y - slot.y)).toBeLessThan(
        2 * world.tuning.squadron.slotHoldRadius,
      );
    });
  });
});

describe('what attack my target aims at', () => {
  it('ignores the missile locks: it is the enemy nearest the nose even when another is locked', () => {
    const world = arena();
    const locked = enemyAt(world, 1500, 900);
    const onNose = enemyAt(world, 800, 0);
    world.lockon.locks.push(locked, FIGHTER_ID_BASE + 5);
    expect(attackTarget(world)).toBe(onNose);
    world.lockon.locks.length = 0; // a salvo spending the locks changes nothing
    expect(attackTarget(world)).toBe(onNose);
  });

  it('the enemy nearest the nose within the search range', () => {
    const world = arena();
    const onNose = enemyAt(world, 800, 50);
    enemyAt(world, 0, 900); // 90 degrees off the nose
    enemyAt(world, world.tuning.squadron.attackSearchRange + 3000, 0); // right on the nose but too far
    expect(nearestToNose(world, world.tuning.squadron.attackSearchRange)).toBe(onNose);
    expect(attackTarget(world)).toBe(onNose);
  });

  it('ignores dead enemies and static targets', () => {
    const world = arena();
    const dead = enemyAt(world, 800, 0);
    world.fighters[dead - FIGHTER_ID_BASE]!.alive = false;
    world.targets.push({
      kind: 'static',
      mode: 'static',
      x: 500,
      y: 0,
      radius: 30,
      hp: 3,
      maxHp: 3,
      alive: true,
      homeX: 500,
      homeY: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      speed: 0,
      orbitX: 0,
      orbitY: 0,
      orbitRadius: 0,
      omega: 0,
      cooldown: 0,
      respawnTimer: 0,
    });
    expect(attackTarget(world)).toBe(-1);
  });

  it('a stale or dead lock does not matter either', () => {
    const world = arena();
    const onNose = enemyAt(world, 800, 50);
    world.lockon.locks.push(FIGHTER_ID_BASE + 7); // stale id
    expect(attackTarget(world)).toBe(onNose);
  });
});

describe('attack my target', () => {
  it('starts the order on the target with the full order time, and announces it', () => {
    const world = arena();
    const id = enemyAt(world, 1500, 0);
    world.actions.attackOrder = true;
    stepWorld(world, DT);
    const sq = world.squadron;
    expect(sq.order).toBe('attack');
    expect(sq.orderTargetId).toBe(id);
    expect(sq.orderTimer).toBeCloseTo(world.tuning.squadron.attackOrderTime - DT, 3);
    expect(orderEvents(world)).toEqual(['attack']);
  });

  it('does nothing with no enemy to aim at, or with no living wingman', () => {
    const empty = arena();
    press(empty, 'attackOrder');
    expect(empty.squadron.order).toBe('none');

    const alone = arena(0);
    enemyAt(alone, 800, 0);
    press(alone, 'attackOrder');
    expect(alone.squadron.order).toBe('none');
  });

  it('sends every wingman at the target, whatever the formation range', () => {
    const world = arena();
    const far = enemyAt(world, world.tuning.squadron.tightEngageRange + 1500, 0);
    // Without the order, the tight formation ignores an enemy this far from the player.
    steps(world, 0.2);
    expect(world.squadron.wingmen.every((w) => w.engagedId === -1)).toBe(true);
    press(world, 'attackOrder');
    expect(world.squadron.order).toBe('attack');
    expect(world.squadron.wingmen.every((w) => w.engagedId === far)).toBe(true);
  });

  it('ends after the order time and the wingmen return to the formation', () => {
    const world = arena();
    world.tuning.squadron.attackOrderTime = 1;
    const far = enemyAt(world, world.tuning.squadron.tightEngageRange + 1500, 0);
    world.fighters[far - FIGHTER_ID_BASE]!.hp = 1000; // survives the wingmen
    press(world, 'attackOrder');
    expect(world.squadron.order).toBe('attack');
    steps(world, 1.2);
    expect(world.squadron.order).toBe('none');
    expect(world.squadron.orderTargetId).toBe(-1);
    expect(world.squadron.wingmen.every((w) => w.engagedId === -1)).toBe(true);
  });

  it('ends early when the target dies', () => {
    const world = arena();
    const id = enemyAt(world, 1500, 0);
    press(world, 'attackOrder');
    expect(world.squadron.order).toBe('attack');
    world.fighters[id - FIGHTER_ID_BASE]!.hp = 0;
    stepWorld(world, DT); // the kill is resolved at the end of this step
    stepWorld(world, DT); // the order notices on the next
    expect(world.squadron.order).toBe('none');
    expect(world.squadron.orderTimer).toBe(0);
    expect(world.squadron.orderTimer).toBeLessThan(world.tuning.squadron.attackOrderTime);
  });

  it('a second press cancels it, announcing the formation they return to; a third starts again', () => {
    const world = arena();
    const id = enemyAt(world, 1500, 0);
    world.fighters[id - FIGHTER_ID_BASE]!.hp = 1000;
    press(world, 'attackOrder');
    expect(world.squadron.order).toBe('attack');
    world.actions.attackOrder = true;
    stepWorld(world, DT);
    expect(world.squadron.order).toBe('none');
    expect(orderEvents(world)).toEqual(['tight']);
    world.actions.attackOrder = false;
    stepWorld(world, DT);
    press(world, 'attackOrder');
    expect(world.squadron.order).toBe('attack');
  });

  it('is edge-triggered: holding the button gives one order, not an on/off flicker', () => {
    const world = arena();
    const id = enemyAt(world, 1500, 0);
    world.fighters[id - FIGHTER_ID_BASE]!.hp = 1000;
    world.actions.attackOrder = true;
    let given = 0;
    for (let i = 0; i < 30; i++) {
      stepWorld(world, DT);
      given += orderEvents(world).length;
    }
    expect(given).toBe(1);
    expect(world.squadron.order).toBe('attack');
  });

  it('a respawn cancels the order', () => {
    const world = arena();
    enemyAt(world, 1500, 0);
    press(world, 'attackOrder');
    expect(world.squadron.order).toBe('attack');
    world.actions.respawn = true;
    stepWorld(world, DT);
    world.actions.respawn = false;
    expect(world.squadron.order).toBe('none');
    expect(world.squadron.orderTargetId).toBe(-1);
  });
});

describe('the replay hash covers the squadron state', () => {
  it('formation, order, timer and target all change the hash', () => {
    const world = arena();
    let previous = hashWorld(world);
    const changes: Array<[string, () => void]> = [
      ['formation', () => (world.squadron.formation = 'spread')],
      ['order', () => (world.squadron.order = 'attack')],
      ['orderTimer', () => (world.squadron.orderTimer = 4.5)],
      ['orderTargetId', () => (world.squadron.orderTargetId = 1002)],
    ];
    for (const [name, change] of changes) {
      change();
      const now = hashWorld(world);
      expect(now, `${name} must be part of the replay hash`).not.toBe(previous);
      previous = now;
    }
  });

  it('a recorded run with orders replays exactly', async () => {
    const { startRecording, runReplay } = await import('../replay/replay');
    const tuning = createTuning();
    const world = createWorld(5, tuning);
    const recorder = startRecording(world);
    for (let i = 0; i < 60 * 30; i++) {
      world.actions.cycleFormation = i % 400 === 10;
      world.actions.attackOrder = i % 500 === 200 || i % 500 === 350;
      recorder.record(world.tick, world.actions);
      stepWorld(world, DT);
    }
    const replay = recorder.finish(world);
    expect(hashWorld(runReplay(replay))).toBe(hashWorld(world));
  });
});

describe('feedback when Attack my target cannot act', () => {
  it('shows "no target" when there is nothing to aim at, and clears it after orderCueTime', () => {
    const world = arena();
    press(world, 'attackOrder');
    expect(world.squadron.order).toBe('none');
    expect(world.squadron.cue).toBe('no-target');
    expect(world.squadron.cueTimer).toBeGreaterThan(0);
    steps(world, world.tuning.squadron.orderCueTime + 0.1);
    expect(world.squadron.cue).toBe('none');
    expect(world.squadron.cueTimer).toBe(0);
  });

  it('shows "no wingmen" when there is no living wingman, even if enemies exist', () => {
    const world = arena(0);
    enemyAt(world, 600, 0);
    press(world, 'attackOrder');
    expect(world.squadron.order).toBe('none');
    expect(world.squadron.cue).toBe('no-wingmen');
  });

  it('shows no cue when the order works, and no cue when a second press cancels it', () => {
    const world = arena();
    enemyAt(world, 600, 0);
    press(world, 'attackOrder');
    expect(world.squadron.order).toBe('attack');
    expect(world.squadron.cue).toBe('none');
    press(world, 'attackOrder'); // cancels
    expect(world.squadron.order).toBe('none');
    expect(world.squadron.cue).toBe('none');
  });

  it('restarting the cue on every failed press, and the cue is part of the replay hash', () => {
    const a = arena();
    const b = arena();
    expect(hashWorld(a)).toBe(hashWorld(b));
    press(a, 'attackOrder');
    press(b, 'cycleFormation');
    press(b, 'cycleFormation'); // back to tight, no cue
    expect(a.squadron.cue).toBe('no-target');
    expect(hashWorld(a)).not.toBe(hashWorld(b));
  });
});

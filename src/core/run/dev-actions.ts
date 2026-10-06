import { spawnWave } from '../ai/waves';
import { CAPITAL_PARTS, coreIndex, coveredBy, killPart } from '../enemies/capital';
import { createLockOn } from '../lockon/lockon';
import { activeCount, addPilot, generatePilots } from '../pilots/pilots';
import { maxHpOf } from '../pilots/effective';
import type { World } from '../world/world';
import { escortHooks } from '../enemies/escorts';
import { bossOf, clearBattle, endRun, enterStartScreen, startBattle, waveSizeIn } from './run';

/**
 * Dev-only world edits for the debug panel (jump between run phases, force waves, clear enemies).
 * Everything is built on the real transitions in `run.ts` (`startBattle`, `clearBattle`, `endRun`,
 * `enterStartScreen`, `addPilot`, `spawnWave`), so a jump lands in the state the real flow would
 * produce and stays correct as the run code evolves. Nothing here is called by the game itself.
 *
 * These are NOT part of the simulation inputs: a replay records seed, tuning and button presses only,
 * so a run edited by a jump cannot be reproduced. The dev panel therefore refuses them while a
 * replay is recording or playing (see `src/dev/replay-controls.ts`).
 *
 * Failures (a jump that makes no sense) throw an `Error` with a readable message; the panel shows it.
 */
export type JumpTarget =
  | { kind: 'start' }
  | { kind: 'battle'; n: number }
  | { kind: 'debrief' }
  | { kind: 'end'; result: 'victory' | 'defeat' };

/** Every jump the panel offers for a run of `battleCount` battles, in the order a run visits them. */
export function jumpTargets(battleCount: number): JumpTarget[] {
  const list: JumpTarget[] = [{ kind: 'start' }];
  for (let n = 1; n <= battleCount; n++) list.push({ kind: 'battle', n });
  if (battleCount >= 2) list.push({ kind: 'debrief' });
  list.push({ kind: 'end', result: 'victory' }, { kind: 'end', result: 'defeat' });
  return list;
}

export function jumpLabel(target: JumpTarget): string {
  switch (target.kind) {
    case 'start':
      return 'Start screen';
    case 'battle':
      return `Battle ${target.n}`;
    case 'debrief':
      return 'Debrief';
    case 'end':
      return target.result === 'victory' ? 'End: victory' : 'End: defeat';
  }
}

/** True while a run is on and in a battle (not a menu, not practice). */
export function inRunBattle(world: World): boolean {
  const { run } = world;
  return run.mode === 'run' && run.phase === 'battle' && run.battle > 0;
}

/** A squad of the size a run starts with (generated pilots, joined with the real `addPilot`) when nobody is flying. */
function ensureRoster(world: World): void {
  if (activeCount(world.pilots) > 0) return;
  const missing = world.tuning.run.startingSquad;
  if (missing <= 0) return;
  for (const template of generatePilots(world, missing)) addPilot(world, template, 'pick');
}

/** Starts battle `n` through the real code path, from wherever the world is (practice, a menu, another battle). */
function enterBattle(world: World, n: number): void {
  const count = world.tuning.run.battleCount;
  if (!Number.isInteger(n) || n < 1 || n > count) {
    throw new Error(`battle ${n} does not exist (a run has ${count})`);
  }
  const { run } = world;
  // From practice or a finished run, start over the way the real flow does (fresh pilots, result cleared).
  if (run.mode !== 'run' || run.phase === 'end') enterStartScreen(world);
  ensureRoster(world);
  world.trial.active = false;
  startBattle(world, n);
  // A battle after the first begins with the hull the debrief would have restored.
  run.hull = world.tuning.run.playerHull;
}

/** The battle a "debrief" or "defeat" jump is about: the current one, or battle 1 outside a battle. */
function currentBattleOr1(world: World): number {
  const { run } = world;
  return run.mode === 'run' && run.battle >= 1 ? run.battle : 1;
}

/** Jumps the run to a phase, using the real transitions. Clears the field, pods and shots. */
export function devJumpTo(world: World, target: JumpTarget): void {
  const count = world.tuning.run.battleCount;
  switch (target.kind) {
    case 'start':
      enterStartScreen(world);
      return;
    case 'battle':
      enterBattle(world, target.n);
      return;
    case 'debrief': {
      if (count < 2) throw new Error('a one-battle run has no debrief (its end is the victory)');
      enterBattle(world, Math.min(currentBattleOr1(world), count - 1));
      clearBattle(world); // the real "last wave cleared" step: hull restored, candidates generated
      return;
    }
    case 'end': {
      if (target.result === 'victory') {
        enterBattle(world, count);
        clearBattle(world); // the last battle cleared: victory
      } else {
        enterBattle(world, currentBattleOr1(world));
        world.run.hull = 0;
        endRun(world, 'defeat');
      }
      return;
    }
  }
}

/** The jump "next battle" means: battle 1 from practice or the end screen, otherwise the one after the current. Null after the last battle. */
export function nextBattleTarget(world: World): JumpTarget | null {
  const { run } = world;
  const next = run.mode === 'run' && run.phase !== 'end' ? run.battle + 1 : 1;
  return next <= world.tuning.run.battleCount ? { kind: 'battle', n: next } : null;
}

/** Number of enemies and targets alive (what a dev wants to read after a spawn or a clear). */
export function enemyCounts(world: World): { fighters: number; targets: number } {
  let fighters = 0;
  for (const f of world.fighters) if (f.alive) fighters++;
  let targets = 0;
  for (const t of world.targets) if (t.alive) targets++;
  return { fighters, targets };
}

/** One line about the capital ship for the dev panel ("capital: 17/17 parts, core shielded by 4 plates"), or '' without one. */
export function capitalSummary(world: World): string {
  const cap = world.enemies.capital;
  if (!cap) return '';
  const alive = cap.parts.filter((p) => p.alive).length;
  const core = coreIndex();
  const shield = cap.coreExposed
    ? 'core exposed'
    : `core shielded by ${coveredBy(CAPITAL_PARTS)[core]!.filter((j) => cap.parts[j]!.alive).length} plates`;
  return `capital: ${alive}/${cap.parts.length} parts, ${cap.phase === 0 ? shield : cap.phase === 1 ? 'breaking up' : 'destroyed'}`;
}

/**
 * Starts the next wave now, without waiting for the current one to be cleared. In a battle this
 * counts as the next wave of the battle (so it is capped at `waveTotal`); in practice it is one more wave.
 */
export function devNextWave(world: World): void {
  const { run } = world;
  if (run.mode !== 'run') {
    spawnWave(world);
    return;
  }
  if (!inRunBattle(world)) throw new Error('no battle is running');
  const cap = world.enemies.capital;
  if (bossOf(run.battle) && cap) {
    // The boss battle has no waves: "next wave" sends the next escort wing at once.
    escortHooks.sendWing(world, cap, world.tuning.capital.escortWingSize, cap.wingsSent++);
    return;
  }
  if (run.wave >= run.waveTotal) throw new Error('the last wave of this battle is already out');
  run.wave++;
  run.waveStartTick = world.tick;
  spawnWave(world, waveSizeIn(world.tuning.run, run.battle));
  world.events.emit({ type: 'WaveStarted', battle: run.battle, wave: run.wave });
}

/** Kills every living fighter and target (the next step resolves them as normal kills, with events). */
function killAll(world: World): void {
  for (const f of world.fighters) if (f.alive) f.hp = 0;
  for (const t of world.targets) if (t.alive) t.hp = 0;
  // The capital ship: its core dies at once and the death chain runs (the battle is won when it ends).
  const cap = world.enemies.capital;
  if (cap && cap.phase === 0) killPart(world, coreIndex());
  world.enemyShots.clear();
}

/**
 * Kills every enemy so the battle ends: no more waves are held back, the next step sees the battle
 * cleared (debrief, or victory after the last battle). In practice it just kills everything.
 * Note: with "Freeze enemies" on, the battle does not advance (frozen waves) until it is switched off.
 */
export function devClearBattle(world: World): void {
  const { run } = world;
  if (run.mode === 'run') {
    if (!inRunBattle(world)) throw new Error('no battle is running');
    run.wave = run.waveTotal;
  }
  killAll(world);
}

/**
 * Removes every enemy from the field: fighters are killed (so the next wave keeps its normal delay),
 * targets (drones, turrets, static dummies) are deleted, and shots, missiles and locks are dropped. In
 * practice the arena stays empty until the next respawn (R). In a battle the remaining waves still come.
 */
export function devClearEnemies(world: World): void {
  for (const f of world.fighters) if (f.alive) f.hp = 0;
  world.targets.length = 0;
  // Practice: the capital ship goes too. In a battle it stays (it is the objective: use Clear battle).
  if (world.run.mode !== 'run') world.enemies.capital = null;
  world.enemyShots.clear();
  world.missiles.clear();
  Object.assign(world.lockon, createLockOn());
  world.trial.active = false;
  const sq = world.squadron;
  sq.order = 'none';
  sq.orderTargetId = -1;
  for (const w of sq.wingmen) w.engagedId = -1;
}

/**
 * Refills the player's hull and the living wingmen; in a run, generated pilots take the free slots up
 * to the starting squad size (a lost pilot stays lost: the real flow never brings one back).
 */
export function devRestore(world: World): void {
  const { run } = world;
  if (run.mode === 'run' && run.phase === 'battle') {
    run.hull = world.tuning.run.playerHull;
    const missing = world.tuning.run.startingSquad - activeCount(world.pilots);
    if (missing > 0) {
      for (const template of generatePilots(world, missing)) addPilot(world, template, 'pick');
    }
  }
  for (const w of world.squadron.wingmen) if (w.alive) w.hp = maxHpOf(world, w.pilotId);
}

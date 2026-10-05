import type { RunConfig } from '../../../data/tuning/run';
import { TRAIT_IDS } from '../../../data/content/traits';
import { NO_HIT } from '../ai/fighter';
import { convertWaveToLancers } from '../ai/lancer';
import { resolveFighterKills, spawnWave } from '../ai/waves';
import { clearEnemyState } from '../enemies/state';
import { createCamera } from '../camera/camera';
import { createShip } from '../flight/flight';
import { createLockOn } from '../lockon/lockon';
import {
  activeCount,
  addPilot,
  createPilots,
  generateCandidates,
  generatePilots,
  markBattleFlown,
  type PilotTemplate,
} from '../pilots/pilots';
import { createSquadron } from '../squadron/squadron';
import { createGunState } from '../weapons/guns';
import { createTargets } from '../world/arena';
import type { World } from '../world/world';

/**
 * The run as a state machine (spec section 1): `start` (menu) -> `battle` 1..N -> `debrief` after each
 * battle but the last -> `end` (victory after the last battle, or defeat when the player's hull is gone).
 * Practice mode (the Prototype 1/2 arena, the default and what the simulation tests use) is
 * `mode: 'practice'` in the `battle` phase with no battle number, and nothing here touches it.
 * Menus are driven only by the edge-triggered `menu*` actions, so a replay records every choice.
 */
export type RunMode = 'practice' | 'run';
export type RunPhase = 'start' | 'battle' | 'debrief' | 'end';
export type RunResult = 'none' | 'victory' | 'defeat';

/** A saved veteran offered on the Start screen. The `id` is the veteran's id in the save data. */
export interface OfferedVeteran extends PilotTemplate {
  id: number;
}

export interface Run {
  mode: RunMode;
  phase: RunPhase;
  /** 1-based battle number while a run is on, 0 in practice mode and on the start screen. */
  battle: number;
  /** 1-based wave inside the current battle, 0 when none. */
  wave: number;
  result: RunResult;
  /** Index of the highlighted item on the current menu screen. */
  cursor: number;
  /** The player's hull: starts at `playerHull`, restored at each debrief; 0 ends the run in defeat. */
  hull: number;
  /** Waves in the current battle (the objective: clear the last one). 0 outside a battle. */
  waveTotal: number;
  /** The `world.tick` at which the current wave started (things that happen "when a wave starts", like rescue pods, use it). */
  waveStartTick: number;
  /** `stats.hitsTaken` already charged to the hull. */
  hitsSeen: number;
  /** Enemies destroyed and pilots lost in the current battle (what the debrief reports). */
  battleKills: number;
  battleLost: number;
  /** The generated pilots offered at a debrief (empty outside one, and once one was picked or the squad is full). */
  candidates: PilotTemplate[];
  /** Saved veterans on offer on the Start screen; set by the app with `offerVeterans`. */
  available: OfferedVeteran[];
  /** Ids of the veterans ticked on the Start screen, at most `veteransPerRun`. */
  selectedVeterans: number[];
}

export function createRun(): Run {
  return {
    mode: 'practice',
    phase: 'battle',
    battle: 0,
    wave: 0,
    result: 'none',
    cursor: 0,
    hull: 0,
    waveTotal: 0,
    waveStartTick: 0,
    hitsSeen: 0,
    battleKills: 0,
    battleLost: 0,
    candidates: [],
    available: [],
    selectedVeterans: [],
  };
}

/** Waves in battle `n` (1-based). */
export function wavesIn(cfg: RunConfig, n: number): number {
  return Math.max(1, Math.round(cfg.wavesBase + cfg.wavesPerBattle * (n - 1)));
}

/** Fighters in each wave of battle `n`. */
export function waveSizeIn(cfg: RunConfig, n: number): number {
  return Math.max(1, Math.round(cfg.waveSizeBase + cfg.waveGrowth * (n - 1)));
}

/** Turrets in battle `n`: none before `turretsFromBattle`. */
export function turretsIn(cfg: RunConfig, n: number): number {
  if (n < cfg.turretsFromBattle) return 0;
  return Math.max(0, Math.round(cfg.turretsBase + cfg.turretsGrowth * (n - cfg.turretsFromBattle)));
}

/** Rows on the current menu screen: the highlighted `cursor` ranges over 0..rows-1. */
export function menuRows(run: Run): number {
  if (run.phase === 'start') return run.available.length + 1; // veterans, then Start
  if (run.phase === 'debrief') return run.candidates.length + 1; // candidates, then Continue
  return 1; // the end screen: restart
}

/**
 * Puts a world into run mode on the Start screen: a fresh run (pilots, field) that waits for the player
 * to pick veterans and press Start. The pilot draw counter is kept, so a new run meets new pilots.
 */
export function enterStartScreen(world: World): void {
  const run = world.run;
  run.mode = 'run';
  run.phase = 'start';
  run.battle = 0;
  run.wave = 0;
  run.result = 'none';
  run.cursor = 0;
  run.hull = 0;
  run.waveTotal = 0;
  run.battleKills = 0;
  run.battleLost = 0;
  run.candidates = [];
  run.selectedVeterans = [];
  const { draws } = world.pilots;
  Object.assign(world.pilots, createPilots());
  world.pilots.draws = draws;
  clearField(world);
  world.targets.length = 0;
}

/** Offers saved veterans on the Start screen (the app passes them in; they are not world state of their own). */
export function offerVeterans(world: World, veterans: readonly OfferedVeteran[]): void {
  const run = world.run;
  run.available = veterans.map((v) => ({ ...v }));
  run.selectedVeterans = run.selectedVeterans.filter((id) =>
    run.available.some((v) => v.id === id),
  );
  run.cursor = Math.min(run.cursor, menuRows(run) - 1);
}

/** Back to an empty field around the ship at the centre; the squadron is rebuilt from the active pilots. */
function clearField(world: World): void {
  const { tuning } = world;
  Object.assign(world.ship, createShip(tuning.flight));
  Object.assign(world.guns, createGunState());
  world.bullets.clear();
  world.enemyShots.clear();
  world.missiles.clear();
  Object.assign(world.lockon, createLockOn());
  const formation = world.squadron.formation;
  Object.assign(world.squadron, createSquadron());
  world.squadron.formation = formation;
  world.fighters.length = 0;
  world.pods.length = 0;
  clearEnemyState(world.enemies);
  const aspect = world.camera.aspect;
  Object.assign(world.camera, createCamera(world.ship, tuning.flight, tuning.camera));
  world.camera.aspect = aspect;
}

/** Starts battle `n`: a clean field (which also restores the squad's hp and the pilots' positions) and its turrets. */
export function startBattle(world: World, n: number): void {
  const run = world.run;
  const cfg = world.tuning.run;
  clearField(world);
  const turrets = { ...world.tuning.arena, staticCount: 0, droneCount: 0, turretCount: 0 };
  turrets.turretCount = turretsIn(cfg, n);
  world.targets.splice(0, world.targets.length, ...createTargets(turrets, world.rng));
  run.phase = 'battle';
  run.cursor = 0;
  run.battle = n;
  run.wave = 0;
  run.waveTotal = wavesIn(cfg, n);
  run.battleKills = 0;
  run.battleLost = 0;
  run.hitsSeen = world.stats.hitsTaken;
  if (n === 1) run.hull = cfg.playerHull;
  run.candidates = [];
  world.events.emit({ type: 'BattleStarted', battle: n });
}

/** The Start button: chosen veterans join first, generated pilots fill the squad up to `startingSquad`, then battle 1. */
function startRun(world: World): void {
  const run = world.run;
  for (const id of run.selectedVeterans) {
    const vet = run.available.find((v) => v.id === id);
    if (vet) {
      const { name, trait, kills } = vet;
      addPilot(world, { name, trait, kills, veteran: true, veteranId: vet.id }, 'veteran');
    }
  }
  const missing = world.tuning.run.startingSquad - activeCount(world.pilots);
  if (missing > 0) {
    for (const template of generatePilots(world, missing)) addPilot(world, template, 'pick');
  }
  run.selectedVeterans = [];
  startBattle(world, 1);
}

export function endRun(world: World, result: 'victory' | 'defeat'): void {
  const run = world.run;
  run.phase = 'end';
  run.result = result;
  run.cursor = 0;
  run.candidates = [];
  run.wave = 0;
  world.events.emit({ type: 'RunEnded', result });
}

/** A battle's last wave is down: debrief (hull restored, a pick if there is a free slot) or, after the last battle, victory. */
export function clearBattle(world: World): void {
  const run = world.run;
  world.events.emit({ type: 'BattleCleared', battle: run.battle });
  markBattleFlown(world);
  if (run.battle >= world.tuning.run.battleCount) {
    endRun(world, 'victory');
    return;
  }
  run.phase = 'debrief';
  run.cursor = 0;
  run.wave = 0;
  run.hull = world.tuning.run.playerHull;
  const free = activeCount(world.pilots) < world.tuning.pilots.squadMax;
  run.candidates = free ? generateCandidates(world) : [];
}

/** Moves the cursor over `rows` items, wrapping. */
function move(run: Run, delta: number): void {
  const rows = menuRows(run);
  run.cursor = (((run.cursor + delta) % rows) + rows) % rows;
}

/** Runs first each step (after the button edges): menu navigation and the screens' actions. Run mode only. */
export function stepRun(world: World): void {
  const run = world.run;
  if (run.mode !== 'run' || run.phase === 'battle') return;
  const { actions, prev } = world;
  const { events } = world;
  if (actions.menuUp && !prev.menuUp) {
    move(run, -1);
    events.emit({ type: 'MenuMove', dir: -1 });
  }
  if (actions.menuDown && !prev.menuDown) {
    move(run, 1);
    events.emit({ type: 'MenuMove', dir: 1 });
  }
  const select = actions.menuSelect && !prev.menuSelect;
  const back = actions.menuBack && !prev.menuBack;

  if (run.phase === 'start') {
    if (!select) return;
    const vet = run.available[run.cursor];
    if (!vet) {
      events.emit({ type: 'MenuSelect' });
      startRun(world);
      return;
    }
    const at = run.selectedVeterans.indexOf(vet.id);
    if (at >= 0) {
      run.selectedVeterans.splice(at, 1);
      events.emit({ type: 'MenuTick', checked: false });
    } else if (run.selectedVeterans.length < world.tuning.pilots.veteransPerRun) {
      run.selectedVeterans.push(vet.id);
      events.emit({ type: 'MenuTick', checked: true });
    }
  } else if (run.phase === 'debrief') {
    if (back) {
      run.cursor = run.candidates.length; // B: skip the pick, rest on Continue
      events.emit({ type: 'MenuBack' });
    }
    if (!select) return;
    const candidate = run.candidates[run.cursor];
    if (!candidate) {
      events.emit({ type: 'MenuSelect' });
      startBattle(world, run.battle + 1);
      return;
    }
    if (addPilot(world, candidate, 'pick')) {
      events.emit({ type: 'MenuPick' });
      run.candidates = []; // one pick per debrief
      run.cursor = 0;
    }
  } else if (select) {
    events.emit({ type: 'MenuSelect' });
    enterStartScreen(world); // the end screen: restart
  }
}

/**
 * The battle itself, in place of the practice waves: kills and losses for the debrief, the player's
 * hull, the next wave (`wavesIn` of them, `waveSizeIn` fighters each), and the objective. Runs late in
 * the step, after enemy shots, so this step's damage is already applied.
 */
export function stepRunBattle(world: World): void {
  const run = world.run;
  resolveFighterKills(world);
  for (const e of world.events.events) {
    if (e.type === 'Killed' && e.kind !== 'wingman') run.battleKills++;
    else if (e.type === 'PilotLost') run.battleLost++;
  }
  const hits = world.stats.hitsTaken - run.hitsSeen;
  if (hits > 0) {
    run.hitsSeen = world.stats.hitsTaken;
    run.hull = Math.max(0, run.hull - hits);
    if (run.hull <= 0) {
      endRun(world, 'defeat');
      return;
    }
  }
  if (world.tuning.arena.enemiesFrozen) return; // debug freeze: no new waves
  let lastDeath = NO_HIT;
  for (const f of world.fighters) {
    if (f.alive) return;
    if (f.diedAt > lastDeath) lastDeath = f.diedAt;
  }
  if (run.wave >= run.waveTotal) {
    clearBattle(world);
    return;
  }
  if (world.fighters.length > 0 && world.time - lastDeath < world.tuning.fighter.waveDelay) return;
  run.wave++;
  run.waveStartTick = world.tick;
  spawnWave(world, waveSizeIn(world.tuning.run, run.battle));
  if (world.tuning.lancer.inBattles) convertWaveToLancers(world); // prototype 5 (B): local hook until the battle table spawns kinds
  world.events.emit({ type: 'WaveStarted', battle: run.battle, wave: run.wave });
}

const PHASES: readonly RunPhase[] = ['start', 'battle', 'debrief', 'end'];
const RESULTS: readonly RunResult[] = ['none', 'victory', 'defeat'];

function mixTemplate(mix: (n: number) => void, t: PilotTemplate): void {
  mix(t.name.length);
  for (let i = 0; i < t.name.length; i++) mix(t.name.charCodeAt(i));
  mix(TRAIT_IDS.indexOf(t.trait));
  mix(t.kills ?? 0);
  mix(t.veteran ? 1 : 0);
}

/** Feeds the run state into the replay hash. Add every field you add to `Run`. */
export function mixRun(mix: (n: number) => void, run: Run): void {
  mix(run.mode === 'run' ? 1 : 0);
  mix(PHASES.indexOf(run.phase));
  mix(run.battle);
  mix(run.wave);
  mix(RESULTS.indexOf(run.result));
  mix(run.cursor);
  mix(run.hull);
  mix(run.waveTotal);
  mix(run.waveStartTick);
  mix(run.hitsSeen);
  mix(run.battleKills);
  mix(run.battleLost);
  mix(run.candidates.length);
  for (const c of run.candidates) mixTemplate(mix, c);
  mix(run.available.length);
  for (const v of run.available) {
    mix(v.id);
    mixTemplate(mix, v);
  }
  mix(run.selectedVeterans.length);
  for (const id of run.selectedVeterans) mix(id);
}

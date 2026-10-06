import { describe, expect, it } from 'vitest';
import { CAPITAL_PARTS } from '../../data/content/capital';
import { createTuning } from '../../data/tuning';
import { coreIndex, coveredBy, isCovered, partCenter } from '../../src/core/enemies/capital';
import { createRng, type Rng } from '../../src/core/rng/rng';
import { wrapAngle } from '../../src/core/math';
import { spawnGunship } from '../../src/core/ai/gunship';
import { devJumpTo } from '../../src/core/run/dev-actions';
import { enterStartScreen, offerVeterans } from '../../src/core/run/run';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';

const DT = 1 / 60;
const MAX_STEPS = 25 * 60 * 60;

/**
 * Ramp tuning: whole runs under the authored ramp with scripted bots of different skill, logged per
 * battle (set `RAMP_LOG=1` to print the table). A bot of skill s in 0..1 aims at the nearest enemy
 * (or the nearest capital part that can be hit) with an aim error and reaction time that shrink with
 * skill, rolls away from an incoming missile with a probability that grows with skill, and (from
 * skill 0.5) launches salvos and gives the attack order. Skill -1 is the no-skill bot: random
 * steering, holds fire, never rolls. These are rough stand-ins for a human, used to compare battles
 * and to catch a ramp that is impossible or trivial, not to prove balance.
 */

interface Bot {
  skill: number;
  /** Steps between decisions (reaction time). */
  reaction: number;
  /** Aim error, radians (uniform +-). */
  error: number;
}

const botOf = (skill: number): Bot => ({
  skill,
  reaction: Math.round(30 - 22 * Math.max(0, skill)),
  error: 0.5 * (1 - Math.max(0, skill)),
});

interface BattleLog {
  waveHits: number[];
  battle: number;
  steps: number;
  hullLost: number;
  hits: number;
  missileHits: number;
  won: boolean;
}

interface RunLog {
  result: string;
  battles: BattleLog[];
  steps: number;
}

interface Enemy {
  x: number;
  y: number;
  dist: number;
  vx: number;
  vy: number;
  /** A part of the capital ship (a slow, huge target the bot can park beside). */
  part?: boolean;
}

function nearestEnemy(world: World): Enemy | null {
  const s = world.ship;
  let best: Enemy | null = null;
  const consider = (x: number, y: number, vx = 0, vy = 0, part = false): void => {
    const d = Math.hypot(x - s.x, y - s.y);
    if (!best || d < best.dist) best = { x, y, dist: d, vx, vy, part };
  };
  for (const f of world.fighters) if (f.alive) consider(f.x, f.y, f.vx, f.vy);
  const cap = world.enemies.capital;
  if (cap && cap.phase === 0) {
    const c = { x: 0, y: 0 };
    // Like a player who has read the briefing: the core when it is bare, else the plates that cover it.
    const core = coreIndex();
    const want = isCovered(cap, core) ? coveredBy(CAPITAL_PARTS)[core]! : [core];
    for (const i of want) {
      if (!cap.parts[i]!.alive) continue;
      partCenter(c, cap, CAPITAL_PARTS[i]!);
      consider(c.x, c.y, cap.vx, cap.vy, true);
    }
  }
  return best;
}

/** Seconds until the nearest enemy missile reaches the ship (Infinity when none is close). */
function missileEta(world: World): number {
  const pool = world.enemies.missiles;
  const d = pool.data;
  let eta = Infinity;
  for (let i = 0; i < pool.count; i++) {
    const dx = world.ship.x - d.x[i]!;
    const dy = world.ship.y - d.y[i]!;
    const dist = Math.hypot(dx, dy) || 1;
    // Closing speed along the line between them (the missile's velocity less the ship's).
    const closing = ((d.vx[i]! - world.ship.vx) * dx + (d.vy[i]! - world.ship.vy) * dy) / dist;
    if (closing <= 50) continue; // not coming for us
    eta = Math.min(eta, Math.max(0, dist - 40) / closing);
  }
  return eta;
}

/** True when an enemy bullet is within a roll's reach of the ship. */
function shotClose(world: World): boolean {
  const d = world.enemyShots.data;
  for (let i = 0; i < world.enemyShots.count; i++) {
    if (Math.hypot(d.x[i]! - world.ship.x, d.y[i]! - world.ship.y) < 140) return true;
  }
  return false;
}

export function playRun(seed: number, skill: number, only = 0, hull = 0): RunLog {
  const tuning = createTuning();
  if (hull > 0) tuning.run.playerHull = hull;
  if (process.env.RAMP_CLASSIC) tuning.run.ramp = 'classic';
  // RAMP_TUNE="capital.fireScale=0.5,gunship.hull=10": quick sweeps without editing the defaults.
  for (const pair of (process.env.RAMP_TUNE ?? '').split(',').filter(Boolean)) {
    const [path, value] = pair.split('=') as [string, string];
    const [group, name] = path.split('.') as [string, string];
    (
      (tuning as unknown as Record<string, Record<string, number>>)[group] as Record<string, number>
    )[name] = Number(value);
  }
  const world = createWorld(seed, tuning);
  const bot = botOf(skill);
  const rng: Rng = createRng(seed * 7 + 1);
  enterStartScreen(world);
  offerVeterans(world, [{ id: 1, name: 'Old Hand', trait: 'steady', kills: 9 }]);
  if (only > 0) devJumpTo(world, { kind: 'battle', n: only });
  const a = world.actions;
  const log: RunLog = { result: 'timeout', battles: [], steps: 0 };
  let current: BattleLog | null = null;
  let hullAtStart = 0;
  let hitsAtStart = 0;
  let aim = 0;
  let steps = 0;
  let aimed = false;
  let lastHits = 0;
  while (world.run.phase !== 'end' && steps < MAX_STEPS) {
    if (only > 0 && world.run.phase !== 'battle') break;
    steps++;
    const run = world.run;
    if (run.phase === 'battle') {
      if (!current || current.battle !== run.battle) {
        if (current) current.won = true;
        current = {
          waveHits: [],
          battle: run.battle,
          steps: 0,
          hullLost: 0,
          hits: 0,
          missileHits: 0,
          won: false,
        };
        log.battles.push(current);
        hullAtStart = run.hull;
        hitsAtStart = world.stats.hitsTaken;
      }
      current.steps++;
      for (const e of world.events.events)
        if (e.type === 'EnemyMissileHit' && e.hit === 'player') current.missileHits++;
      while (current.waveHits.length < run.wave) current.waveHits.push(0);
      if (run.wave > 0)
        current.waveHits[run.wave - 1] =
          (current.waveHits[run.wave - 1] ?? 0) + (world.stats.hitsTaken - lastHits);
      lastHits = world.stats.hitsTaken;
      a.menuUp = a.menuDown = a.menuSelect = a.menuBack = false;
      const target = nearestEnemy(world);
      if (skill < 0) {
        if (steps % 40 === 0) {
          a.steerX = rng.range(-1, 1);
          a.steerY = rng.range(-1, 1);
        }
        a.throttle = 0;
        a.fire = false;
        a.evade = false;
      } else {
        if (steps % bot.reaction === 0) {
          if (target) {
            // Lead the target: where it will be when a bullet (muzzle speed plus ours) gets there.
            const bullet = world.tuning.weapons.bulletSpeed + world.ship.speed;
            const t = target.dist / bullet;
            const lx = target.x + (target.vx - world.ship.vx) * t;
            const ly = target.y + (target.vy - world.ship.vy) * t;
            aim = Math.atan2(ly - world.ship.y, lx - world.ship.x);
            aim += rng.range(-bot.error, bot.error);
            aimed = true;
          } else aimed = false;
        }
        if (aimed) {
          a.steerX = Math.cos(aim);
          a.steerY = Math.sin(aim);
        } else {
          a.steerX = 0;
          a.steerY = 0;
        }
        const off = Math.abs(wrapAngle(aim - world.ship.heading));
        a.fire = !!target && target.dist < 1500 && off < 0.3;
        a.throttle = !target
          ? 0
          : target.dist > (target.part ? 1500 : 1200)
            ? 1
            : target.part && target.dist < 350
              ? -1
              : 0;
        // Roll away from a missile that is about to land, if the bot notices in time.
        const eta = missileEta(world);
        a.evade =
          (eta < 0.28 && eta > 0.08 && rng.next() < 0.04 + 0.1 * skill) ||
          (eta === Infinity &&
            shotClose(world) &&
            world.ship.evadeCooldown <= 0 &&
            rng.next() < 0.1 * skill);
        a.launch = skill >= 0.5 && steps % 240 === 0;
        a.attackOrder = skill >= 0.5 && steps % 600 === 0;
      }
    } else {
      a.fire = a.evade = a.launch = a.attackOrder = false;
      a.menuUp = a.menuDown = a.menuSelect = a.menuBack = false;
      if (steps % 6 === 0) {
        const roll = rng.next();
        if (roll < 0.45) a.menuSelect = true;
        else if (roll < 0.7) a.menuDown = true;
        else if (roll < 0.85) a.menuUp = true;
      }
    }
    stepWorld(world, DT);
    if (process.env.RAMP_DEBUG && steps % 300 === 0 && world.enemies.capital) {
      const cap = world.enemies.capital;
      process.stdout.write(
        `t=${(steps / 60).toFixed(0)} ship ${world.ship.x.toFixed(0)},${world.ship.y.toFixed(0)} sp ${world.ship.speed.toFixed(0)} cap ${cap.x.toFixed(0)},${cap.y.toFixed(0)} hp ${cap.parts.map((p) => Math.ceil(p.hp)).join(' ')} hull ${world.run.hull} fire ${a.fire}\n`,
      );
    }
    if (current && run.phase === 'battle') {
      current.hullLost = Math.max(0, hullAtStart - run.hull) + 0;
      current.hits = world.stats.hitsTaken - hitsAtStart;
    }
  }
  if (current && world.run.phase === 'end') current.won = world.run.result === 'victory';
  log.result =
    world.run.phase === 'end'
      ? world.run.result
      : only > 0 && world.run.phase !== 'battle'
        ? 'victory'
        : 'timeout';
  log.steps = steps;
  return log;
}

const SKILLS = process.env.RAMP_SKILLS
  ? process.env.RAMP_SKILLS.split(',').map(Number)
  : [-1, 0.2, 0.5, 0.8, 1];
const SEEDS = Array.from({ length: Number(process.env.RAMP_SEEDS ?? 8) }, (_, i) => i + 1);

describe('ramp tuning (scripted bots, whole runs, authored ramp)', () => {
  const results = new Map<number, RunLog[]>();
  for (const skill of SKILLS)
    results.set(
      skill,
      SEEDS.map((s) => playRun(s, skill)),
    );

  it('logs the ramp numbers', () => {
    if (!process.env.RAMP_LOG) return;
    const rows: string[] = [
      'skill | victory | reached battle 1..4 | mean hits per battle (1..4) | mean seconds per battle',
    ];
    for (const skill of SKILLS) {
      const runs = results.get(skill)!;
      const wins = runs.filter((r) => r.result === 'victory').length;
      const reached = [1, 2, 3, 4].map(
        (n) => runs.filter((r) => r.battles.some((b) => b.battle === n)).length,
      );
      const hits = [1, 2, 3, 4].map((n) => {
        const bs = runs.flatMap((r) => r.battles.filter((b) => b.battle === n));
        return bs.length ? (bs.reduce((s, b) => s + b.hits, 0) / bs.length).toFixed(1) : '-';
      });
      const secs = [1, 2, 3, 4].map((n) => {
        const bs = runs.flatMap((r) => r.battles.filter((b) => b.battle === n));
        return bs.length ? Math.round(bs.reduce((s, b) => s + b.steps, 0) / bs.length / 60) : '-';
      });
      rows.push(
        `${skill} | ${wins}/${runs.length} | ${reached.join(' ')} | ${hits.join(' ')} | ${secs.join(' ')}`,
      );
    }
    for (const skill of SKILLS) {
      const bs = results.get(skill)!.flatMap((r) => r.battles);
      for (const n of [1, 2, 3, 4]) {
        const b = bs.filter((x) => x.battle === n);
        const waves = [0, 1, 2, 3].map((w) => {
          const v = b.filter((x) => x.waveHits[w] !== undefined);
          return v.length ? (v.reduce((t, x) => t + x.waveHits[w]!, 0) / v.length).toFixed(1) : '-';
        });
        rows.push(`  skill ${skill} battle ${n}: hits per wave ${waves.join(' ')} (n=${b.length})`);
      }
    }
    process.stdout.write(`RAMP\n${rows.join('\n')}\n`);
  });

  it('logs each battle on its own (fresh hull and squad)', () => {
    if (!process.env.RAMP_LOG) return;
    const rows: string[] = ['battle alone: skill | won/total | mean hits | mean seconds'];
    for (const n of process.env.RAMP_ONLY ? [Number(process.env.RAMP_ONLY)] : [1, 2, 3, 4]) {
      for (const skill of SKILLS) {
        const runs = SEEDS.map((sd) => playRun(sd, skill, n));
        const won = runs.filter((r) => r.result === 'victory').length;
        const hits = runs.reduce((t, r) => t + (r.battles[0]?.hits ?? 0), 0) / runs.length;
        const secs = runs.reduce((t, r) => t + r.steps, 0) / runs.length / 60;
        const mh = runs.reduce((t, r) => t + (r.battles[0]?.missileHits ?? 0), 0) / runs.length;
        rows.push(
          `  battle ${n} skill ${skill}: ${won}/${runs.length}, ${hits.toFixed(1)} hits (${mh.toFixed(1)} missiles), ${Math.round(secs)} s`,
        );
      }
    }
    process.stdout.write(`${rows.join('\n')}\n`);
  });

  it('every run ends, whatever the bot', () => {
    for (const runs of results.values()) for (const r of runs) expect(r.result).not.toBe('timeout');
  });

  it('the no-skill bot never wins a whole run', () => {
    expect(results.get(-1)!.filter((r) => r.result === 'victory')).toHaveLength(0);
  });
});

describe('the authored ramp by battle (a decent bot, skill 0.8, each battle on its own)', () => {
  const alone = (n: number, skill: number, seeds: number, hull?: number) =>
    Array.from({ length: seeds }, (_, i) => playRun(i + 1, skill, n, hull));
  const winRate = (runs: RunLog[]): number =>
    runs.filter((r) => r.result === 'victory').length / runs.length;
  const meanHits = (runs: RunLog[]): number =>
    runs.reduce((t, r) => t + (r.battles[0]?.hits ?? 0), 0) / runs.length;

  it('battle 1 is trivial: the decent bot always wins and loses about a hull point', () => {
    const runs = alone(1, 0.8, 24);
    expect(winRate(runs)).toBeGreaterThanOrEqual(0.9);
    expect(meanHits(runs)).toBeLessThan(2);
  });

  it('the no-skill bot never clears battles 2 to 4', () => {
    for (const n of [2, 3, 4]) expect(winRate(alone(n, -1, 12))).toBe(0);
  });

  it('battle 4 is the hardest, yet the assisted bot (big hull) can finish it', () => {
    const decent = alone(4, 0.8, 16);
    expect(winRate(decent)).toBeLessThan(winRate(alone(1, 0.8, 16)));
    const assisted = alone(4, 0.8, 32, 20);
    expect(winRate(assisted)).toBeGreaterThan(0);
  });
});

describe('a lone gunship against a careless player (circling at cruise speed, no firing, no rolls)', () => {
  /** Hull points lost per 10 s over `seconds`, averaged over seeds. */
  function hullPer10s(seconds: number, seeds: number): number {
    let lost = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const tuning = createTuning();
      tuning.run.playerHull = 1000;
      const world = createWorld(seed, tuning);
      enterStartScreen(world);
      devJumpTo(world, { kind: 'battle', n: 2 });
      world.tuning.arena.enemiesFrozen = false;
      world.fighters.length = 0;
      spawnGunship(world, 1500, 0, Math.PI);
      const hull = world.run.hull;
      for (let i = 0; i < seconds * 60; i++) {
        // Circle the middle of the arena: a steady turn, the gunship has to track a moving target.
        world.actions.steerX = Math.cos(i * 0.02);
        world.actions.steerY = Math.sin(i * 0.02);
        world.run.wave = 1; // hold the battle's waves back: only this gunship fights
        stepWorld(world, DT);
      }
      lost += hull - world.run.hull;
    }
    return (lost / seeds / seconds) * 10;
  }

  it('costs about 1 to 2 hull points per 10 s, not a burst that ends the run', () => {
    const rate = hullPer10s(60, 8);
    if (process.env.RAMP_LOG) process.stdout.write(`GUNSHIP hull per 10 s: ${rate.toFixed(2)}\n`);
    expect(rate).toBeGreaterThan(0.3);
    expect(rate).toBeLessThan(2.5);
  });
});

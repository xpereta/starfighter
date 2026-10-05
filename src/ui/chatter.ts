import type { ChatterConfig } from '../../data/tuning/chatter';
import type { TraitId } from '../../data/content/traits';
import { createRng, type Rng } from '../core/rng/rng';
import type { World } from '../core/world/world';
import { CHATTER_LINES, type ChatterKind } from './chatter-lines';
import { pilotHull } from './roster';

/**
 * The radio chatter feed (spec section 4). Presentation only: it reads the world's events and pilots,
 * never changes them, and is not in the replay hash. The wording comes from its own seeded generator,
 * so the same replay (same seed, same events) shows the same text.
 */

/** Higher wins when several lines wait for the radio. */
const PRIORITY: Record<ChatterKind, number> = {
  kill: 0,
  hurt: 2,
  joined: 2,
  rescued: 3,
  cleared: 4,
  won: 4,
  lost: 5,
};
/** A waiting line is dropped when it is this many gaps old (a stale call is worse than none). */
const PENDING_GAPS = 2;
/** A line fades during its last second. */
const FADE_SECONDS = 1;

interface Pending {
  kind: ChatterKind;
  text: string;
  trait: TraitId;
  ttl: number;
}

export interface ChatterLine {
  text: string;
  trait: TraitId;
  /** Seconds on screen. */
  age: number;
}

export interface Chatter {
  readonly rng: Rng;
  pending: Pending[];
  lines: ChatterLine[];
  /** Seconds until the radio may speak again. */
  gap: number;
  /** Last seen hit points of each pilot, to notice a hit that leaves them low. */
  lastHp: Map<number, number>;
}

export function createChatter(seed: number): Chatter {
  return { rng: createRng(seed ^ 0x5eed), pending: [], lines: [], gap: 0, lastHp: new Map() };
}

/** Empties the feed (a new run, or a menu came up). */
export function clearChatter(chatter: Chatter): void {
  chatter.pending.length = 0;
  chatter.lines.length = 0;
  chatter.gap = 0;
  chatter.lastHp.clear();
}

function fill(template: string, self: string, name: string): string {
  return template.replaceAll('{self}', self).replaceAll('{name}', name);
}

function queue(
  chatter: Chatter,
  cfg: ChatterConfig,
  kind: ChatterKind,
  speaker: { name: string; trait: TraitId },
  subject: string,
): void {
  const template = CHATTER_LINES[speaker.trait][kind][chatter.rng.int(3)] ?? '';
  chatter.pending.push({
    kind,
    text: `${speaker.name}: ${fill(template, speaker.name, subject)}`,
    trait: speaker.trait,
    ttl: Math.max(cfg.chatterGap, 1) * PENDING_GAPS,
  });
}

/** A random active pilot other than `exceptId`, or null when nobody is left to speak. */
function anySpeaker(chatter: Chatter, world: World, exceptId = -1) {
  const active = world.pilots.roster.filter((p) => p.status === 'active' && p.id !== exceptId);
  return active.length === 0 ? null : active[chatter.rng.int(active.length)]!;
}

/** Reads this step's events (and any pilot hit that left a hull low) and queues the lines they call for. */
export function feedChatter(chatter: Chatter, world: World): void {
  if (world.run.mode !== 'run') return;
  const cfg = world.tuning.chatter;
  const pilot = (id: number) => world.pilots.roster.find((p) => p.id === id);
  for (const e of world.events.events) {
    if (e.type === 'PilotJoined') {
      const p = pilot(e.pilotId);
      if (p) queue(chatter, cfg, e.how === 'rescue' ? 'rescued' : 'joined', p, p.name);
    } else if (e.type === 'PilotKill') {
      const p = pilot(e.pilotId);
      if (p && chatter.rng.next() < cfg.killChance) queue(chatter, cfg, 'kill', p, p.name);
    } else if (e.type === 'PilotLost') {
      const gone = pilot(e.pilotId);
      const speaker = anySpeaker(chatter, world, e.pilotId);
      if (gone && speaker) queue(chatter, cfg, 'lost', speaker, gone.name);
      chatter.lastHp.delete(e.pilotId);
    } else if (e.type === 'BattleCleared' || (e.type === 'RunEnded' && e.result === 'victory')) {
      const speaker = anySpeaker(chatter, world);
      if (speaker)
        queue(chatter, cfg, e.type === 'BattleCleared' ? 'cleared' : 'won', speaker, speaker.name);
    }
  }
  for (const p of world.pilots.roster) {
    const hull = pilotHull(world, p);
    if (!hull) continue;
    const before = chatter.lastHp.get(p.id);
    chatter.lastHp.set(p.id, hull.hp);
    if (before !== undefined && hull.hp < before && hull.hp > 0 && hull.hp <= cfg.lowHull) {
      queue(chatter, cfg, 'hurt', p, p.name);
    }
  }
}

/** Advances the feed by `dt` seconds: ages and removes lines, lets the radio speak when its gap is over. */
export function stepChatter(chatter: Chatter, dt: number, cfg: ChatterConfig): void {
  for (const l of chatter.lines) l.age += dt;
  chatter.lines = chatter.lines.filter((l) => l.age < cfg.chatterLife);
  for (const p of chatter.pending) p.ttl -= dt;
  chatter.pending = chatter.pending.filter((p) => p.ttl > 0);
  chatter.gap = Math.max(0, chatter.gap - dt);
  if (chatter.gap > 0 || chatter.pending.length === 0) return;

  let best = 0;
  chatter.pending.forEach((p, i) => {
    if (PRIORITY[p.kind] > PRIORITY[chatter.pending[best]!.kind]) best = i; // ties keep the oldest
  });
  const [next] = chatter.pending.splice(best, 1);
  chatter.lines.push({ text: next!.text, trait: next!.trait, age: 0 });
  chatter.gap = cfg.chatterGap;
  const max = Math.max(1, Math.round(cfg.chatterLines));
  if (chatter.lines.length > max) chatter.lines.splice(0, chatter.lines.length - max);
}

/** How opaque a line is: fully until its last second, then fading to nothing. */
export function lineAlpha(line: ChatterLine, cfg: ChatterConfig): number {
  return Math.max(0, Math.min(1, (cfg.chatterLife - line.age) / FADE_SECONDS));
}

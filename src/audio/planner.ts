import type { GameEvent } from '../core/events/events';
import type { SoundEntry, SoundEventKey, SoundTable } from '../render/style';
import type { PlayRequest } from './backend';

/** Where the player is (the "ears"): sounds pan and fade relative to this. World units (u). */
export interface Listener {
  x: number;
  y: number;
}

export const MIN_PITCH = 0.1;
export const MAX_PITCH = 10;

export interface PlanOptions {
  /** The sound test: ignore the minimum gap and the voice limit. */
  test?: boolean;
}

export interface Planned {
  request: PlayRequest;
  /** Music ducking this sound asks for. */
  duck: SoundEntry['duck'];
}

export interface Planner {
  plan(
    key: SoundEventKey,
    event: GameEvent | null,
    listener: Listener,
    now: number,
    options?: PlanOptions,
  ): Planned | null;
  /** Forget gaps and voices (a style switch or a restart). */
  reset(): void;
}

/** Seconds a sound lasts (s). */
export function soundDuration(source: SoundEntry['source']): number {
  if (source.kind === 'sample') return source.duration;
  let end = 0;
  for (const l of source.layers) end = Math.max(end, (l.delay ?? 0) + l.attack + l.decay);
  return end;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function position(event: GameEvent | null): { x: number; y: number } | null {
  if (!event) return null;
  switch (event.type) {
    case 'ShotFired':
    case 'Hit':
    case 'Killed':
    case 'EvadeStarted':
    case 'MissileLaunched':
    case 'PodSpawned':
      return event;
    default:
      return null;
  }
}

/**
 * The pure decision of what plays: looks the event up in the style's table, applies the minimum
 * gap and the voice limit, rolls the pitch, and works out volume and pan from the event position.
 * No Web Audio here, so it is tested with plain numbers. `rng` is audio's own stream (never the
 * simulation's, never in the hash).
 */
export function createPlanner(table: () => SoundTable, rng: () => number): Planner {
  const lastAt = new Map<SoundEventKey, number>();
  const voiceEnds = new Map<SoundEventKey, number[]>();
  return {
    plan(key, event, listener, now, options = {}) {
      const entry = table()[key];
      if (entry === undefined || entry === 'silent') return null;
      const ends = (voiceEnds.get(key) ?? []).filter((t) => t > now);
      voiceEnds.set(key, ends);
      if (!options.test) {
        const last = lastAt.get(key);
        if (last !== undefined && now - last < entry.minGap) return null;
        if (ends.length >= entry.maxVoices) return null;
      }

      let pitch = entry.pitch * (1 + (rng() * 2 - 1) * entry.pitchRandom);
      let volume = entry.volume;
      if (entry.size && event?.type === 'Killed') {
        const ratio = entry.size.ref / Math.max(1, event.radius);
        pitch *= ratio ** entry.size.exponent;
        volume *= clamp((1 / ratio) ** (entry.size.exponent * 0.5), 0.5, 1.5);
      }
      let pan = 0;
      const at = position(event);
      if (entry.spatial && at) {
        const dx = at.x - listener.x;
        const dist = Math.hypot(dx, at.y - listener.y);
        const far = clamp(dist / entry.spatial.range, 0, 1);
        pan = clamp(dx / entry.spatial.range, -1, 1) * entry.spatial.pan;
        volume *= 1 - far * (1 - entry.spatial.farVolume);
      }

      const duration = soundDuration(entry.source);
      lastAt.set(key, now);
      ends.push(now + duration);
      return {
        request: {
          key,
          source: entry.source,
          pitch: clamp(pitch, MIN_PITCH, MAX_PITCH),
          volume: clamp(volume, 0, 1),
          pan: clamp(pan, -1, 1),
          duration,
        },
        duck: entry.duck,
      };
    },
    reset() {
      lastAt.clear();
      voiceEnds.clear();
    },
  };
}

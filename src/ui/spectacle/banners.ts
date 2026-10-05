import type { GameEvent } from '../../core/events/events';
import type { PresentationDef } from './presentation';
import { slide, type Slide } from './anim';

/**
 * Title cards and banners ("BATTLE 2", "WAVE 2/3", "BATTLE CLEARED", "PILOT LOST", the victory and
 * defeat cards), one at a time from a short queue. Read from the run events, drawn by the HUD view.
 * Presentation only.
 */

export type BannerKind =
  'battle' | 'wave' | 'cleared' | 'lost' | 'rescued' | 'victory' | 'defeat' | 'multikill';

export interface Banner {
  kind: BannerKind;
  title: string;
  sub: string;
  /** Seconds since it appeared. */
  age: number;
  /** Seconds it takes in all. */
  total: number;
  /** Full-width cards (battle start, victory, defeat) against small corner banners. */
  big: boolean;
}

export interface Banners {
  current: Banner | null;
  queue: Banner[];
}

/** What the banners need to know about the run when an event happens. */
export interface BannerContext {
  waveTotal: number;
  battles: number;
  pilotName: (id: number) => string | undefined;
}

export const MAX_QUEUE = 4;
/** Big cards hold longer than corner banners by this factor. */
const BIG_HOLD = 1.5;

export function createBanners(): Banners {
  return { current: null, queue: [] };
}

export function clearBanners(b: Banners): void {
  b.current = null;
  b.queue.length = 0;
}

function make(
  def: PresentationDef,
  kind: BannerKind,
  title: string,
  sub: string,
  big: boolean,
): Banner {
  const { in: inT, hold, out } = def.banner;
  return { kind, title, sub, age: 0, total: inT + hold * (big ? BIG_HOLD : 1) + out, big };
}

/** Turns this step's events into banners. */
export function feedBanners(
  b: Banners,
  events: readonly GameEvent[],
  ctx: BannerContext,
  def: PresentationDef,
): void {
  const w = def.words;
  const add = (banner: Banner): void => {
    if (b.queue.length >= MAX_QUEUE) b.queue.shift();
    b.queue.push(banner);
  };
  for (const e of events) {
    if (e.type === 'BattleStarted') {
      add(
        make(
          def,
          'battle',
          `${w.battle} ${e.battle}`,
          `${w.wave} 1/${Math.max(1, ctx.waveTotal)}`,
          true,
        ),
      );
    } else if (e.type === 'WaveStarted' && e.wave > 1) {
      add(
        make(
          def,
          'wave',
          `${w.wave} ${e.wave}/${Math.max(1, ctx.waveTotal)}`,
          `${w.battle} ${e.battle}`,
          false,
        ),
      );
    } else if (e.type === 'BattleCleared') {
      add(make(def, 'cleared', w.cleared, `${e.battle} / ${ctx.battles}`, true));
    } else if (e.type === 'PilotLost') {
      add(make(def, 'lost', w.pilotLost, (ctx.pilotName(e.pilotId) ?? '').toUpperCase(), false));
    } else if (e.type === 'PodRescued') {
      add(make(def, 'rescued', w.rescued, (ctx.pilotName(e.pilotId) ?? '').toUpperCase(), false));
    } else if (e.type === 'RunEnded') {
      add(
        e.result === 'victory'
          ? make(def, 'victory', w.victory, w.tagline, true)
          : make(def, 'defeat', w.defeat, w.tagline, true),
      );
    }
  }
}

/** Shows a one-off banner at once (the multi-kill call), ahead of the queue. */
export function pushNow(b: Banners, banner: Banner): void {
  b.queue.unshift(banner);
  if (b.current && !b.current.big) b.current = null;
}

export function makeBanner(
  def: PresentationDef,
  kind: BannerKind,
  title: string,
  sub: string,
  big = false,
): Banner {
  return make(def, kind, title, sub, big);
}

/** Advances the banner clock; takes the next one from the queue when the current one is done. */
export function stepBanners(b: Banners, dt: number): void {
  if (b.current) {
    b.current.age += dt;
    if (b.current.age >= b.current.total) b.current = null;
  }
  if (!b.current && b.queue.length > 0) b.current = b.queue.shift()!;
}

/** Where a banner is in its slide: the in, hold and out parts scale to the banner's own total. */
export function bannerSlide(banner: Banner, def: PresentationDef): Slide {
  const { in: inT, out } = def.banner;
  const hold = Math.max(0, banner.total - inT - out);
  return slide(banner.age, inT, hold, out);
}

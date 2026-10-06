import { describe, expect, it } from 'vitest';
import { presentation as def } from '../../../data/styles/anime-spectacle/presentation';
import type { GameEvent } from '../../core/events/events';
import {
  bannerSlide,
  clearBanners,
  createBanners,
  feedBanners,
  makeBanner,
  MAX_QUEUE,
  pushNow,
  stepBanners,
} from './banners';

const ctx = {
  waveTotal: 3,
  battles: 4,
  pilotName: (id: number): string | undefined => (id === 2 ? 'Mara Vex' : undefined),
};

describe('banners', () => {
  it('a battle start is a big title card with its wave count', () => {
    const b = createBanners();
    feedBanners(b, [{ type: 'BattleStarted', battle: 2 }], ctx, def);
    stepBanners(b, 0);
    expect(b.current).toMatchObject({
      kind: 'battle',
      title: 'BATTLE 2',
      sub: 'WAVE 1/3',
      big: true,
    });
  });

  it('wave 1 has no banner of its own, later waves do', () => {
    const b = createBanners();
    feedBanners(b, [{ type: 'WaveStarted', battle: 1, wave: 1 }], ctx, def);
    expect(b.queue).toHaveLength(0);
    feedBanners(b, [{ type: 'WaveStarted', battle: 2, wave: 2 }], ctx, def);
    expect(b.queue[0]).toMatchObject({ title: 'WAVE 2/3', sub: 'BATTLE 2', big: false });
  });

  it('names the pilot on lost and rescued banners', () => {
    const b = createBanners();
    const events: GameEvent[] = [
      { type: 'PilotLost', pilotId: 2 },
      { type: 'PodRescued', pilotId: 2 },
    ];
    feedBanners(b, events, ctx, def);
    expect(b.queue.map((x) => x.sub)).toEqual(['MARA VEX', 'MARA VEX']);
  });

  it('shows one at a time, in order, and moves on when one is over', () => {
    const b = createBanners();
    feedBanners(
      b,
      [
        { type: 'BattleCleared', battle: 1 },
        { type: 'RunEnded', result: 'victory' },
      ],
      ctx,
      def,
    );
    stepBanners(b, 0);
    expect(b.current?.kind).toBe('cleared');
    stepBanners(b, b.current!.total + 0.01);
    expect(b.current?.kind).toBe('victory');
    stepBanners(b, b.current!.total + 0.01);
    expect(b.current).toBeNull();
  });

  it('caps the queue and can be cleared', () => {
    const b = createBanners();
    const events: GameEvent[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'WaveStarted',
      battle: 1,
      wave: i + 2,
    }));
    feedBanners(b, events, ctx, def);
    expect(b.queue.length).toBe(MAX_QUEUE);
    clearBanners(b);
    expect(b.queue).toHaveLength(0);
    expect(b.current).toBeNull();
  });

  it('a one-off banner jumps the queue and replaces a small one on screen', () => {
    const b = createBanners();
    feedBanners(b, [{ type: 'WaveStarted', battle: 1, wave: 2 }], ctx, def);
    stepBanners(b, 0);
    pushNow(b, makeBanner(def, 'multikill', 'MULTI KILL', 'x3'));
    stepBanners(b, 0);
    expect(b.current?.kind).toBe('multikill');
  });

  it('slides in, holds and slides out over its length', () => {
    const b = createBanners();
    feedBanners(b, [{ type: 'BattleStarted', battle: 1 }], ctx, def);
    stepBanners(b, 0);
    const banner = b.current!;
    expect(bannerSlide(banner, def).phase).toBe('in');
    banner.age = def.banner.in + 0.1;
    expect(bannerSlide(banner, def)).toMatchObject({ phase: 'hold', off: 0, alpha: 1 });
    banner.age = banner.total - def.banner.out / 2;
    expect(bannerSlide(banner, def).phase).toBe('out');
  });
});

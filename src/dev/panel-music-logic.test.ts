import { describe, expect, it } from 'vitest';
import type { MusicStatus } from '../audio/conductor';
import { formatMusicStatus, formatStems } from './panel-music-logic';

const status: MusicStatus = {
  scene: 'flight',
  cue: 'battle',
  bar: 2,
  bars: 8,
  intensity: 0.62,
  target: 0.7,
  heat: 0.1,
  bpm: 124,
  stems: [],
  sting: '',
  forced: null,
  stingers: [],
};

describe('music readout', () => {
  it('shows scene, cue, bar, intensity, heat, tempo and the stinger in one line', () => {
    const line = formatMusicStatus(status);
    expect(line).toContain('flying');
    expect(line).toContain('battle bar 3/8');
    expect(line).toContain('intensity 0.62 (target 0.70)');
    expect(line).toContain('124 bpm');
    expect(line).toContain('no stinger');
    expect(formatMusicStatus({ ...status, forced: { intensity: 1 }, sting: 'victory' })).toContain(
      '(forced)',
    );
  });

  it('lists the stems that are on with their level and the ones that are off', () => {
    expect(
      formatStems([
        { id: 'pad', gain: 0.6 },
        { id: 'kick', gain: 0 },
      ]),
    ).toBe('on: pad 60% | off: kick');
    expect(formatStems([{ id: 'kick', gain: 0 }])).toBe('on: none | off: kick');
  });
});

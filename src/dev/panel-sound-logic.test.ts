import { describe, expect, it } from 'vitest';
import { zeroLoopState, type LoopFrame } from '../audio/loops';
import { silentLoopTable, type LoopEntry, type LoopTable } from '../render/style';
import { formatLoopsActive, formatLoopValues } from './panel-sound-logic';

const entry: LoopEntry = {
  layers: [{ waveform: 'sine', freq: 100, gain: 0.5 }],
  volume: 0.1,
  gain: {
    state: 'speed',
    points: [
      [0, 0],
      [1, 1],
    ],
  },
  fadeIn: 0.3,
  fadeOut: 0.3,
};
const frame = (key: LoopFrame['key'], level: number): LoopFrame => ({
  key,
  layers: entry.layers,
  signature: '',
  gain: level * 0.1,
  pitch: 1,
  cutoff: 1,
  send: 0,
  target: level,
  level,
});

describe('loop readout', () => {
  it('prints the game values the loops follow', () => {
    const text = formatLoopValues({
      ...zeroLoopState(),
      speed: 0.625,
      throttle: -0.5,
      hull: 0.4,
      edge: 1,
      always: 1,
    });
    expect(text).toBe(
      'speed 0.63 · throttle -0.50 · hull 0.40 · rescue 0.00 · missiles 0.00 · edge out · flying',
    );
    expect(formatLoopValues(zeroLoopState())).toContain('menu');
  });

  it('lists the loops that are on with their level, the ones that are off, and the silent ones', () => {
    const table: LoopTable = {
      ...silentLoopTable(),
      engine: entry,
      afterburner: entry,
      ambient: entry,
    };
    const text = formatLoopsActive([frame('engine', 0.62), frame('ambient', 1)], table);
    expect(text).toBe(
      'on: engine 62%, ambient 100% | off: afterburner | silent: rumble, missiles, rescue, hullAlarm, edgeAlarm',
    );
  });

  it('says none when nothing runs', () => {
    expect(formatLoopsActive([], silentLoopTable())).toContain('on: none');
  });
});

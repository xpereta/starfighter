import { describe, expect, it } from 'vitest';
import { createMixConfig } from '../../data/audio/mix';
import { createTuning } from '../../data/tuning';
import { createWorld } from '../core/world/world';
import {
  silentLoopTable,
  silentSoundTable,
  validateLoops,
  type LoopEntry,
  type LoopTable,
} from '../render/style';
import { createAudioEngine } from './engine';
import { createFakeBackend } from './fake-backend';
import {
  createLoopPlanner,
  LOOP_OFF_LEVEL,
  previewLoopState,
  sampleLoopCurve,
  zeroLoopState,
} from './loops';
import { loopStateOf, MISSILES_FULL } from './state';

const hum = (over: Partial<LoopEntry> = {}): LoopEntry => ({
  layers: [{ waveform: 'sawtooth', freq: 80, gain: 0.5 }],
  volume: 0.5,
  gain: {
    state: 'speed',
    points: [
      [0, 0],
      [1, 1],
    ],
  },
  fadeIn: 0.3,
  fadeOut: 0.6,
  ...over,
});
const table = (over: Partial<LoopTable>): LoopTable => ({ ...silentLoopTable(), ...over });
const at = (patch: Partial<ReturnType<typeof zeroLoopState>>) => ({
  ...zeroLoopState(),
  always: 1,
  ...patch,
});

describe('loop curves', () => {
  const curve = {
    state: 'speed' as const,
    points: [
      [0.2, 1],
      [0.6, 3],
    ] as const,
  };
  it('interpolates between points and stays flat beyond them', () => {
    expect(sampleLoopCurve(curve, at({ speed: 0 }))).toBe(1);
    expect(sampleLoopCurve(curve, at({ speed: 0.4 }))).toBeCloseTo(2);
    expect(sampleLoopCurve(curve, at({ speed: 1 }))).toBe(3);
  });
});

describe('loop planner', () => {
  it('a loop whose value is 0 has no frame at all (the backend switches it off)', () => {
    const p = createLoopPlanner(() => table({ engine: hum() }));
    expect(p.step(at({ speed: 0 }), 1 / 60)).toEqual([]);
  });

  it('fades in smoothly towards the curve value, never overshooting and never jumping', () => {
    const p = createLoopPlanner(() => table({ engine: hum({ volume: 1 }) }));
    let last = 0;
    for (let i = 0; i < 200; i++) {
      const [f] = p.step(at({ speed: 1 }), 1 / 60);
      expect(f!.gain).toBeGreaterThanOrEqual(last);
      expect(f!.gain).toBeLessThanOrEqual(1);
      expect(f!.gain - last).toBeLessThan(0.2); // a smooth rise, no step to full
      last = f!.gain;
    }
    expect(last).toBeGreaterThan(0.99);
  });

  it('reaches ~95% of the way in the loop fade-in time', () => {
    const p = createLoopPlanner(() => table({ engine: hum({ volume: 1, fadeIn: 0.5 }) }));
    let f = p.step(at({ speed: 1 }), 0)[0];
    for (let i = 0; i < 30; i++) f = p.step(at({ speed: 1 }), 1 / 60)[0]; // 0.5 s
    expect(f!.gain).toBeGreaterThan(0.93);
    expect(f!.gain).toBeLessThan(0.97);
  });

  it('fades out with its own fade-out time and is gone once it is inaudible', () => {
    const p = createLoopPlanner(() => table({ engine: hum({ volume: 1, fadeOut: 0.3 }) }));
    for (let i = 0; i < 120; i++) p.step(at({ speed: 1 }), 1 / 60);
    let frames = p.step(at({ speed: 0 }), 1 / 60);
    expect(frames).toHaveLength(1); // still fading
    expect(frames[0]!.gain).toBeLessThan(1);
    for (let i = 0; i < 300 && frames.length; i++) frames = p.step(at({ speed: 0 }), 1 / 60);
    expect(frames).toEqual([]);
  });

  it('LOOP_OFF_LEVEL is below audibility', () => {
    expect(LOOP_OFF_LEVEL).toBeLessThan(0.01);
  });

  it('pitch and cutoff follow their own curves; the volume scales the gain', () => {
    const entry = hum({
      volume: 0.4,
      pitch: {
        state: 'throttle',
        points: [
          [-1, 0.5],
          [1, 2],
        ],
      },
      cutoff: {
        state: 'speed',
        points: [
          [0, 1],
          [1, 3],
        ],
      },
    });
    const p = createLoopPlanner(() => table({ engine: entry }));
    for (let i = 0; i < 300; i++) p.step(at({ speed: 1, throttle: 1 }), 1 / 60);
    const [f] = p.step(at({ speed: 1, throttle: 1 }), 1 / 60);
    expect(f!.gain).toBeCloseTo(0.4, 2);
    expect(f!.pitch).toBeCloseTo(2);
    expect(f!.cutoff).toBeCloseTo(3);
  });

  it('a silent or missing loop never plays; the layers signature changes with the recipe', () => {
    const a = hum();
    const b = hum({ layers: [{ waveform: 'sine', freq: 90, gain: 0.5 }] });
    let current: LoopEntry = a;
    const p = createLoopPlanner(() => table({ engine: current, rumble: 'silent' }));
    const first = p.step(at({ speed: 1 }), 1)[0]!;
    current = b;
    const second = p.step(at({ speed: 1 }), 1)[0]!;
    expect(second.signature).not.toBe(first.signature);
    expect(p.step(at({ speed: 1 }), 1).every((f) => f.key === 'engine')).toBe(true);
  });

  it('nothing runs in a menu: with `always` at 0 even an idle engine is off', () => {
    const idle = hum({
      gain: {
        state: 'speed',
        points: [
          [0, 0.5],
          [1, 1],
        ],
      },
    });
    const p = createLoopPlanner(() => table({ engine: idle }));
    for (let i = 0; i < 60; i++) expect(p.step(at({ speed: 0, always: 0 }), 1 / 60)).toEqual([]);
    expect(p.step(at({ speed: 0, always: 1 }), 1 / 60)).toHaveLength(1);
  });

  it('reset silences everything again', () => {
    const p = createLoopPlanner(() => table({ engine: hum({ volume: 1 }) }));
    for (let i = 0; i < 100; i++) p.step(at({ speed: 1 }), 1 / 60);
    p.reset();
    expect(p.step(at({ speed: 1 }), 1 / 60)[0]!.gain).toBeLessThan(0.2);
  });
});

describe('loop preview state', () => {
  it('sets only the value the loop follows (plus always), the rest quiet', () => {
    const s = previewLoopState(hum(), 0.5);
    expect(s.speed).toBe(0.5);
    expect(s.always).toBe(1);
    expect(s.rescue).toBe(0);
    // The hull preview counts damage: more preview, lower hull.
    const hullAlarm = hum({
      gain: {
        state: 'hull',
        points: [
          [0, 1],
          [0.4, 0],
        ],
      },
    });
    expect(previewLoopState(hullAlarm, 1).hull).toBe(0);
    expect(previewLoopState(hullAlarm, 0).hull).toBe(1);
    const edge = previewLoopState(
      hum({
        gain: {
          state: 'edge',
          points: [
            [0, 0],
            [1, 1],
          ],
        },
      }),
      0.6,
    );
    expect(edge.edge).toBe(1);
  });
});

describe('loop validation', () => {
  it('accepts a good loop and names what is wrong in a bad one', () => {
    expect(validateLoops({ engine: hum(), rumble: 'silent' })).toEqual([]);
    const bad = validateLoops({
      engine: hum({ volume: 2, fadeIn: 0, gain: { state: 'nope' as never, points: [[0, 0]] } }),
      nothing: 'silent',
    } as never);
    const text = bad.join(' | ');
    expect(text).toContain('loops.engine.volume');
    expect(text).toContain('loops.engine.fadeIn');
    expect(text).toContain('loops.engine.gain.state');
    expect(text).toContain('loops.engine.gain.points');
    expect(text).toContain('loops.nothing');
  });

  it('points must rise in value and stay in range', () => {
    const e = hum({
      gain: {
        state: 'speed',
        points: [
          [0.5, 0],
          [0.5, 1],
        ],
      },
    });
    expect(validateLoops({ engine: e }).join()).toContain('rise');
    const e2 = hum({
      gain: {
        state: 'speed',
        points: [
          [0, 0],
          [1, 3],
        ],
      },
    });
    expect(validateLoops({ engine: e2 }).join()).toContain('output');
  });
});

describe('loop state from the world', () => {
  it('is all quiet outside a battle (menus)', () => {
    const w = createWorld(1, createTuning());
    w.run.phase = 'start';
    expect(loopStateOf(w)).toEqual(zeroLoopState());
  });

  it('reads speed, throttle, edge, missiles, hull and the best rescue progress', () => {
    const w = createWorld(1, createTuning());
    const maxSpeed = w.tuning.flight.maxSpeed;
    w.ship.speed = maxSpeed / 2;
    w.actions.throttle = 5; // out of range: clamped
    w.ship.outside = true;
    const s = loopStateOf(w);
    expect(s.speed).toBeCloseTo(0.5);
    expect(s.throttle).toBe(1);
    expect(s.edge).toBe(1);
    expect(s.always).toBe(1);
    expect(s.hull).toBe(1); // practice mode has no hull
    expect(s.rescue).toBe(0);
    expect(MISSILES_FULL).toBeGreaterThan(0);

    w.run.mode = 'run';
    w.run.hull = w.tuning.run.playerHull / 5;
    const pod = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      hp: 1,
      alive: true,
      progress: 0.4,
      pilotId: 0,
      battle: 1,
      rescued: false,
    };
    w.pods.push(pod, { ...pod, progress: 0.7 }, { ...pod, progress: 0.9, rescued: true });
    const r = loopStateOf(w);
    expect(r.hull).toBeCloseTo(0.2);
    expect(r.rescue).toBeCloseTo(0.7);
  });
});

describe('engine with loops', () => {
  const setup = (loops: LoopTable) => {
    const backend = createFakeBackend();
    const engine = createAudioEngine({
      backend,
      table: () => silentSoundTable(),
      loops: () => loops,
      mix: createMixConfig(),
    });
    return { backend, engine };
  };

  it('sends loop frames only after unlock and while not paused', () => {
    const { backend, engine } = setup(table({ engine: hum() }));
    engine.setLoopState(at({ speed: 1 }), 0.1);
    expect(backend.loopCalls).toBe(0);
    engine.unlock();
    engine.setLoopState(at({ speed: 1 }), 0.1);
    expect(backend.loopCalls).toBe(1);
    expect(backend.loops.map((f) => f.key)).toEqual(['engine']);
    engine.setPaused(true);
    engine.setLoopState(at({ speed: 1 }), 0.1);
    expect(backend.loopCalls).toBe(1);
  });

  it('exposes what the loops are doing for the panel, and the preview overrides the state', () => {
    const { backend, engine } = setup(table({ engine: hum({ volume: 1 }) }));
    engine.unlock();
    engine.setLoopState(at({ speed: 0 }), 0.1);
    expect(backend.loops).toEqual([]);
    engine.previewLoop('engine', 1);
    engine.setLoopState(at({ speed: 0 }), 0.5);
    expect(engine.loopStatus.state.speed).toBe(1);
    expect(backend.loops).toHaveLength(1);
    engine.previewLoop(null);
    engine.setLoopState(at({ speed: 0 }), 0.5);
    expect(engine.loopStatus.state.speed).toBe(0);
  });
});

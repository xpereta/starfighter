import { describe, expect, it } from 'vitest';
import { score as spectacle } from '../../data/styles/anime-spectacle/music';
import type { GameEvent } from '../core/events/events';
import {
  createConductor,
  followIntensity,
  intensityTarget,
  PLAN_AHEAD,
  type BarPlan,
  type MusicInput,
} from './conductor';
import { barSeconds, STEPS_PER_BAR, type ScoreDef } from './score';

/** Runs the conductor like the engine does: a frame every 1/60 s on a fake audio clock. */
function drive(
  score: ScoreDef,
  input: () => MusicInput,
  seconds: number,
  onFrame?: (now: number, c: ReturnType<typeof createConductor>) => void,
) {
  const c = createConductor(() => score);
  c.reset(0);
  const bars: BarPlan[] = [];
  const stings: { key: string; time: number }[] = [];
  const dt = 1 / 60;
  for (let now = 0; now < seconds; now += dt) {
    c.setInput(input());
    onFrame?.(now, c);
    const step = c.step(now, dt);
    bars.push(...step.bars);
    stings.push(...step.stingers.map((s) => ({ key: s.key, time: s.time })));
  }
  return { c, bars, stings };
}

const flight = (over: Partial<MusicInput> = {}): MusicInput => ({
  scene: 'flight',
  enemies: 0,
  hull: 1,
  rescue: 0,
  ...over,
});

const gain = (bar: BarPlan, id: string): number => bar.stems.find((s) => s.id === id)?.gain ?? -1;

describe('intensity', () => {
  const r = spectacle.intensity;

  it('is 0 outside flight, calm with nothing to fight, higher with enemies, hull loss and heat', () => {
    expect(intensityTarget(r, { scene: 'menu', enemies: 9, hull: 0, rescue: 0 }, 1)).toBe(0);
    const calm = intensityTarget(r, flight(), 0);
    const few = intensityTarget(r, flight({ enemies: 2 }), 0);
    const many = intensityTarget(r, flight({ enemies: 8 }), 0);
    const hurt = intensityTarget(r, flight({ enemies: 8, hull: 0.1 }), 0);
    expect(calm).toBeCloseTo(r.calm);
    expect(few).toBeGreaterThan(calm + r.enemyFloor - 1e-9);
    expect(many).toBeGreaterThan(few);
    expect(hurt).toBeGreaterThan(many);
    expect(intensityTarget(r, flight({ enemies: 1 }), 1)).toBeGreaterThan(
      intensityTarget(r, flight({ enemies: 1 }), 0),
    );
    for (const v of [calm, few, many, hurt]) expect(v).toBeLessThanOrEqual(1);
  });

  it('rises faster than it falls and never overshoots', () => {
    const up = followIntensity(0, 1, 1, r);
    const down = 1 - followIntensity(1, 0, 1, r);
    expect(up).toBeGreaterThan(down);
    expect(up).toBeLessThan(1);
    expect(followIntensity(0.5, 0.5, 1, r)).toBeCloseTo(0.5);
  });
});

describe('the conductor plans bars on the bar grid', () => {
  it('starts just after reset and keeps contiguous bars of the right length', () => {
    const { bars } = drive(spectacle, () => flight(), 12);
    const len = barSeconds(spectacle.bpm);
    expect(bars.length).toBeGreaterThanOrEqual(5);
    expect(bars[0]!.time).toBeGreaterThan(0);
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i]!.time - bars[i - 1]!.time).toBeCloseTo(len, 6);
    }
    // Bars are planned a little ahead, never in the past.
    bars.forEach((b) => expect(b.time + 1e-9).toBeGreaterThan(0));
    expect(bars[0]!.cue).toBe('battle');
    expect(bars.map((b) => b.bar).slice(0, 3)).toEqual([0, 1, 2]);
  });

  it('plans each bar no earlier than PLAN_AHEAD before it starts', () => {
    const c = createConductor(() => spectacle);
    c.reset(0);
    c.setInput(flight());
    for (let now = 0; now < 8; now += 1 / 60) {
      for (const bar of c.step(now, 1 / 60).bars) {
        expect(bar.time - now).toBeLessThanOrEqual(PLAN_AHEAD + 1e-9);
        expect(bar.time - now).toBeGreaterThan(-1e-9);
      }
    }
  });

  it('fades stems in by intensity: patrol is pad and bass, a fight adds drums, the peak adds brass and lead', () => {
    const at = (enemies: number, hull = 1): BarPlan => {
      const { bars } = drive(spectacle, () => flight({ enemies, hull }), 90);
      return bars.at(-1)!;
    };
    const calm = at(0);
    expect(gain(calm, 'pad')).toBeGreaterThan(0.2);
    expect(gain(calm, 'kick')).toBe(0);
    expect(gain(calm, 'brass')).toBe(0);
    expect(gain(calm, 'lead')).toBe(0);
    const fight = at(4);
    expect(gain(fight, 'kick')).toBeGreaterThan(0);
    expect(gain(fight, 'lead')).toBe(0);
    const peak = at(8, 0.2);
    expect(gain(peak, 'brass')).toBeGreaterThan(0.3);
    expect(gain(peak, 'lead')).toBeGreaterThan(0.3);
    expect(gain(peak, 'heartbeat')).toBeGreaterThan(0);
    // Crossfades: the calm bass and arpeggio leave as the drive comes in.
    expect(gain(peak, 'bassCalm')).toBe(0);
    expect(gain(peak, 'bassDrive')).toBeGreaterThan(0.3);
    // A stem that is off schedules no notes.
    expect(calm.notes.filter((n) => n.stem === 'kick')).toHaveLength(0);
    expect(peak.notes.filter((n) => n.stem === 'lead').length).toBeGreaterThan(0);
  });

  it('a rescue brings the bells in whatever the intensity', () => {
    const { bars } = drive(spectacle, () => flight({ rescue: 0.5 }), 6);
    expect(gain(bars.at(-1)!, 'rescueBells')).toBeGreaterThan(0.3);
    const none = drive(spectacle, () => flight(), 6).bars.at(-1)!;
    expect(gain(none, 'rescueBells')).toBe(0);
  });

  it('a different scene takes over on a bar line, starting its new cue at bar 0', () => {
    let scene: MusicInput['scene'] = 'flight';
    const { bars } = drive(
      spectacle,
      () => flight({ scene }),
      20,
      (now) => {
        if (now > 6) scene = 'debrief';
      },
    );
    const first = bars.findIndex((b) => b.cue === 'debrief');
    expect(first).toBeGreaterThan(0);
    expect(bars[first]!.bar).toBe(0);
    expect(bars[first - 1]!.cue).toBe('battle');
    const len = barSeconds(spectacle.bpm);
    expect(bars[first]!.time - bars[first - 1]!.time).toBeCloseTo(len, 6);
  });

  it('a phrase cue finishes its loop before the scene changes', () => {
    let scene: MusicInput['scene'] = 'debrief';
    const { bars } = drive(
      spectacle,
      () => flight({ scene }),
      30,
      (now) => {
        if (now > 3.2) scene = 'flight';
      },
    );
    const switched = bars.findIndex((b) => b.cue === 'battle');
    expect(switched).toBeGreaterThan(0);
    // The debrief cue has 4 bars: the last debrief bar is bar 3.
    expect(bars[switched - 1]!.bar).toBe(3);
  });

  it('notes land inside the bar and the key is the key', () => {
    const { bars } = drive(spectacle, () => flight({ enemies: 8, hull: 0.2 }), 40);
    const len = barSeconds(spectacle.bpm);
    for (const b of bars) {
      for (const n of b.notes) {
        expect(n.at).toBeGreaterThanOrEqual(0);
        expect(n.at).toBeLessThan(len);
        if (n.kind === 'pitched') {
          expect(n.freq).toBeGreaterThan(20);
          expect(n.freq).toBeLessThan(12000);
        }
      }
    }
  });

  it('a live tempo edit applies from the next bar', () => {
    const edited: ScoreDef = { ...spectacle, bpm: spectacle.bpm };
    const { bars } = drive(
      edited,
      () => flight(),
      15,
      (now) => {
        (edited as { bpm: number }).bpm = now > 5 ? 140 : 124;
      },
    );
    const last = bars.at(-1)!;
    expect(last.seconds).toBeCloseTo(barSeconds(140), 6);
    expect(bars[0]!.seconds).toBeCloseTo(barSeconds(124), 6);
  });

  it('the panel can force a scene and an intensity', () => {
    const c = createConductor(() => spectacle);
    c.reset(0);
    c.setInput(flight());
    c.force({ scene: 'flight', intensity: 1 });
    let last: BarPlan | undefined;
    for (let now = 0; now < 4; now += 1 / 60) last = c.step(now, 1 / 60).bars.at(-1) ?? last;
    expect(c.status.intensity).toBe(1);
    expect(gain(last!, 'lead')).toBeGreaterThan(0.3);
    c.force(null);
    expect(c.status.forced).toBeNull();
  });
});

describe('stingers', () => {
  const event = (e: GameEvent) => e;

  it('start on the beat grid, after the audio clock', () => {
    const beat = barSeconds(spectacle.bpm) / 4;
    const { bars, stings } = drive(
      spectacle,
      () => flight(),
      12,
      (now, c) => {
        if (Math.abs(now - 5.013) < 1 / 120)
          c.onEvent(event({ type: 'BattleStarted', battle: 1 }), now);
      },
    );
    expect(stings).toHaveLength(1);
    expect(stings[0]!.key).toBe('battleStart');
    expect(stings[0]!.time).toBeGreaterThan(5.013);
    const offset = (stings[0]!.time - bars[0]!.time) / beat;
    expect(Math.abs(offset - Math.round(offset))).toBeLessThan(1e-6);
  });

  it('a higher priority in the same frame wins; a lower one during a higher one is dropped', () => {
    const { stings } = drive(
      spectacle,
      () => flight(),
      14,
      (now, c) => {
        if (Math.abs(now - 4) < 1 / 120) {
          c.onEvent(event({ type: 'BattleCleared', battle: 1 }), now);
          c.onEvent(event({ type: 'RunEnded', result: 'victory' }), now);
        }
        if (Math.abs(now - 5) < 1 / 120) c.onEvent(event({ type: 'PodSpawned', x: 0, y: 0 }), now);
      },
    );
    expect(stings.map((s) => s.key)).toEqual(['finale']); // victory replaced; beacon blocked while the finale plays
  });

  it('RunEnded picks its stinger by result, and WaveStarted 1 is not a stinger', () => {
    const lost = drive(
      spectacle,
      () => flight(),
      6,
      (now, c) => {
        if (Math.abs(now - 3) < 1 / 120)
          c.onEvent(event({ type: 'RunEnded', result: 'defeat' }), now);
      },
    );
    expect(lost.stings.map((s) => s.key)).toEqual(['defeat']);
    const wave = drive(
      spectacle,
      () => flight(),
      6,
      (now, c) => {
        if (Math.abs(now - 2) < 1 / 120)
          c.onEvent(event({ type: 'WaveStarted', battle: 1, wave: 1 }), now);
        if (Math.abs(now - 4) < 1 / 120)
          c.onEvent(event({ type: 'WaveStarted', battle: 1, wave: 2 }), now);
      },
    );
    expect(wave.stings.map((s) => s.key)).toEqual(['waveStart']);
  });

  it('a muting stinger silences the cue for its length, then the cue returns', () => {
    const { bars, stings } = drive(
      spectacle,
      () => flight({ enemies: 5 }),
      24,
      (now, c) => {
        if (Math.abs(now - 6) < 1 / 120) c.onEvent(event({ type: 'PilotLost', pilotId: 1 }), now);
      },
    );
    const sting = stings.find((s) => s.key === 'pilotLost')!;
    expect(sting).toBeDefined();
    const len =
      (spectacle.stingers['pilotLost']!.steps * barSeconds(spectacle.bpm)) / STEPS_PER_BAR;
    // Bars already planned (up to PLAN_AHEAD before they start) cannot be recalled; later ones are cut.
    for (const b of bars) {
      for (const n of b.notes) {
        const t = b.time + n.at;
        if (b.time < 6 + PLAN_AHEAD) continue; // planned before the call: the backend mutes those
        expect(t < sting.time || t >= sting.time + len - 1e-9).toBe(true);
      }
    }
    const after = bars.filter((b) => b.time > sting.time + len + 0.1);
    expect(after.some((b) => b.notes.length > 0)).toBe(true);
  });

  it('the first enemies of a fight call the threat sting (once in a while, not every frame)', () => {
    let enemies = 0;
    const { stings } = drive(
      spectacle,
      () => flight({ enemies }),
      40,
      (now) => {
        enemies = now > 4 ? 3 : 0;
        if (now > 20 && now < 22) enemies = 0;
        if (now > 22) enemies = 3; // again, but within the cooldown of 12 s? 22 - 4 > 12, allowed
      },
    );
    expect(stings.filter((s) => s.key === 'threat').length).toBe(2);
  });

  it('hits and kills add heat that decays', () => {
    const { c } = drive(
      spectacle,
      () => flight(),
      1.5,
      (now, cc) => {
        if (Math.abs(now - 1) < 1 / 120) {
          cc.onEvent(event({ type: 'PlayerDamaged', x: 0, y: 0, hull: 3 }), now);
          cc.onEvent(
            event({ type: 'Killed', entityId: 1, kind: 'fighter', x: 0, y: 0, radius: 20 }),
            now,
          );
        }
      },
    );
    expect(c.status.heat).toBeGreaterThan(0);
    expect(c.status.heat).toBeLessThan(
      spectacle.intensity.heatPerHit + spectacle.intensity.heatPerKill,
    );
  });
});

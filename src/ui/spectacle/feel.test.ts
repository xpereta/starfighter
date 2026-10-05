import { describe, expect, it } from 'vitest';
import { presentation as def } from '../../../data/styles/anime-spectacle/presentation';
import type { GameEvent } from '../../core/events/events';
import { createFeel, feedFeel, feelOutput, observeTurn, rollFill, stepFeel } from './feel';
import { PRESETS } from './settings';

const full = PRESETS.full;
const kill = (kind: 'drone' | 'fighter' | 'turret'): GameEvent => ({
  type: 'Killed',
  entityId: 1,
  kind,
  x: 0,
  y: 0,
  radius: 10,
});
const salvo: GameEvent = { type: 'SalvoFired', count: 3 };

describe('zoom punch and shake', () => {
  it('bigger kills punch harder, and the punch decays', () => {
    const a = createFeel();
    const b = createFeel();
    feedFeel(a, [kill('drone')], def, full);
    feedFeel(b, [kill('turret')], def, full);
    expect(b.punch).toBeGreaterThan(a.punch);
    expect(b.shake).toBeGreaterThan(a.shake);
    const before = b.punch;
    stepFeel(b, 0.5, def, full, null);
    expect(b.punch).toBeLessThan(before * 0.2);
  });

  it('the zoom setting scales the zoom and 0 turns it off', () => {
    const s = createFeel();
    feedFeel(s, [kill('fighter')], def, full);
    const one = feelOutput(s, def, full, 0, 16 / 9).scale;
    const off = feelOutput(s, def, { ...full, zoomPunch: 0 }, 0, 16 / 9).scale;
    expect(one).toBeGreaterThan(off);
    expect(off).toBe(1);
  });

  it('shake offsets are zero at rest and when the shake setting is 0', () => {
    const s = createFeel();
    expect(feelOutput(s, def, full, 1, 1.6).shakeX).toBe(0);
    feedFeel(s, [{ type: 'PlayerDamaged', x: 0, y: 0, hull: 3 }], def, full);
    const o = feelOutput(s, def, { ...full, shake: 0 }, 1, 1.6);
    expect(o.shakeX).toBe(0);
    expect(o.shakeY).toBe(0);
  });
});

describe('hit-stop', () => {
  it('freezes the picture briefly, scaled and capped, and thaws', () => {
    const s = createFeel();
    feedFeel(s, [kill('turret')], def, { ...full, hitStop: 1.5 });
    expect(s.freeze).toBeGreaterThan(0);
    expect(s.freeze).toBeLessThanOrEqual(def.feel.maxFreeze);
    expect(feelOutput(s, def, full, 0, 1.6).frozen).toBe(true);
    stepFeel(s, 0.5, def, full, null);
    expect(feelOutput(s, def, full, 0, 1.6).frozen).toBe(false);
  });

  it('never freezes when the hit-stop setting is 0', () => {
    const s = createFeel();
    feedFeel(s, [kill('turret')], def, { ...full, hitStop: 0 });
    expect(s.freeze).toBe(0);
  });
});

describe('kill-cam', () => {
  const kills = (n: number): GameEvent[] => Array.from({ length: n }, () => kill('drone'));

  it('a salvo that kills enough enemies freezes the frame with a speed-line flash', () => {
    const s = createFeel();
    feedFeel(s, [salvo], def, full);
    feedFeel(s, kills(def.feel.killCam.kills), def, full);
    expect(s.killCam).toBeGreaterThan(0);
    const o = feelOutput(s, def, full, 0, 1.6);
    expect(o.frozen).toBe(true);
    expect(o.killCam).toBe(1);
    expect(o.speedFlash).toBe(1);
    expect(o.flash).toBeGreaterThan(0.5);
  });

  it('needs a salvo first: gun kills do not trigger it', () => {
    const s = createFeel();
    feedFeel(s, kills(6), def, full);
    expect(s.killCam).toBe(0);
  });

  it('does not trigger below the kill count, or when the setting is 0', () => {
    const a = createFeel();
    feedFeel(a, [salvo], def, full);
    feedFeel(a, kills(def.feel.killCam.kills - 1), def, full);
    expect(a.killCam).toBe(0);
    const b = createFeel();
    feedFeel(b, [salvo], def, { ...full, killCam: 0 });
    feedFeel(b, kills(5), def, { ...full, killCam: 0 });
    expect(b.killCam).toBe(0);
  });

  it('waits for its cooldown before it can trigger again', () => {
    const s = createFeel();
    feedFeel(s, [salvo, ...kills(3)], def, full);
    stepFeel(s, def.feel.killCam.freeze + 0.01, def, full, null);
    expect(s.killCam).toBe(0);
    feedFeel(s, [salvo, ...kills(3)], def, full);
    expect(s.killCam).toBe(0);
    stepFeel(s, def.feel.killCam.cooldown, def, full, null);
    feedFeel(s, [salvo, ...kills(3)], def, full);
    expect(s.killCam).toBeGreaterThan(0);
  });

  it('kills spread over longer than the window do not count together', () => {
    const s = createFeel();
    feedFeel(s, [salvo, kill('drone')], def, full);
    stepFeel(s, def.feel.killCam.window + 0.2, def, full, null);
    feedFeel(s, kills(def.feel.killCam.kills - 1), def, full);
    expect(s.killCam).toBe(0);
  });
});

describe('roll', () => {
  it('banks with the turn direction, scaled, and is level when the setting is 0', () => {
    const left = createFeel();
    const right = createFeel();
    for (let i = 0; i < 30; i++) {
      observeTurn(left, i * 0.05, 1 / 60, def);
      observeTurn(right, -i * 0.05, 1 / 60, def);
      stepFeel(left, 1 / 60, def, full, null);
      stepFeel(right, 1 / 60, def, full, null);
    }
    expect(left.roll).toBeGreaterThan(0);
    expect(right.roll).toBeLessThan(0);
    expect(Math.abs(left.roll)).toBeLessThanOrEqual((def.feel.maxRollDeg * Math.PI) / 180 + 1e-9);
    const flat = createFeel();
    for (let i = 0; i < 30; i++) {
      observeTurn(flat, i * 0.05, 1 / 60, def);
      stepFeel(flat, 1 / 60, def, { ...full, roll: 0 }, null);
    }
    expect(flat.roll).toBe(0);
  });

  it('a heading wrap across pi is not a spin', () => {
    const s = createFeel();
    observeTurn(s, Math.PI - 0.01, 1 / 60, def);
    observeTurn(s, -Math.PI + 0.01, 1 / 60, def);
    expect(Math.abs(s.turnRate)).toBeLessThan(def.feel.turnRateFull * 1.5 + 1e-9);
  });

  it('the fill zoom covers the screen corners while rolled', () => {
    expect(rollFill(0, 16 / 9)).toBeCloseTo(1);
    const a = 2.2 * (Math.PI / 180);
    expect(rollFill(a, 16 / 9)).toBeGreaterThan(1);
    expect(rollFill(a, 16 / 9)).toBe(rollFill(-a, 16 / 9));
  });
});

describe('tension vignette', () => {
  it('is off at healthy hull, grows as the hull drops and pulses', () => {
    const s = createFeel();
    for (let i = 0; i < 120; i++) stepFeel(s, 1 / 60, def, full, 1);
    expect(s.tension).toBe(0);
    for (let i = 0; i < 240; i++) stepFeel(s, 1 / 60, def, full, 0.2);
    const low = s.tension;
    expect(low).toBeGreaterThan(0.5);
    for (let i = 0; i < 240; i++) stepFeel(s, 1 / 60, def, full, 0.0);
    expect(s.tension).toBeGreaterThan(low);
    const a = feelOutput(s, def, full, 0, 1.6).vignette;
    s.pulse += 1.2;
    const b = feelOutput(s, def, full, 0, 1.6).vignette;
    expect(a).not.toBe(b);
  });

  it('is off with no hull (practice) and when the setting is 0', () => {
    const s = createFeel();
    for (let i = 0; i < 120; i++) stepFeel(s, 1 / 60, def, full, null);
    expect(feelOutput(s, def, full, 0, 1.6).vignette).toBe(0);
    for (let i = 0; i < 240; i++) stepFeel(s, 1 / 60, def, full, 0.1);
    expect(feelOutput(s, def, { ...full, vignette: 0 }, 0, 1.6).vignette).toBe(0);
  });
});

describe('calm preset', () => {
  it('produces almost no motion from the same events', () => {
    const calm = PRESETS.calm;
    const s = createFeel();
    feedFeel(s, [salvo, kill('turret'), kill('fighter'), kill('drone')], def, calm);
    const o = feelOutput(s, def, calm, 0.3, 1.6);
    expect(o.frozen).toBe(false);
    expect(o.scale).toBeLessThan(1.012);
    expect(o.speedFlash).toBe(0);
    expect(Math.abs(o.roll)).toBe(0);
  });
});

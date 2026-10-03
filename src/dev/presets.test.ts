import { describe, expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import {
  applyPreset,
  diffFromDefaults,
  formatDefaultsPatch,
  parsePreset,
  serializePreset,
} from './presets';

describe('presets', () => {
  it('round-trips every tuned value, including toggles', () => {
    const tuning = createTuning();
    tuning.flight.maxTurnRate = 250;
    tuning.flight.steering = 'rotate';
    tuning.camera.lookMode = 'nose';
    tuning.camera.shakeEnabled = true;
    tuning.weapons.fireRate = 20;
    const preset = parsePreset(serializePreset(tuning, 'mine'));
    expect(preset.name).toBe('mine');
    const fresh = createTuning();
    applyPreset(fresh, preset);
    expect(fresh).toEqual(tuning);
  });

  it('applies in place so the world sees the change', () => {
    const tuning = createTuning();
    const flight = tuning.flight;
    applyPreset(
      tuning,
      parsePreset(
        JSON.stringify({
          format: 'starfighter-tuning',
          version: 1,
          name: 'p',
          values: { flight: { grip: 12 } },
        }),
      ),
    );
    expect(tuning.flight).toBe(flight);
    expect(flight.grip).toBe(12);
    expect(flight.accel).toBe(createTuning().flight.accel); // partial presets leave the rest alone
  });

  const wrap = (values: unknown, over: object = {}) =>
    JSON.stringify({ format: 'starfighter-tuning', version: 1, name: 'x', values, ...over });

  it('rejects bad files loudly', () => {
    expect(() => parsePreset('nope')).toThrow(/JSON/);
    expect(() => parsePreset('{"a":1}')).toThrow(/preset/);
    expect(() => parsePreset(wrap({}, { version: 99 }))).toThrow(/version/);
    expect(() => parsePreset(wrap({ nothere: {} }))).toThrow(/Unknown group/);
    expect(() => parsePreset(wrap({ flight: { warp: 1 } }))).toThrow(/Unknown parameter/);
    expect(() => parsePreset(wrap({ flight: { grip: 9999 } }))).toThrow(/outside/);
    expect(() => parsePreset(wrap({ flight: { grip: 'fast' } }))).toThrow(/number/);
    expect(() => parsePreset(wrap({ flight: { steering: 'sideways' } }))).toThrow(/one of/);
    expect(() => parsePreset(wrap({ camera: { shakeEnabled: 'yes' } }))).toThrow(/one of/);
  });

  it('diff lists only values that changed, and the patch text names them', () => {
    const defaults = createTuning();
    const tuning = createTuning();
    expect(diffFromDefaults(tuning, defaults)).toEqual([]);
    expect(formatDefaultsPatch([])).toMatch(/No changes/);
    const grip = defaults.flight.grip;
    const otherLook = defaults.camera.lookMode === 'nose' ? 'velocity' : 'nose';
    tuning.flight.grip = grip + 3;
    tuning.camera.lookMode = otherLook;
    const changes = diffFromDefaults(tuning, defaults);
    expect(changes).toEqual([
      { path: 'flight.grip', from: grip, to: grip + 3 },
      { path: 'camera.lookMode', from: defaults.camera.lookMode, to: otherLook },
    ]);
    const patch = formatDefaultsPatch(changes);
    expect(patch).toContain(`flight.grip: ${grip} -> ${grip + 3}`);
    expect(patch).toContain(`camera.lookMode: ${defaults.camera.lookMode} -> ${otherLook}`);
  });
});

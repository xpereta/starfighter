import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyPreset,
  INTENSITY_KEYS,
  initSettings,
  matchingPreset,
  MAX_INTENSITY,
  PRESET_NAMES,
  PRESETS,
  sanitize,
  spectacle,
} from './settings';

describe('presets', () => {
  it('every preset keeps intensities in range', () => {
    for (const name of PRESET_NAMES)
      for (const k of INTENSITY_KEYS) {
        expect(PRESETS[name][k]).toBeGreaterThanOrEqual(0);
        expect(PRESETS[name][k]).toBeLessThanOrEqual(MAX_INTENSITY);
      }
  });

  it('calm keeps the interface and drops the motion', () => {
    const c = PRESETS.calm;
    expect(c.enabled && c.hud && c.menus && c.comms && c.banners).toBe(true);
    expect(c.roll).toBe(0);
    expect(c.hitStop).toBe(0);
    expect(c.killCam).toBe(0);
    expect(c.speedFlash).toBe(0);
    expect(c.zoomPunch).toBeLessThan(0.3);
  });

  it('off disables the master switch and every layer', () => {
    expect(PRESETS.off.enabled).toBe(false);
    expect(PRESETS.off.hud).toBe(false);
  });

  it('names the preset a set of settings equals, custom otherwise', () => {
    expect(matchingPreset(PRESETS.calm)).toBe('calm');
    expect(matchingPreset({ ...PRESETS.full, shake: 0.4 })).toBe('custom');
  });
});

describe('sanitize', () => {
  it('clamps intensities and ignores wrong types', () => {
    const s = sanitize(
      { roll: 99, shake: -3, hud: 'yes' as unknown as boolean, zoomPunch: NaN },
      PRESETS.full,
    );
    expect(s.roll).toBe(MAX_INTENSITY);
    expect(s.shake).toBe(0);
    expect(s.hud).toBe(true);
    expect(s.zoomPunch).toBe(1);
  });
});

describe('initSettings', () => {
  beforeEach(() => applyPreset('full'));

  it('the URL preset wins over stored settings and the pack preset', () => {
    initSettings('?spectacle=calm', 'full', JSON.stringify({ roll: 1.2 }));
    expect(matchingPreset(spectacle)).toBe('calm');
  });

  it('stored settings apply on top of the pack preset', () => {
    initSettings('', 'full', JSON.stringify({ roll: 0.5, comms: false }));
    expect(spectacle.roll).toBe(0.5);
    expect(spectacle.comms).toBe(false);
    expect(spectacle.hud).toBe(true);
  });

  it('unreadable stored settings fall back to the pack preset', () => {
    initSettings('', 'calm', '{not json');
    expect(matchingPreset(spectacle)).toBe('calm');
  });
});

import { describe, expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { WING_CUE } from '../../data/content/cues';
import { spawnWing } from '../core/ai/wings';
import { createWorld } from '../core/world/world';
import { cueText } from './cues';

describe('the battle HUD cue', () => {
  it('is empty on a quiet field and says WING INBOUND when a wing arrives', () => {
    const world = createWorld(1, createTuning());
    expect(cueText(world)).toBeNull();
    spawnWing(world, 3000, 0, Math.PI);
    expect(cueText(world)).toBe(WING_CUE);
    expect(WING_CUE).toBe('WING INBOUND');
  });
});

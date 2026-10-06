import { noise, sfx, tone } from '../../audio/recipes';
import type { SoundTable } from '../../../src/render/style';

/**
 * Only the guns are new: the rest of the sound (impacts, explosions, loops, radio, menus) comes from
 * the parent, `realistic`. Blaster bolts are a short falling zap: a bright sweep from the top down
 * to the body of the note, a grittier square layer and a puff of noise at the start. The player's
 * bolt is the highest and cleanest; the enemy's is lower, buzzier and further off.
 */
const AROUND = {
  pan: 0.8,
  range: 1100,
  farVolume: 0.35,
  lowpass: { near: 14000, far: 1000 },
  farReverb: 0.3,
  lag: 0.15,
} as const;

export const sounds: Partial<SoundTable> = {
  ShotFired: sfx(
    [
      tone('sawtooth', 2600, 380, 0.13, 0.5, { attack: 0.001, distortion: 0.2 }),
      tone('square', 1300, 210, 0.1, 0.25, { attack: 0.001 }),
      tone('sine', 160, 60, 0.12, 0.5, { attack: 0.002 }),
      noise('highpass', 6000, 3000, 0.03, 0.35, { attack: 0.001 }),
    ],
    { volume: 0.16, pitchRandom: 0.08, minGap: 0.075, maxVoices: 3, reverb: 0.12, preDelay: 0.02 },
  ),
  WingmanShotFired: sfx(
    [
      tone('sawtooth', 2200, 420, 0.1, 0.4, { attack: 0.001, distortion: 0.15 }),
      noise('highpass', 6000, 3500, 0.025, 0.25, { attack: 0.001 }),
    ],
    {
      volume: 0.08,
      pitchRandom: 0.12,
      minGap: 0.11,
      maxVoices: 2,
      spatial: AROUND,
      reverb: 0.14,
      preDelay: 0.02,
    },
  ),
  EnemyShotFired: sfx(
    [
      tone('sawtooth', 1500, 170, 0.17, 0.5, { attack: 0.001, distortion: 0.35 }),
      tone('square', 750, 110, 0.14, 0.25, { attack: 0.001 }),
      tone('sine', 110, 45, 0.16, 0.5, { attack: 0.002 }),
      noise('bandpass', 3000, 1200, 0.04, 0.3, { attack: 0.001 }),
    ],
    {
      volume: 0.14,
      pitchRandom: 0.1,
      minGap: 0.14,
      maxVoices: 3,
      spatial: AROUND,
      reverb: 0.2,
      preDelay: 0.025,
    },
  ),
};

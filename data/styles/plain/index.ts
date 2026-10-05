import type { StyleInput } from '../../../src/render/style';
import { deaths } from './deaths';
import { explosions } from './explosions';
import { ships } from './ships';
import { loops, music, sounds } from './sounds';
import { manifest } from './style';
import { theme } from './theme';

export const plain: StyleInput = {
  manifest,
  theme,
  ships,
  deaths,
  explosions,
  sounds,
  loops,
  music,
};

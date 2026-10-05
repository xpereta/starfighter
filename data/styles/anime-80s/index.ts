import type { StyleInput } from '../../../src/render/style';
import { deaths } from './deaths';
import { explosions } from './explosions';
import { ships } from './ships';
import { music, sounds } from './sounds';
import { manifest } from './style';
import { theme } from './theme';

export const anime80s: StyleInput = { manifest, theme, ships, deaths, explosions, sounds, music };

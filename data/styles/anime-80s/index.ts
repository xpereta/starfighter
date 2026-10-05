import type { StyleInput } from '../../../src/render/style';
import { deaths } from './deaths';
import { explosions } from './explosions';
import { ships } from './ships';
import { manifest } from './style';
import { theme } from './theme';

/** Sounds are added by their own file when the sound track writes it; until then they fall back to plain. */
export const anime80s: StyleInput = { manifest, theme, ships, deaths, explosions };

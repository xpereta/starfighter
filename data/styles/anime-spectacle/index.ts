import type { StyleInput } from '../../../src/render/style';
import { spectacle } from './spectacle';
import { manifest } from './style';
import { theme } from './theme';

/** Parent `anime-80s` supplies ships, deaths, explosions and sounds; this pack adds the spectacle. */
export const animeSpectacle: StyleInput = { manifest, theme, spectacle };

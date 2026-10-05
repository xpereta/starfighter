import type { StyleInput } from '../../../src/render/style';
import { ships } from './ships';
import { manifest } from './style';
import { theme } from './theme';

/** Deaths, explosions and sounds are added by their own files as they are written; until then they fall back to plain. */
export const anime80s: StyleInput = { manifest, theme, ships };

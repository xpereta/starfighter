import type { StyleInput } from '../../../src/render/style';
import { deaths } from './deaths';
import { explosions } from './explosions';
import { ships } from './ships';
import { sounds } from './sounds';
import { manifest } from './style';
import { theme } from './theme';

/** Looks are its own; sounds are the parent's (`realistic`) with the three guns replaced. */
export const usedFuture: StyleInput = { manifest, theme, ships, deaths, explosions, sounds };

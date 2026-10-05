import type { StyleInput } from '../../../src/render/style';
import { loops, sounds } from './sounds';
import { manifest } from './style';

/** Sounds and loops only; theme, ships, deaths and explosions come from the parent (`plain`). No music: the quiet bed is a loop. */
export const realistic: StyleInput = { manifest, sounds, loops, music: null };

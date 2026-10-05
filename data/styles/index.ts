import type { StyleRegistry } from '../../src/render/style';
import { anime80s } from './anime-80s';
import { animeSpectacle } from './anime-spectacle';
import { plain } from './plain';
import { realistic } from './realistic';

/** Registry of style packs: one line per pack (the key is the pack's folder name and its id). */
export const styles: StyleRegistry = {
  plain,
  'anime-80s': anime80s,
  'anime-spectacle': animeSpectacle,
  realistic,
};

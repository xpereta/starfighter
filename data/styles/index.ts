import type { StyleRegistry } from '../../src/render/style';
import { plain } from './plain';

/** Registry of style packs: one line per pack (the key is the pack's folder name and its id). */
export const styles: StyleRegistry = {
  plain,
};

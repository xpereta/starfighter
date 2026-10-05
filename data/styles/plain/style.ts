import type { StyleManifest } from '../../../src/render/style';

/** The safe baseline and the fallback for every other style: today's flat look, no sound. */
export const manifest: StyleManifest = {
  id: 'plain',
  name: 'Plain',
  intent:
    'Flat placeholder shapes on a dark background, silent. The baseline every style falls back to.',
  parent: null,
  references: [],
  status: 'active',
  notes: 'Reproduces the look before Prototype 4. Kept forever; never remove or restyle it.',
};

import type { StyleManifest } from '../../../src/render/style';

/** 80s/90s anime space fighters: cel look, bold ink outlines, one hard shadow tone, engine glow. */
export const manifest: StyleManifest = {
  id: 'anime-80s',
  name: 'Anime 80s',
  intent:
    'Cel-shaded 80s/90s anime dogfight: bold ink outlines, one hard shadow tone, glowing engines, clean nose-forward heroes against angular one-eyed enemies.',
  parent: 'plain',
  references: [
    {
      title:
        'Macross / Robotech (VF-1 Valkyrie fighters, Ikuto Yamashita and Shoji Kawamori designs)',
      took: 'The hero silhouette: slim nose-forward fuselage, swept wings, twin tails, white body with one accent; the missile-swarm "Itano circus" trails (next to the lock-on salvo).',
    },
    {
      title: 'Mobile Suit Gundam (0079, Zeta)',
      took: 'Hard-edged cel shadows (one tone, no gradients), the angular asymmetric Zeon look with a single mono-eye sensor for the enemies, beam-and-ring explosions.',
    },
    {
      title: 'Bubblegum Crisis',
      took: 'Neon accents on dark navy, thick confident ink outlines, glow only where light is emitted (engines, eyes).',
    },
    {
      title: 'Space Battleship Yamato',
      took: 'Heavy, slow big-ship feel for turrets and later capital ships: long chains of secondary explosions and a final blast.',
    },
    {
      title: 'Gunbuster (Top wo Nerae!)',
      took: 'Speed lines and flash frames on big blasts, high-contrast black-and-white screen moments.',
    },
    {
      title: 'Akira and Patlabor-era explosions',
      took: 'Explosions as hand-drawn layered shapes: spherical expanding bursts, hard-edged smoke puffs, shockwave rings, debris that drifts and bursts again.',
    },
  ],
  status: 'idea',
  notes:
    'First pass. Palette, silhouettes and the explosion vocabulary are starting points for Xavi to edit; see docs/art-direction.md. Sounds fall back to plain until the sound track adds sounds.ts.',
};

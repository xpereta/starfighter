import type { StyleManifest } from '../../../src/render/style';

/** The anime look with the lights on: glow, living skies, ships with presence, bigger explosions. */
export const manifest: StyleManifest = {
  id: 'anime-spectacle',
  name: 'Anime Spectacle',
  intent:
    'The anime-80s dogfight turned up to a movie-poster finale: glowing emissives, a living backdrop that changes every battle, engine plumes and missile spirals, multi-stage anime explosions and title cards.',
  parent: 'anime-80s',
  references: [
    {
      title: 'Macross: Do You Remember Love? (1984) and Macross Plus (1994)',
      took: 'Missile swarms with spiralling exhaust trails, long engine plumes, launch flashes and the "circus" of crossing smoke lines.',
    },
    {
      title: 'Space Battleship Yamato (1974) and Arrivederci Yamato (1978)',
      took: 'Capital-scale destruction: long chains of secondary blasts and a final burst, big structures looming in the far distance.',
    },
    {
      title: 'Gunbuster (1988)',
      took: 'Flash frames, zoom punches on big kills, stark title cards.',
    },
    {
      title: 'Akira (1988) and Patlabor 2 (1993)',
      took: 'Multi-stage hand-drawn explosions: flash frame, shock ring, fireball, ink-blot smoke, glinting debris.',
    },
    {
      title: 'Bubblegum Crisis (1987) and Megazone 23 (1985)',
      took: 'Neon glow on dark navy, a touch of film grain, scanline and colour fringe like a laser-disc master.',
    },
  ],
  status: 'idea',
  notes:
    'A style pack of its own: parent anime-80s (ships, deaths, explosions, sounds), everything new is render-only (the spectacle section of the contract). Quality: ?fx=low|medium|high. See src/render/spectacle/README.md.',
};

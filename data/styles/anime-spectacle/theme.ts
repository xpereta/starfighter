import type { ThemeInput } from '../../../src/render/style';

/**
 * Same palette family as anime-80s; a little more glow and speed lines, brighter lights so the
 * bloom has something to catch. Colours flat as ever: the glow comes from the post pass.
 */
export const theme: ThemeInput = {
  palette: {
    background: 0x050818,
    projectile: 0xfff08a,
    enemyShot: 0xff7fb0,
    star: 0xc4d2ff,
  },
  glow: 1,
  speedLines: 0, // the radial lines at high speed were removed (Xavi: distracting); raise to bring them back
};

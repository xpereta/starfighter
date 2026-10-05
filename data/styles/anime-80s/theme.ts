import type { ThemeInput } from '../../../src/render/style';

/**
 * Deep indigo space, cel-white heroes with cyan wingmen, hot red-pink enemies, neon yellow for
 * everything that shoots. The ink outline is a mid blue (contrast audit: a navy one vanished on the indigo sky) that gives every ship a readable rim.
 */
export const theme: ThemeInput = {
  palette: {
    background: 0x070a1c,
    friendly: 0xf2f6ff,
    enemy: 0xff4d6d,
    enemyStatic: 0xff9a3c,
    turret: 0xb06cff,
    projectile: 0xffe45e,
    enemyShot: 0xff6fa0,
    fighter: 0xff3a60,
    wingman: 0x57d6ff,
    missile: 0xffffff,
    lockRing: 0xffd23f,
    pod: 0x7cf0c8,
    star: 0xaabbe6,
    dust: 0xdfe8ff,
  },
  outlineWidth: 2,
  outlineColor: 0x4f6fd8,
  shadowShare: 0.45,
  glow: 0.8,
  eyeColor: 0xfff4b0,
  speedLines: 0.5,
};

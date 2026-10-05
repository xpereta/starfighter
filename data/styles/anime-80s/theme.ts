import type { ThemeInput } from '../../../src/render/style';

/**
 * Deep indigo space, cel-white heroes with cyan wingmen, hot red-pink enemies, neon yellow for
 * everything that shoots. The ink outline is a navy that reads on the fill and on the background.
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
    fighter: 0xe8264f,
    wingman: 0x57d6ff,
    missile: 0xffffff,
    lockRing: 0xffd23f,
    pod: 0x7cf0c8,
    star: 0xaabbe6,
    dust: 0xdfe8ff,
  },
  outlineWidth: 2,
  outlineColor: 0x22367a,
  shadowShare: 0.45,
  glow: 0.8,
  eyeColor: 0xfff4b0,
};

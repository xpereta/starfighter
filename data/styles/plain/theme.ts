import type { Theme } from '../../../src/render/style';

/** Limited flat palette: color codes faction and threat so it reads at any zoom. */
export const theme: Theme = {
  palette: {
    background: 0x05060d,
    friendly: 0x4ee1ff,
    enemy: 0xff5a5f,
    enemyStatic: 0xff9f45,
    turret: 0xc084fc,
    projectile: 0xfff27a,
    enemyShot: 0xff8fb0,
    fighter: 0xff3b6b,
    wingman: 0x7dffb0,
    missile: 0xffffff,
    lockRing: 0xffd24a,
    pod: 0x9ad8ff,
    star: 0x9fb4d9,
    dust: 0xcfe0ff,
  },
  // Reserved for the Look track; plain has no outline, shadow or glow.
  outlineWidth: 0,
  outlineColor: 0x000000,
  shadowShare: 0,
  glow: 0,
};

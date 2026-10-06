import type { ThemeInput } from '../../../src/render/style';

/**
 * Used future: weathered hulls on a dim, dirty sky. Named palettes (one colour per role, the game
 * uses a flat colour per faction):
 *
 *  - Rebel Grey (friendly): player `#d6d8d0` worn white, wingmen `#aebfcc` pale blue-grey. Red-orange
 *    markings and sodium cockpit light come from the part colours in ships.ts.
 *  - Imperial Steel (enemy craft): fighter and lancer `#7e92a8` cold steel, gunship and capital
 *    `#7a8a99` a shade darker; drone `#b98a5a` rust and brass; turret `#8fa08a` gunmetal green; static
 *    dummy `#d6a43a` hazard amber; capital parts follow the hull.
 *  - Blaster Fire (shots): player bolts `#ff4a3a` red, enemy bolts `#6dff5a` green, missiles `#ffb347`
 *    sodium orange. Lock ring `#ffc94a` amber.
 *  - Deep Sky (space): background `#04060c`, stars `#b8c4d8`, a grey-blue planet and a sodium glare.
 *
 * Outline: a thin soot line (the hulls are all mid to light, so the dark edge cuts them out of the
 * sky; the pale rim lights on the leading edges give the dark parts their edge back). Shading: one
 * hard shadow over about 60 percent of the dark side, an Aliens-style hard light from the planet.
 */
export const theme: ThemeInput = {
  palette: {
    background: 0x04060c,
    friendly: 0xe4e5dc,
    enemy: 0xd8aa74,
    enemyStatic: 0xe8b84a,
    turret: 0xaabda3,
    projectile: 0xff4a3a,
    enemyShot: 0x6dff5a,
    fighter: 0xb0c2d4,
    wingman: 0xc4d2de,
    missile: 0xffb347,
    lockRing: 0xffc94a,
    pod: 0xcfeee6,
    star: 0xb8c4d8,
    dust: 0xdfe4ee,
  },
  outlineWidth: 1.6,
  outlineColor: 0x0a0d12,
  shadowShare: 0.5,
  glow: 0.85,
  eyeColor: 0xffb347,
  speedLines: 0.25,
  partColors: {
    panelTone: 0.78,
    darkTone: 0.3,
    accent: 0xd9452a,
    glass: 0x182636,
    glow: 0xffb347,
  },
  backdrop: {
    glows: [
      // Atmosphere haze around the planet, then the planet itself, lit from the upper right.
      {
        x: -0.88,
        y: -0.82,
        radius: 0.62,
        color: 0x2f4a66,
        strength: 0.12,
        hardness: 0,
        shade: 0,
        lightAngle: 0,
        drift: 0.01,
      },
      {
        x: -0.88,
        y: -0.82,
        radius: 0.46,
        color: 0x1e2a38,
        strength: 0.9,
        hardness: 0.97,
        shade: 0.9,
        lightAngle: 40,
        drift: 0.01,
      },
      // The sodium glare of a far sun or burning wreck, upper right.
      {
        x: 0.85,
        y: 0.75,
        radius: 0.6,
        color: 0xff7a2e,
        strength: 0.06,
        hardness: 0,
        shade: 0,
        lightAngle: 0,
        drift: 0.004,
      },
      // Teal fog drifting across the middle.
      {
        x: -0.1,
        y: 0.25,
        radius: 0.9,
        color: 0x1f4a5a,
        strength: 0.05,
        hardness: 0,
        shade: 0,
        lightAngle: 0,
        drift: 0.02,
      },
    ],
    grain: { count: 650, size: 1, color: 0x9aa6b8, opacity: 0.16 },
  },
};

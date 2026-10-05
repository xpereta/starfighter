import type { PresentationDef } from '../../../src/ui/spectacle/presentation';

/**
 * The presentation of the `anime-spectacle` style: angled neon panels, bold type, comm windows with
 * visor portraits, title cards, and a camera that punches, rolls and freezes on big moments. Every
 * number here is a starting point; all of it is render and UI only (nothing reaches `src/core`).
 */
export const presentation: PresentationDef = {
  enabled: true,
  preset: 'full',
  colors: {
    accent: '#4ee1ff',
    hot: '#ff3d6e',
    gold: '#ffd23f',
    mint: '#7cf0c8',
    ink: '#070a1c',
    panel: 'rgba(8, 12, 38, 0.78)',
    text: '#f2f6ff',
    dim: '#8fa3d6',
  },
  feel: {
    impacts: {
      drone: { punch: 0.12, shake: 0.12, freeze: 0.025 },
      fighter: { punch: 0.3, shake: 0.32, freeze: 0.06 },
      turret: { punch: 0.45, shake: 0.45, freeze: 0.09 },
      static: { punch: 0.04, shake: 0.05, freeze: 0 },
      wingman: { punch: 0.4, shake: 0.5, freeze: 0.1 },
      salvo: { punch: 0.3, shake: 0.22, freeze: 0 },
      missileImpact: { punch: 0.1, shake: 0.14, freeze: 0 },
      hit: { punch: 0, shake: 0.05, freeze: 0 },
      damage: { punch: 0.25, shake: 0.65, freeze: 0.06 },
      rescue: { punch: 0.3, shake: 0.1, freeze: 0 },
      cleared: { punch: 0.55, shake: 0.2, freeze: 0.12 },
      lost: { punch: 0.5, shake: 0.5, freeze: 0.12 },
    },
    maxZoom: 0.07,
    punchDecay: 7,
    shakeDecay: 6,
    maxShakePx: 16,
    maxRollDeg: 2.2,
    turnRateFull: 2.6,
    rollSmooth: 5,
    maxFreeze: 0.12,
    killCam: { kills: 3, window: 1.4, salvoWindow: 5, freeze: 0.3, cooldown: 4 },
    vignette: { from: 0.6, pulseHz: 1.3 },
  },
  combo: {
    window: 3,
    step: 4,
    maxMultiplier: 5,
    tiers: [
      { at: 3, label: 'NICE' },
      { at: 6, label: 'GREAT' },
      { at: 10, label: 'BRILLIANT' },
      { at: 15, label: 'ACE' },
      { at: 25, label: 'LEGEND' },
    ],
  },
  points: { static: 50, drone: 100, turret: 300, fighter: 250, wingman: 0 },
  killLabels: {
    static: 'TARGET',
    drone: 'DRONE',
    turret: 'TURRET',
    fighter: 'FIGHTER',
    wingman: 'WINGMAN',
  },
  portraits: {
    helmets: [0xf2f6ff, 0xdfe8ff, 0xffd9e2, 0xd9fff1, 0xfff0c2, 0xd6d2ff, 0xc7e6ff, 0xffd8b8],
    visors: [0x4ee1ff, 0xffd23f, 0xff6fa0, 0x7cf0c8, 0xb06cff, 0xff9a3c, 0x57d6ff, 0xe8264f],
    accents: [0xe8264f, 0x22367a, 0x57d6ff, 0xffd23f, 0xb06cff, 0x7cf0c8, 0xff9a3c],
  },
  banner: { in: 0.45, hold: 1.5, out: 0.45 },
  commSlide: 0.3,
  feedLife: 4,
  feedLines: 5,
  words: {
    tagline: 'ACE SQUADRON',
    battle: 'BATTLE',
    wave: 'WAVE',
    cleared: 'BATTLE CLEARED',
    pilotLost: 'PILOT LOST',
    rescued: 'PILOT RESCUED',
    victory: 'VICTORY',
    defeat: 'SQUADRON LOST',
    multiKill: 'MULTI KILL',
  },
};

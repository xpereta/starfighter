import type { PortraitPalette } from './presentation';

/**
 * Procedural pilot portraits: flat-colour, face-less "visor" busts (a helmet, a glass visor with a
 * highlight slash, a stripe, a collar and a badge) generated from the pilot's name, so the same pilot
 * always has the same portrait, in a replay and across runs. Pure data plus an SVG string, no DOM.
 */

export const HELMET_SHAPES = ['round', 'crest', 'visorcap', 'wide'] as const;
export const VISOR_SHAPES = ['band', 'dome', 'slit', 'wedge'] as const;
export const STRIPE_STYLES = ['none', 'center', 'side', 'double'] as const;
export const BADGE_SHAPES = ['dot', 'bar', 'chevron', 'star'] as const;

export interface PortraitSpec {
  helmetShape: (typeof HELMET_SHAPES)[number];
  visorShape: (typeof VISOR_SHAPES)[number];
  stripe: (typeof STRIPE_STYLES)[number];
  badge: (typeof BADGE_SHAPES)[number];
  helmet: number;
  visor: number;
  accent: number;
  /** Background panel colour (a dark tint of the accent). */
  backdrop: number;
  /** Visor highlight slash angle, degrees. */
  slash: number;
}

/** FNV-1a: a stable 32-bit hash of the pilot's name (the portrait's seed). */
export function portraitSeed(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A tiny seeded stream (mulberry32): the portraits' own, never the simulation's. */
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(list: readonly T[], next: () => number): T =>
  list[Math.floor(next() * list.length)]!;

function darken(color: number, k: number): number {
  const r = Math.round(((color >> 16) & 255) * k);
  const g = Math.round(((color >> 8) & 255) * k);
  const b = Math.round((color & 255) * k);
  return (r << 16) | (g << 8) | b;
}

/** The portrait for a pilot: the same name always gives the same spec. */
export function portraitSpec(name: string, palette: PortraitPalette): PortraitSpec {
  const next = stream(portraitSeed(name));
  const helmet = pick(palette.helmets, next);
  const visor = pick(palette.visors, next);
  let accent = pick(palette.accents, next);
  if (accent === helmet) accent = pick(palette.accents, next);
  return {
    helmetShape: pick(HELMET_SHAPES, next),
    visorShape: pick(VISOR_SHAPES, next),
    stripe: pick(STRIPE_STYLES, next),
    badge: pick(BADGE_SHAPES, next),
    helmet,
    visor,
    accent,
    backdrop: darken(accent, 0.35),
    slash: 20 + Math.floor(next() * 30),
  };
}

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** Path data per helmet shape, in a 64x64 box: the helmet outline. */
const HELMET_PATH: Record<PortraitSpec['helmetShape'], string> = {
  round: 'M32 6 C48 6 56 18 56 32 C56 46 48 56 32 56 C16 56 8 46 8 32 C8 18 16 6 32 6 Z',
  crest: 'M32 2 L38 10 C50 12 57 22 57 33 C57 47 48 56 32 56 C16 56 7 47 7 33 C7 22 14 12 26 10 Z',
  visorcap: 'M10 30 C10 14 20 6 32 6 C44 6 54 14 54 30 L56 50 L32 58 L8 50 Z',
  wide: 'M6 34 C6 16 18 8 32 8 C46 8 58 16 58 34 C58 48 48 56 32 56 C16 56 6 48 6 34 Z',
};

const VISOR_PATH: Record<PortraitSpec['visorShape'], string> = {
  band: 'M12 26 L52 26 L50 40 L14 40 Z',
  dome: 'M13 40 C13 24 22 20 32 20 C42 20 51 24 51 40 Z',
  slit: 'M10 30 L54 28 L52 36 L12 38 Z',
  wedge: 'M12 24 L52 28 L44 42 L16 40 Z',
};

/** The portrait as an inline SVG string (CSS-sized by the caller; `viewBox` 0 0 64 64). */
export function portraitSvg(spec: PortraitSpec): string {
  const helmet = hex(spec.helmet);
  const shade = hex(darken(spec.helmet, 0.62));
  const visor = hex(spec.visor);
  const accent = hex(spec.accent);
  const stripe =
    spec.stripe === 'none'
      ? ''
      : spec.stripe === 'center'
        ? `<rect x="29" y="4" width="6" height="18" fill="${accent}"/>`
        : spec.stripe === 'side'
          ? `<rect x="40" y="6" width="5" height="16" fill="${accent}" transform="rotate(14 42 14)"/>`
          : `<rect x="26" y="4" width="3" height="18" fill="${accent}"/><rect x="35" y="4" width="3" height="18" fill="${accent}"/>`;
  const badge =
    spec.badge === 'dot'
      ? `<circle cx="14" cy="58" r="3.4" fill="${accent}"/>`
      : spec.badge === 'bar'
        ? `<rect x="9" y="56" width="11" height="4" fill="${accent}"/>`
        : spec.badge === 'chevron'
          ? `<path d="M9 55 L14 60 L19 55 L19 58 L14 63 L9 58 Z" fill="${accent}"/>`
          : `<path d="M14 53 L15.6 57 L19.8 57.2 L16.4 59.8 L17.6 63.8 L14 61.4 L10.4 63.8 L11.6 59.8 L8.2 57.2 L12.4 57 Z" fill="${accent}"/>`;
  return (
    `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">` +
    `<rect width="64" height="64" fill="${hex(spec.backdrop)}"/>` +
    `<path d="M0 64 L0 52 C12 46 20 58 32 58 C44 58 52 46 64 52 L64 64 Z" fill="${shade}"/>` +
    `<path d="M20 56 L32 62 L44 56 L44 60 L32 66 L20 60 Z" fill="${accent}"/>` +
    `<path d="${HELMET_PATH[spec.helmetShape]}" fill="${helmet}" stroke="#22367a" stroke-width="2.2" stroke-linejoin="miter"/>` +
    `<path d="M8 40 C12 52 22 56 32 56 C42 56 52 52 56 40 L56 46 C52 54 44 58 32 58 C20 58 12 54 8 46 Z" fill="${shade}"/>` +
    stripe +
    `<path d="${VISOR_PATH[spec.visorShape]}" fill="${visor}" stroke="#22367a" stroke-width="2" stroke-linejoin="miter"/>` +
    `<path d="M20 40 L26 40 L36 22 L30 22 Z" fill="#ffffff" opacity="0.55" transform="rotate(${spec.slash - 35} 32 32)"/>` +
    badge +
    `</svg>`
  );
}

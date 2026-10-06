/**
 * Contrast measurement for the style packs (a dev and CI tool, no three, no DOM): WCAG relative
 * luminance and contrast ratio, CIE76 colour difference, and a measure of how well one drawn
 * entity stands out from the background around it. Works on plain RGBA byte buffers, so the
 * audit script can feed it pixels read back from a headless render and the tests can feed it
 * made-up pictures.
 */

/** WCAG targets: drawn things (ships, shots, pods, markers) and text. */
export const ENTITY_RATIO_TARGET = 3;
export const TEXT_RATIO_TARGET = 4.5;
/** A pixel differs from the background when any channel moves by at least this much (0..255). */
export const DIFF_THRESHOLD = 8;
/** How far around the entity (px) the local background is sampled. */
export const RING_PX = 5;

/** sRGB channel 0..255 to linear 0..1. */
export function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an sRGB colour with channels 0..255. */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** Luminance of a 0xRRGGBB colour. */
export const luminanceOfHex = (hex: number): number =>
  luminance((hex >> 16) & 255, (hex >> 8) & 255, hex & 255);

/** WCAG contrast ratio of two relative luminances, 1..21. */
export function contrastRatio(l1: number, l2: number): number {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** CIELAB (D65) of an sRGB colour with channels 0..255 (may be fractional). */
export function lab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const x = (0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047;
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  const z = (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883;
  const f = (t: number): number =>
    t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 colour difference (Euclidean distance in Lab): about 2.3 is a just-noticeable difference; 30+ is plainly different. */
export function deltaE76(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const l = lab(...a);
  const m = lab(...b);
  return Math.hypot(l[0] - m[0], l[1] - m[1], l[2] - m[2]);
}

export interface Box {
  x0: number;
  y0: number;
  /** Exclusive. */
  x1: number;
  y1: number;
}

export interface EntityContrast {
  /** Pixels the entity covers. */
  area: number;
  /** Luminance contrast of the whole body against the local background. */
  bodyRatio: number;
  /** Luminance contrast of the outermost pixels (the rim) against the background just outside. */
  rimRatio: number;
  /** The better of the two: how well it reads (a bright body or a bright rim is enough). */
  ratio: number;
  /** Share of rim pixels that individually stand 3:1 from their own neighbourhood, 0..1. */
  edgeShare: number;
  /** CIE76 colour difference of the body and of the rim from the local background. */
  deltaEBody: number;
  deltaERim: number;
  /** Mean relative luminance of the body, the rim and the local background. */
  bodyLum: number;
  rimLum: number;
  bgLum: number;
}

const NONE: EntityContrast = {
  area: 0,
  bodyRatio: 1,
  rimRatio: 1,
  ratio: 1,
  edgeShare: 0,
  deltaEBody: 0,
  deltaERim: 0,
  bodyLum: 0,
  rimLum: 0,
  bgLum: 0,
};

/**
 * How well an entity reads. `before` is the picture without it and `after` with it (RGBA bytes,
 * `width` pixels per row, top row first, same size); `box` bounds where to look. The entity is
 * wherever the two pictures differ; the local background is the ring of pixels around it in
 * `before`. An entity that covers nothing returns ratio 1 (it does not read).
 */
export function measureEntity(
  before: ArrayLike<number>,
  after: ArrayLike<number>,
  width: number,
  box: Box,
): EntityContrast {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  if (w <= 0 || h <= 0) return NONE;
  const mask = new Uint8Array(w * h);
  const at = (x: number, y: number): number => ((box.y0 + y) * width + box.x0 + x) * 4;
  let area = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      const d = Math.max(
        Math.abs(after[i]! - before[i]!),
        Math.abs(after[i + 1]! - before[i + 1]!),
        Math.abs(after[i + 2]! - before[i + 2]!),
      );
      if (d >= DIFF_THRESHOLD) {
        mask[y * w + x] = 1;
        area++;
      }
    }
  if (area === 0) return NONE;

  // Integral image of the mask: is any entity pixel within RING_PX of this one?
  const stride = w + 1;
  const integral = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += mask[y * w + x]!;
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1]! + row;
    }
  }
  const near = (x: number, y: number, r: number): number => {
    const x0 = Math.max(0, x - r);
    const y0 = Math.max(0, y - r);
    const x1 = Math.min(w, x + r + 1);
    const y1 = Math.min(h, y + r + 1);
    return (
      integral[y1 * stride + x1]! -
      integral[y0 * stride + x1]! -
      integral[y1 * stride + x0]! +
      integral[y0 * stride + x0]!
    );
  };

  let bodyL = 0;
  let bodyRgb = [0, 0, 0];
  let rimL = 0;
  let rimRgb = [0, 0, 0];
  let rimN = 0;
  let bgL = 0;
  let bgRgb = [0, 0, 0];
  let bgN = 0;
  let edgeOk = 0;
  const localBg = (x: number, y: number): number => {
    // Mean luminance of the background pixels in the 5x5 around (x, y).
    let sum = 0;
    let n = 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= w || py >= h || mask[py * w + px]) continue;
        const i = at(px, py);
        sum += luminance(before[i]!, before[i + 1]!, before[i + 2]!);
        n++;
      }
    return n ? sum / n : -1;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      if (mask[y * w + x]) {
        const r = after[i]!;
        const g = after[i + 1]!;
        const b = after[i + 2]!;
        const l = luminance(r, g, b);
        bodyL += l;
        bodyRgb = [bodyRgb[0]! + r, bodyRgb[1]! + g, bodyRgb[2]! + b];
        const edge =
          (x > 0 && !mask[y * w + x - 1]) ||
          (x < w - 1 && !mask[y * w + x + 1]) ||
          (y > 0 && !mask[(y - 1) * w + x]) ||
          (y < h - 1 && !mask[(y + 1) * w + x]);
        if (edge) {
          rimL += l;
          rimRgb = [rimRgb[0]! + r, rimRgb[1]! + g, rimRgb[2]! + b];
          rimN++;
          const bg = localBg(x, y);
          if (bg >= 0 && contrastRatio(l, bg) >= ENTITY_RATIO_TARGET) edgeOk++;
        }
      } else if (near(x, y, RING_PX) > 0) {
        const r = before[i]!;
        const g = before[i + 1]!;
        const b = before[i + 2]!;
        bgL += luminance(r, g, b);
        bgRgb = [bgRgb[0]! + r, bgRgb[1]! + g, bgRgb[2]! + b];
        bgN++;
      }
    }
  if (bgN === 0) return NONE; // the entity fills the whole box: nothing to compare with
  if (rimN === 0) {
    rimL = bodyL;
    rimRgb = bodyRgb;
    rimN = area;
  }
  const bodyLum = bodyL / area;
  const rimLum = rimL / rimN;
  const bgLum = bgL / bgN;
  const mean = (rgb: number[], n: number): [number, number, number] => [
    rgb[0]! / n,
    rgb[1]! / n,
    rgb[2]! / n,
  ];
  const bgMean = mean(bgRgb, bgN);
  const bodyRatio = contrastRatio(bodyLum, bgLum);
  const rimRatio = contrastRatio(rimLum, bgLum);
  return {
    area,
    bodyRatio,
    rimRatio,
    ratio: Math.max(bodyRatio, rimRatio),
    edgeShare: edgeOk / Math.max(1, rimN),
    deltaEBody: deltaE76(mean(bodyRgb, area), bgMean),
    deltaERim: deltaE76(mean(rimRgb, rimN), bgMean),
    bodyLum,
    rimLum,
    bgLum,
  };
}

/** The p-th percentile (0..1) of a luminance field, e.g. 0.95 for the brightest places text could land on. */
export function luminancePercentile(pixels: ArrayLike<number>, p: number, step = 7): number {
  const values: number[] = [];
  for (let i = 0; i + 2 < pixels.length; i += 4 * step)
    values.push(luminance(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!));
  values.sort((a, b) => a - b);
  return values.length ? values[Math.min(values.length - 1, Math.floor(p * values.length))]! : 0;
}

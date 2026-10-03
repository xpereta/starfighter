/** Piecewise-linear curve through points sorted by x; clamped outside the range. */
export type CurvePoint = readonly [x: number, y: number];

export function sampleCurve(points: readonly CurvePoint[], x: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) throw new Error('sampleCurve needs at least one point');
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (x <= b[0]) {
      const span = b[0] - a[0];
      return span <= 0 ? b[1] : a[1] + ((b[1] - a[1]) * (x - a[0])) / span;
    }
  }
  return last[1];
}

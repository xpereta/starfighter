/** Reference screen (Steam Deck). Every screen shows the same world *area* as this one. */
export const REFERENCE_ASPECT = 1280 / 800;

/** World-space size of the view. `viewWidth` is the visible width on the reference aspect. */
export function viewSize(viewWidth: number, aspect: number): { width: number; height: number } {
  const area = (viewWidth * viewWidth) / REFERENCE_ASPECT;
  return { width: Math.sqrt(area * aspect), height: Math.sqrt(area / aspect) };
}

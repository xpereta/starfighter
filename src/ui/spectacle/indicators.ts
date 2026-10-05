import type { HudConfig } from '../../../data/tuning/hud';
import type { World } from '../../core/world/world';
import { createEdgeIndicator, distanceStyle, edgeIndicator } from '../../render/hud/layout';

/**
 * Off-screen indicators for enemies, wingmen and rescue pods, with distance and a threat flag:
 * the readable-at-a-glance layer. Placement reuses the classic HUD's edge math; what is new is the
 * kind-specific styling data, the distance label, the threat rule and the cap on how many show.
 * Pure (no DOM); reads the world, never changes it.
 */

export type IndicatorKind = 'fighter' | 'drone' | 'turret' | 'static' | 'wingman' | 'pod';

export interface Indicator {
  kind: IndicatorKind;
  x: number;
  y: number;
  angle: number;
  distance: number;
  /** An enemy fighter that is chasing the player and close: drawn big and pulsing. */
  threat: boolean;
  size: number;
  opacity: number;
  label: string;
}

/** Enemies this close and chasing the player count as a threat (world units). */
export const THREAT_RANGE = 2600;
/** At most this many indicators are drawn (the nearest ones; pods and threats always win). */
export const MAX_INDICATORS = 14;

/** `340`, `1.2K`: distance for a label, short enough to sit under an arrow. */
export function distanceLabel(d: number): string {
  if (d < 1000) return String(Math.max(0, Math.round(d / 10) * 10));
  return `${(d / 1000).toFixed(1)}K`;
}

const KIND_PRIORITY: Record<IndicatorKind, number> = {
  pod: 0,
  fighter: 1,
  wingman: 2,
  turret: 3,
  drone: 4,
  static: 5,
};

/** Sort order of the cap: threats and pods first, then by kind, then by nearness. */
export function compareIndicators(a: Indicator, b: Indicator): number {
  if (a.threat !== b.threat) return a.threat ? -1 : 1;
  if ((a.kind === 'pod') !== (b.kind === 'pod')) return a.kind === 'pod' ? -1 : 1;
  return a.distance - b.distance || KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
}

const scratch = createEdgeIndicator();

/**
 * Fills `out` (cleared first) with the indicators of everything off screen, at most `MAX_INDICATORS`.
 * `center` is the camera centre, `view` the visible world size, `screen` the canvas size in px.
 */
export function collectIndicators(
  out: Indicator[],
  world: World,
  center: { x: number; y: number },
  view: { width: number; height: number },
  screen: { width: number; height: number },
  cfg: HudConfig,
): Indicator[] {
  out.length = 0;
  const add = (
    kind: IndicatorKind,
    body: { x: number; y: number; radius: number },
    threat: boolean,
  ): void => {
    if (!edgeIndicator(scratch, body, center, view, screen, cfg.edgeMargin)) return;
    const style = distanceStyle(scratch.distance, cfg);
    out.push({
      kind,
      x: scratch.x,
      y: scratch.y,
      angle: scratch.angle,
      distance: scratch.distance,
      threat,
      size: style.size,
      opacity: threat ? 1 : style.opacity,
      label: distanceLabel(scratch.distance),
    });
  };
  for (const t of world.targets) if (t.alive) add(t.kind, t, false);
  const ship = world.ship;
  for (const f of world.fighters) {
    if (!f.alive) continue;
    const chasing = f.targetIndex === -1;
    const near = Math.hypot(f.x - ship.x, f.y - ship.y) < THREAT_RANGE;
    add('fighter', f, chasing && near);
  }
  for (const pod of world.pods) {
    if (pod.alive) add('pod', { x: pod.x, y: pod.y, radius: world.tuning.rescue.podRadius }, false);
  }
  for (const w of world.squadron.wingmen) {
    if (w.alive)
      add('wingman', { x: w.ship.x, y: w.ship.y, radius: world.tuning.squadron.radius }, false);
  }
  if (out.length > MAX_INDICATORS) {
    out.sort(compareIndicators);
    out.length = MAX_INDICATORS;
  }
  return out;
}

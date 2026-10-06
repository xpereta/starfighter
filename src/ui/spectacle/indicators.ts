import type { HudConfig } from '../../../data/tuning/hud';
import { SHIP_GUNSHIP } from '../../core/ai/fighter';
import type { World } from '../../core/world/world';
import { createEdgeIndicator, distanceStyle, edgeIndicator } from '../../render/hud/layout';

/**
 * Off-screen indicators for enemies, wingmen and rescue pods, with distance and a threat flag:
 * the readable-at-a-glance layer. Placement reuses the classic HUD's edge math; what is new is the
 * kind-specific styling data, the distance label, the threat rule and the cap on how many show.
 * Pure (no DOM); reads the world, never changes it.
 */

export type IndicatorKind =
  | 'fighter'
  | 'gunship'
  | 'lancer'
  | 'capital'
  | 'missile'
  | 'drone'
  | 'turret'
  | 'static'
  | 'wingman'
  | 'pod';

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
  /** A name to show with the distance: the first name of the pilot flying a wingman. */
  tag: string;
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
  missile: 1,
  capital: 2,
  gunship: 3,
  lancer: 4,
  fighter: 5,
  wingman: 6,
  turret: 7,
  drone: 8,
  static: 9,
};

/** Sort order of the cap: threats and pods first, then by kind, then by nearness. */
export function compareIndicators(a: Indicator, b: Indicator): number {
  if (a.threat !== b.threat) return a.threat ? -1 : 1;
  if ((a.kind === 'pod') !== (b.kind === 'pod')) return a.kind === 'pod' ? -1 : 1;
  if ((a.kind === 'capital') !== (b.kind === 'capital')) return a.kind === 'capital' ? -1 : 1;
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
    tag = '',
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
      tag,
    });
  };
  for (const t of world.targets) if (t.alive) add(t.kind, t, false);
  const ship = world.ship;
  for (const f of world.fighters) {
    if (!f.alive) continue;
    const chasing = f.targetIndex === -1;
    const near = Math.hypot(f.x - ship.x, f.y - ship.y) < THREAT_RANGE;
    const kind: IndicatorKind =
      f.shipType === SHIP_GUNSHIP ? 'gunship' : f.lancer ? 'lancer' : 'fighter';
    add(kind, f, chasing && near);
  }
  const cap = world.enemies.capital;
  if (cap && cap.phase !== 2) {
    // One arrow for the whole ship, at its centre (its hull is the radius), always flagged: nothing else is as big.
    add('capital', { x: cap.x, y: cap.y, radius: cap.hullRadius }, false, 'CAPITAL SHIP');
  }
  // Enemy missiles home on the player: every one that is off screen gets an arrow, flagged as a threat.
  const missiles = world.enemies.missiles;
  for (let i = 0; i < missiles.count; i++)
    add('missile', { x: missiles.data.x[i]!, y: missiles.data.y[i]!, radius: 20 }, true);
  for (const pod of world.pods) {
    if (pod.alive) add('pod', { x: pod.x, y: pod.y, radius: world.tuning.rescue.podRadius }, false);
  }
  for (const w of world.squadron.wingmen) {
    if (!w.alive) continue;
    const pilot = world.pilots.roster.find((p) => p.id === w.pilotId);
    const tag = pilot ? (pilot.name.split(' ')[0] ?? '') : '';
    add('wingman', { x: w.ship.x, y: w.ship.y, radius: world.tuning.squadron.radius }, false, tag);
  }
  if (out.length > MAX_INDICATORS) {
    out.sort(compareIndicators);
    out.length = MAX_INDICATORS;
  }
  return out;
}

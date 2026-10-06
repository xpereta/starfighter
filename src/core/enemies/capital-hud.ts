import { CAPITAL_PARTS, coveredBy, isCovered } from './capital';
import type { CapitalPartDef, PartRole } from './capital-parts';
import type { CapitalState } from './state';

/**
 * Read-only data for the capital ship's health bar (spec section 8): one segment per part, grouped by
 * role, with the core marked and the plates that cover it. Pure state to HUD data: no drawing here, so
 * every HUD (the classic canvas one, a styled one) can show it. The bar is made of the parts; reading
 * it never changes the world.
 */

export interface BarSegment {
  id: string;
  role: PartRole;
  /** Share of its hit points left, 0..1 (0 when destroyed). */
  fraction: number;
  alive: boolean;
  /** True while a standing plate shields this part (it cannot be hit). */
  covered: boolean;
  isCore: boolean;
  /** A plate that covers the core: the player must take these down first. */
  coversCore: boolean;
}

export interface CapitalBar {
  /** Segments in display order: turrets, engines, bridge, plates, core. Reused between calls. */
  segments: BarSegment[];
  /** Plates covering the core that still stand, and how many there were. */
  corePlates: { standing: number; total: number };
  coreExposed: boolean;
  /** 0 = fighting, 1 = dying, 2 = destroyed. */
  phase: number;
}

const ROLE_ORDER: readonly PartRole[] = ['turret', 'engine', 'bridge', 'armour', 'core'];

/** Part indices in display order (cached per part list). */
const orderCache = new WeakMap<readonly CapitalPartDef[], number[]>();
function displayOrder(defs: readonly CapitalPartDef[]): number[] {
  let order = orderCache.get(defs);
  if (!order) {
    order = defs
      .map((_, i) => i)
      .sort(
        (a, b) => ROLE_ORDER.indexOf(defs[a]!.role) - ROLE_ORDER.indexOf(defs[b]!.role) || a - b,
      );
    orderCache.set(defs, order);
  }
  return order;
}

export function createCapitalBar(): CapitalBar {
  return { segments: [], corePlates: { standing: 0, total: 0 }, coreExposed: false, phase: 0 };
}

/**
 * Fills `out` from the ship's state (allocation-free once `out` has its segments). Returns `out`.
 * Safe to call every frame.
 */
export function fillCapitalBar(
  out: CapitalBar,
  cap: CapitalState,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): CapitalBar {
  const order = displayOrder(defs);
  const core = defs.findIndex((d) => d.role === 'core');
  const coreCovers = coveredBy(defs)[core]!;
  while (out.segments.length < order.length) {
    out.segments.push({
      id: '',
      role: 'turret',
      fraction: 0,
      alive: false,
      covered: false,
      isCore: false,
      coversCore: false,
    });
  }
  out.segments.length = order.length;
  for (let k = 0; k < order.length; k++) {
    const index = order[k]!;
    const def = defs[index]!;
    const part = cap.parts[index]!;
    const seg = out.segments[k]!;
    seg.id = def.id;
    seg.role = def.role;
    seg.alive = part.alive;
    seg.fraction =
      part.alive && part.maxHp > 0 ? Math.max(0, Math.min(1, part.hp / part.maxHp)) : 0;
    seg.covered = part.alive && isCovered(cap, index, defs);
    seg.isCore = index === core;
    seg.coversCore = coreCovers.includes(index);
  }
  let standing = 0;
  for (const j of coreCovers) if (cap.parts[j]!.alive) standing++;
  out.corePlates.standing = standing;
  out.corePlates.total = coreCovers.length;
  out.coreExposed = cap.coreExposed;
  out.phase = cap.phase;
  return out;
}

import type { LoopFrame, LoopState } from '../audio/loops';
import { LOOP_KEYS, type LoopTable } from '../render/style';

const sign = (v: number): string => (v >= 0 ? '+' : '-');

/** The game values the loops follow, in one line: "speed 0.62 · throttle +1.00 · hull 1.00 · ...". */
export function formatLoopValues(state: LoopState): string {
  return [
    `speed ${state.speed.toFixed(2)}`,
    `throttle ${sign(state.throttle)}${Math.abs(state.throttle).toFixed(2)}`,
    `hull ${state.hull.toFixed(2)}`,
    `rescue ${state.rescue.toFixed(2)}`,
    `missiles ${state.missiles.toFixed(2)}`,
    `edge ${state.edge ? 'out' : 'in'}`,
    state.always > 0 ? 'flying' : 'menu',
  ].join(' · ');
}

/**
 * Which loops are on (with how loud, as a share of their own full level), which are off, and which
 * the style leaves silent: "on: engine 62%, ambient 100% | off: afterburner | silent: rumble".
 */
export function formatLoopsActive(frames: readonly LoopFrame[], table: LoopTable): string {
  const on = new Map(frames.map((f) => [f.key, f]));
  const parts: string[] = [];
  const active = LOOP_KEYS.filter((k) => on.has(k)).map(
    (k) => `${k} ${Math.round(on.get(k)!.level * 100)}%`,
  );
  const off = LOOP_KEYS.filter((k) => !on.has(k) && table[k] !== 'silent');
  const silent = LOOP_KEYS.filter((k) => table[k] === 'silent');
  parts.push(`on: ${active.length ? active.join(', ') : 'none'}`);
  if (off.length) parts.push(`off: ${off.join(', ')}`);
  if (silent.length) parts.push(`silent: ${silent.join(', ')}`);
  return parts.join(' | ');
}

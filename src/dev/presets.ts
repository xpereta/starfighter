import { tuningParams, tuningToggles, type Tuning } from '../../data/tuning';
import { validateParam, type ParamDef } from '../core/params/params';

/** Groups the panel tunes, and the non-numeric toggles inside them. */
export const TUNED_GROUPS = ['flight', 'camera', 'weapons'] as const;
export type TunedGroup = (typeof TUNED_GROUPS)[number];

export const TOGGLES = tuningToggles;

/** Pools are sized when the world is created, so these only take effect after a reload. */
export const RELOAD_ONLY = new Set(['bulletCap']);

const FORMAT = 'starfighter-tuning';
export const PRESET_VERSION = 1;

export type PresetValues = Partial<Record<TunedGroup, Record<string, number | string | boolean>>>;
export interface Preset {
  name: string;
  values: PresetValues;
}

const defsOf = (group: TunedGroup): Record<string, ParamDef> => tuningParams[group];
const groupOf = (tuning: Tuning, group: TunedGroup): Record<string, number | string | boolean> =>
  tuning[group] as unknown as Record<string, number | string | boolean>;

/** Snapshot of every tuned value (numbers and toggles) as a preset. */
export function serializePreset(tuning: Tuning, name: string): string {
  const values: PresetValues = {};
  for (const group of TUNED_GROUPS) {
    const out: Record<string, number | string | boolean> = {};
    const src = groupOf(tuning, group);
    for (const key of [...Object.keys(defsOf(group)), ...Object.keys(TOGGLES[group])])
      out[key] = src[key]!;
    values[group] = out;
  }
  return JSON.stringify({ format: FORMAT, version: PRESET_VERSION, name, values }, null, 2);
}

/** Parses and validates preset text. Throws a readable error for anything wrong, so bad files fail loudly. */
export function parsePreset(text: string): Preset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Preset is not valid JSON');
  }
  const obj = raw as {
    format?: unknown;
    version?: unknown;
    name?: unknown;
    values?: unknown;
  } | null;
  if (typeof obj !== 'object' || obj === null || obj.format !== FORMAT)
    throw new Error('Not a Starfighter tuning preset');
  if (obj.version !== PRESET_VERSION)
    throw new Error(`Unsupported preset version ${String(obj.version)}`);
  if (typeof obj.values !== 'object' || obj.values === null)
    throw new Error('Preset has no values');

  const values: PresetValues = {};
  for (const [group, entries] of Object.entries(obj.values as Record<string, unknown>)) {
    if (!(TUNED_GROUPS as readonly string[]).includes(group))
      throw new Error(`Unknown group "${group}"`);
    const g = group as TunedGroup;
    const defs = defsOf(g);
    const out: Record<string, number | string | boolean> = {};
    for (const [key, value] of Object.entries(entries as Record<string, unknown>)) {
      const def = defs[key];
      const toggle = TOGGLES[g][key];
      if (def) {
        if (typeof value !== 'number') throw new Error(`${group}.${key} must be a number`);
        out[key] = validateParam(`${group}.${key}`, def, value);
      } else if (toggle) {
        if (!toggle.includes(value as string | boolean)) {
          throw new Error(`${group}.${key} must be one of ${toggle.join(', ')}`);
        }
        out[key] = value as string | boolean;
      } else {
        throw new Error(`Unknown parameter ${group}.${key}`);
      }
    }
    values[g] = out;
  }
  return { name: typeof obj.name === 'string' ? obj.name : 'imported', values };
}

/** Writes preset values into the live tuning object (in place, so the world sees them next step). */
export function applyPreset(tuning: Tuning, preset: Preset): void {
  for (const group of TUNED_GROUPS) {
    const values = preset.values[group];
    if (values) Object.assign(groupOf(tuning, group), values);
  }
}

export interface Change {
  path: string;
  from: number | string | boolean;
  to: number | string | boolean;
}

/** Every tuned value that differs from the committed defaults: what "copy as defaults" reports. */
export function diffFromDefaults(tuning: Tuning, defaults: Tuning): Change[] {
  const changes: Change[] = [];
  for (const group of TUNED_GROUPS) {
    const now = groupOf(tuning, group);
    const base = groupOf(defaults, group);
    for (const key of [...Object.keys(defsOf(group)), ...Object.keys(TOGGLES[group])]) {
      if (now[key] !== base[key])
        changes.push({ path: `${group}.${key}`, from: base[key]!, to: now[key]! });
    }
  }
  return changes;
}

/** Text to paste to an agent (or into data/tuning/*.ts) to commit the tuned values as new defaults. */
export function formatDefaultsPatch(changes: readonly Change[]): string {
  if (changes.length === 0) return 'No changes from the committed defaults.';
  const lines = changes.map((c) => `- ${c.path}: ${String(c.from)} -> ${String(c.to)}`);
  return [
    'Set these tuned values as the new defaults (data/tuning/*.ts, keep ranges/units):',
    ...lines,
  ].join('\n');
}

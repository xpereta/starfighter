/** A tunable parameter: typed, with a default, a sane range and units. */
export interface ParamDef {
  readonly default: number;
  readonly min: number;
  readonly max: number;
  /** Short unit shown next to the value ('s', 'u/s', '°'); empty for plain numbers. */
  readonly unit: string;
  /** Longer explanation, shown as a tooltip in the tuning panel. */
  readonly note?: string;
  /** Override for the panel's slider step (otherwise derived from the range). */
  readonly step?: number;
}

/** Throws if `value` is not a finite number inside the parameter's range. */
export function validateParam(name: string, def: ParamDef, value: number): number {
  if (!Number.isFinite(value) || value < def.min || value > def.max) {
    throw new Error(
      `Parameter "${name}" = ${value} is outside [${def.min}, ${def.max}] ${def.unit}`,
    );
  }
  return value;
}

/** Validates the definitions themselves, then returns the default values. Fails loudly on bad data. */
export function defaultsOf<T extends Record<string, ParamDef>>(
  defs: T,
): { [K in keyof T]: number } {
  const out = {} as { [K in keyof T]: number };
  for (const name of Object.keys(defs) as (keyof T & string)[]) {
    out[name] = validateParam(name, defs[name]!, defs[name]!.default);
  }
  return out;
}

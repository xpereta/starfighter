/** Small checks shared by the enemy data validators. Every failure throws with the path of the bad value. */
export function checkNumber(path: string, value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${path} = ${String(value)} must be a finite number in [${min}, ${max}]`);
  }
  return value;
}

export function checkInteger(path: string, value: unknown, min: number, max: number): number {
  const n = checkNumber(path, value, min, max);
  if (!Number.isInteger(n)) throw new Error(`${path} = ${n} must be a whole number`);
  return n;
}

export function checkId(path: string, value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new Error(`${path} = ${String(value)} must be a lowercase id (a-z, 0-9, dashes)`);
  }
  return value;
}

export function checkText(path: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} must be a non-empty text`);
  }
  return value;
}

export function checkOneOf<T extends string>(
  path: string,
  value: unknown,
  options: readonly T[],
): T {
  if (!options.includes(value as T)) {
    throw new Error(`${path} = ${String(value)} must be one of ${options.join(', ')}`);
  }
  return value as T;
}

/**
 * Fixed-capacity struct-of-arrays pool for hot entities (bullets, particles, debris).
 * Active items are always indices [0, count). Removal swaps the last item into the gap,
 * so iterate backwards when removing while looping. No allocation after creation.
 */
export interface Pool<K extends string> {
  readonly capacity: number;
  readonly count: number;
  readonly data: Readonly<Record<K, Float32Array>>;
  /** Activates a slot (fields are zeroed). Returns its index, or -1 if the pool is full. */
  spawn(): number;
  /** Deactivates the slot at `index` (swap-remove). */
  remove(index: number): void;
  clear(): void;
}

export function createPool<K extends string>(capacity: number, fields: readonly K[]): Pool<K> {
  const data = {} as Record<K, Float32Array>;
  for (const field of fields) data[field] = new Float32Array(capacity);
  let count = 0;
  return {
    capacity,
    get count() {
      return count;
    },
    data,
    spawn() {
      if (count >= capacity) return -1;
      for (const field of fields) data[field][count] = 0;
      return count++;
    },
    remove(index) {
      if (index < 0 || index >= count) return;
      const last = count - 1;
      if (index !== last) {
        for (const field of fields) data[field][index] = data[field][last]!;
      }
      count = last;
    },
    clear() {
      count = 0;
    },
  };
}

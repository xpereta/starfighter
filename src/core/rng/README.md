# core/rng

- **Purpose:** seeded deterministic randomness. `Math.random` is banned in `src/core` (lint).
- **Reads/writes:** owns its private state; nothing else.
- **Events:** none. **Parameters:** the seed (stored with replays).
- **Test:** `rng.test.ts` (same seed gives the same sequence, ranges respected).

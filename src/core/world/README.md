# core/world

- **Purpose:** the shared world state (plain typed data), the fixed-step entry point `stepWorld`, and `createPool` for hot entities.
- **Reads/writes:** owns `World` (`seed`, `rng`, `events`, `actions`, `tuning`, `ship`, `camera`, `tick`, `time`). Gameplay systems added by later issues are called from `stepWorld` in a fixed order.
- **Events:** clears the queue at the start of each step; systems emit during it.
- **Parameters:** the seed, and pool capacities (hard caps; set by the owning module).
- **Test:** `pool.test.ts`, `world.test.ts`, and `tests/sim`.

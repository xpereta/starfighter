# core/meta

- **Purpose:** what persists between runs: the veterans roster and the best run (spec section 6).
- **Status:** contract types only. Issue A3 adds the pure functions (promotion at run end, deletion when a veteran is lost, start-of-run selection, v1 to v2 save migration) and switches `src/app/save.ts` to save version 2.
- **Contract:** `MetaData = { veterans: Veteran[], bestRun }`, `Veteran = { id, name, trait, kills, runs }`. Meta is not simulation state: it is loaded at boot and saved at run end, never in the replay hash. Pilot ids of veterans stay stable across runs.

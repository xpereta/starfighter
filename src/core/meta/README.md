# core/meta

- **Purpose:** what persists between runs: the veterans roster and the best run (spec section 6).
- **Status:** implemented (A3). Pure functions only; the save lives in `src/app/save.ts` (version 2).
- **Contract:** `MetaData = { veterans: Veteran[], bestRun }`, `Veteran = { id, name, trait, kills, runs }`. Meta is not simulation state: it is loaded at boot and saved at run end, never in the replay hash. `bestRun` is the most battles cleared in one run (a victory is `battleCount`).
- **Flow (the app wires it in I1):**
  1. Boot: `loadSave()` then `offerVeterans(world, veteranOffers(save.meta))` on the Start screen; pass `save.meta.bestRun` to the UI.
  2. The Start screen ticks veterans into `world.run.selectedVeterans` (menu actions, so replays record them); Start brings them in with `Pilot.veteranId` set to their save id.
  3. When `world.run.phase` becomes `end`: `save.meta = applyFinishedRun(save.meta, world.pilots.roster, world.run, tuning.pilots.veteranCap)` then `storeSave(save)`. Offer the new roster again before the next Start screen.
- **Rules (`applyRunEnd`):** every pilot still active becomes a veteran (a saved one stays with `runs` + 1 and its kills updated, anyone else is new); a saved veteran who was lost is deleted; veterans who did not fly are untouched; past `veteranCap` the ones with the fewest kills are dropped. Identity is `Pilot.veteranId`, never the name (two pilots may share one).
- **Save v2:** `{ version: 2, bestTrialTime, meta }`. Version 1 (just `bestTrialTime`) migrates without loss; unknown versions fall back to defaults; `parseMeta` drops invalid veterans, duplicate ids and bad numbers.
- **Parameters:** `veteranCap` and `veteransPerRun` in `data/tuning/pilots.ts`.

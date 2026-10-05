# core/pilots

- **Purpose:** generated pilots (name, one trait), the run's roster and the trait effects on wingmen (spec section 2).
- **Status:** implemented (A1). Pilots are only created in run mode; practice mode keeps its anonymous wingmen (`pilotId` 0) exactly as before.
- **Contract:** `world.pilots` = `{ roster: Pilot[], nextId, draws }`; a `Pilot` has `id`, `name`, `trait`, `kills`, `battles`, `status` (`active` | `lost`) and `veteran`. Lost pilots stay in the roster. Events: `PilotJoined{pilotId, how}`, `PilotLost`, `PilotKill`. Anything you add must go into `mixPilots` (replay hash).
- **Veterans:** a pilot brought from the save carries `veteranId` (its id in the save, 0 otherwise; in the hash); `core/meta` uses it at run end to update or delete that veteran.
- **Generation:** `generatePilots` / `generateCandidates` are a pure function of `world.seed` and the `draws` counter (not the sim RNG), so offering a pick never shifts the battle's random numbers. Candidates in one offer have different traits. Names come from `data/content/names.ts` (first name + callsign).
- **Roster:** `addPilot` refuses (returns null) once `squadMax` pilots are active. `losePilot` is idempotent and emits `PilotLost`; `markBattleFlown` counts a battle for every active pilot. `stepPilots` credits `Killed` events to the pilot whose bullet or missile did the last damage (`lastHitBy` on the body, `owner` on the shot).
- **Traits:** `effectiveSquadronConfig(out, world, pilotId)` in `effective.ts` is the single place trait multipliers meet the squadron tuning (fire cone, gun damage, slot hold, engage range, speed, missile damage, guard bias, health bonus). `maxHpOf` gives a pilot's hull. Wingmen call it every step, so tuning changes apply live.
- **Run-mode squad:** lost wingmen stay as dead entries (salvo indices stay stable) and the living share the formation slots (`slotOf`); no respawn in run mode.
- **Parameters:** `data/tuning/pilots.ts` (`squadMax`, `pickCount`, `guardPreference`, `veteransPerRun`); trait multipliers live in `data/content/traits.ts` and are validated at load (`validateTraits`).

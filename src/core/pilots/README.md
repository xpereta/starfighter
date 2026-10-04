# core/pilots

- **Purpose:** generated pilots (name, one trait), the run's roster and the trait effects on wingmen (spec section 2).
- **Status:** contract skeleton. Issue A1 implements generation (seeded, from `data/content/names.ts`), the roster as wingmen in run mode, the five traits (`data/content/traits.ts`, currently neutral placeholders) applied through one effective-config function, squad cap 4, and permanent loss in run mode.
- **Contract:** `world.pilots` = `{ roster: Pilot[], nextId }`; a `Pilot` has `id`, `name`, `trait`, `kills`, `battles`, `status` (`active` | `lost`) and `veteran`. Lost pilots stay in the roster. Events: `PilotJoined{pilotId, how}`, `PilotLost`, `PilotKill`. Anything you add must go into `mixPilots` (replay hash). The roster is also what the HUD roster and the chatter read.
- **Parameters:** `data/tuning/pilots.ts`; trait multipliers live in `data/content/traits.ts` and are validated at load (`validateTraits`).

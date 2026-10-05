# core/events

- **Purpose:** typed events that decouple gameplay from FX, audio, HUD and stats.
- **Reads/writes:** one `EventQueue` lives on the world. Gameplay modules `emit`; consumers read `events` after the step; the loop `clear()`s once per step.
- **Events:** `ShotFired`, `Hit{dirX, dirY, impulse}`, `Killed`, `EvadeStarted`, plus lock-on, missile, order, run and pilot events (see `events.ts`). Added for sound (prototype 4, emitted without touching state): `EnemyShotFired{from}`, `WingmanShotFired`, `PlayerDamaged{hull}`, `WingmanHit`, `WingmanDown`, `MissileImpact`, `ArenaEdgeEntered`, `ArenaEdgeLeft`, `PlayerRespawned`, `MenuMove{dir}`, `MenuSelect`, `MenuBack`, `MenuTick{checked}`, `MenuPick`. Add new types to the `GameEvent` union (and to the sound keys in `src/render/style.ts`, which fails to compile until you do).
- **Events are not state:** nothing reads an event to change the world, and the replay hash does not include them. The camera shakes only on `ShotFired` and `Hit`, so the sound-only events (enemy and wingman shots) are separate types.
- **Rule:** per-entity or per-particle hot loops do not emit events; emit at system level.
- **Test:** `events.test.ts`.

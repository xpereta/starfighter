# core/events

- **Purpose:** typed events that decouple gameplay from FX, audio, HUD and stats.
- **Reads/writes:** one `EventQueue` lives on the world. Gameplay modules `emit`; consumers read `events` after the step; the loop `clear()`s once per step.
- **Events:** `ShotFired`, `Hit{dirX, dirY, impulse}`, `Killed`, `EvadeStarted`. Add new types to the `GameEvent` union.
- **Rule:** per-entity or per-particle hot loops do not emit events; emit at system level.
- **Test:** `events.test.ts`.

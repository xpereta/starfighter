# core/flight

- **Purpose:** plane-like ship motion: speed and throttle, speed-dependent turn rate, angular inertia, grip/slide, soft arena boundary, and both steering schemes. Evade: a quick roll with a sidestep, i-frames, cooldown and a speed bonus.
- **Reads:** `world.actions` (steer vector, `rotate`, throttle), `world.tuning.flight`. **Writes:** `world.ship`.
- **Conventions:** heading in radians counter-clockwise from +x, y up; tuning values in degrees, converted inside the module.
- **Steering:** `rotate` (B, default since 2026-10-04): stick X turns the ship. `point` (A): the stick direction is the desired heading, neutral stick keeps heading. Keyboard `rotate` works in both.
- **Evade:** `X` / Shift (edge-triggered). `evadeTime` 0.45 s, sidestep `evadeOffset` 90 u toward the stick/rotate side (default left), invulnerable for `evadeIFrames` 0.3 s (`ship.invulnerable`; enemy shots pass through), cooldown 2 s from the start (`ship.evadeCooldown`, for the HUD), +15% speed. Variant `evadeSidestep = false`: no sidestep, only i-frames and a boosted break turn. `ship.roll` drives the renderer's squash.
- **Events:** `EvadeStarted{x, y, side}`. **Parameters:** `data/tuning/flight.ts` (typed, default, range, unit).
- **Test:** `flight.test.ts`, `curve.test.ts`, and the 120 s random-input run in `tests/sim/flight.sim.test.ts`.

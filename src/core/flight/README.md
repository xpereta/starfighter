# core/flight

- **Purpose:** plane-like ship motion: speed and throttle, speed-dependent turn rate, angular inertia, grip/slide, soft arena boundary, and both steering schemes. (Evade is added by its own issue.)
- **Reads:** `world.actions` (steer vector, `rotate`, throttle), `world.tuning.flight`. **Writes:** `world.ship`.
- **Conventions:** heading in radians counter-clockwise from +x, y up; tuning values in degrees, converted inside the module.
- **Steering:** `point` (A, default): the stick direction is the desired heading, neutral stick keeps heading. `rotate` (B): stick X turns the ship. Keyboard `rotate` works in both.
- **Events:** none yet. **Parameters:** `data/tuning/flight.ts` (typed, default, range, unit).
- **Test:** `flight.test.ts`, `curve.test.ts`, and the 120 s random-input run in `tests/sim/flight.sim.test.ts`.

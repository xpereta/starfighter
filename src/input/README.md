# input

- **Purpose:** turn gamepad (Xbox-style, standard mapping) and keyboard into the `Actions` struct in `core/world/actions.ts`.
- **Reads/writes:** reads browser events and the Gamepad API; writes `world.actions` once per frame (`input.poll(world.actions)`).
- **Bindings:** left stick steer · RT/LT throttle · A fire · X evade · Y respawn · Start time trial. Keyboard: A/D or arrows rotate (`rotate` action, works in both steering schemes), W/S throttle, Space fire, Shift evade, R respawn, T time trial.
- **Parameters:** `stickDeadzone` in `data/tuning/input.ts` (radial, rescaled).
- **Behavior:** works with no gamepad; a pad connecting or disconnecting is picked up on the next poll; held keys are cleared on window blur.
- **Test:** `mapping.test.ts` covers the pure mapping; `input.ts` is thin browser wiring.

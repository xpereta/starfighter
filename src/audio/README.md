# audio

- **Purpose:** plays the active style pack's sound table (`data/styles/<id>/sounds.ts`) from the game events. Presentation only: it reads events and state, never writes the world, and is never imported by `src/core` (lint enforces it). Replays and the state hash are unchanged (`tests/sim/audio.sim.test.ts` checks the hash with audio on and off, under every style).
- **Parts:**
  - `planner.ts` (pure): event -> `PlayRequest`. Looks the event up in the table, applies the minimum gap and the voice limit, rolls the pitch (`pitch` +/- `pitchRandom`, its own random stream, never the simulation's), and works out volume and pan from the event position relative to the player (`spatial`: pan and distance fade; `size`: bigger kills sound deeper and louder; `duck`: dip the music). Pitch is clamped to 0.1..10 and volume and pan to their ranges.
  - `engine.ts`: the state around it: unlocked or not, paused, muted, the mix. Events before the first key press or click are dropped (browser rule). Pause plays the `Paused` sound and suspends the effects; resume undoes it. Mute sends master 0 and keeps the volumes.
  - `backend.ts`: the interface to the hardware. `webaudio.ts` is the Web Audio one (oscillators and looped noise with an envelope, a sweep and a filter per layer, or a sample file); `fake-backend.ts` records requests for tests.
  - `index.ts`: browser wiring (`startAudio()`): the unlock on the first key or pointer press, the **M** mute key (remembered in this browser), `<html data-audio-muted>` for e2e.
  - `samples.ts`: finds sample files in `data/styles/<id>/assets/` or `data/audio/`.
- **Mix parameters:** `data/audio/mix.ts` (master, effects, music: default, range, unit, note), edited live in the panel.
- **Events in:** every `GameEvent` (by its type) plus the app's `Paused` and `Resumed`; each has a sound or an explicit `'silent'` in every pack.
- **Test:** `engine.test.ts` (fake backend: bounds, gaps, voices, pan, size, duck, pause, mute), `tests/sim/audio.sim.test.ts`, e2e (M key).

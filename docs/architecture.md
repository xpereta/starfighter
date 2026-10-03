# Starfighter — Architecture Principles (v1, approved)

Stack: **Three.js + TypeScript** (consoles deferred). See `docs/engine-choice.md`.

Goal: modular enough that AI agents can work on and test parts independently, without paying for it in performance or boilerplate. **No over-engineering.**

## 1. Modules — at the right granularity

- **Target: "as modular as useful", not "as modular as possible".** Too many tiny modules = indirection, boilerplate, agents hopping across files, harder debugging.
- Module boundary = **one gameplay system** (agent-sized: one agent can own it end to end):
  `input` · `flight` · `weapons` (guns, missiles) · `lockon` · `damage` · `ai` (enemies) · `squadron` (wingmen, orders) · `camera` · `fx` (particles, debris, death sequences) · `audio` · `ui/hud` · `run` (map, nodes, rewards) · `meta` (veterans, unlocks, saves) · `render`.
- Dependency rule: `core` (all gameplay) never imports `render`, DOM, Three.js or browser APIs. Enforced by a lint rule, not by convention.

## 2. Interfaces — keep them few and boring

- Modules communicate through **(a) shared world state** (plain typed data) and **(b) typed events** (`ShotFired`, `Hit{dir, impulse}`, `Killed`, `LockAcquired`, `PilotJoined`, `PilotLost`…).
- Events are how FX, audio, radio chatter and stats attach **without touching gameplay code** — they are also the hooks for the craft & detail pass.
- Each module has a short **README contract**: purpose, state it reads/writes, events in/out, parameters, how to test. This is the interface agents read first.

## 3. Performance — where modularity must not reach

- Boundaries at the **system level, never per entity in hot loops**. Bullets, particles and debris live in pooled, flat arrays processed in bulk; no per-particle objects, closures or event dispatch.
- No allocation in the frame loop for hot paths (object pools).
- **Performance budget from day 1**: 60 fps in the browser on Steam Deck–class hardware; hard caps for bullets/particles/debris; a stress-test scene that agents run to check regressions.

## 4. Parameters — easy to configure, but organized

Three different kinds, kept separate:

1. **Content data** — what things are: ship stats, weapons, damage, enemy types, pilots, death sequences. Data files, per entity type.
2. **Tuning** — how things feel: turn rates, acceleration curves, camera zoom/look-ahead, lock-on time, hit nudges. Per-module config files; exposed in the dev **tuning panel** (live sliders). Only the knobs that matter for feel go on the panel.
3. **Quality settings** — how much eye candy: particle counts, explosion counts, debris lifetime. These are **platform presets** (Low / Medium / High; e.g. mobile vs desktop), not design values. Gameplay must never depend on them.

- Every parameter: typed, with a default, a sane range and units. Validated at load (bad data fails loudly).
- One convention for units, declared once (e.g. world units, seconds, radians).

## 5. Testing — isolation is necessary, not sufficient

- Unit tests per module, in Node, no browser.
- **Simulation tests**: run N seconds of scripted combat headless and assert outcomes (no crashes, no NaN, caps respected, missiles hit stationary targets…).
- "Feel" can't be unit-tested: human playtests + tuning panel remain essential.

## 6. Cheap things that pay off a lot (do from day 1)

- **Fixed timestep + seeded RNG** → deterministic simulation.
- **Input recording / replays** (seed + inputs): reproduce any bug exactly; agents can replay a bug report.
- **Debug overlays** (toggle): lock-on cone, hit circles, AI targets/intent, camera bounds, entity counts, frame time.
- **Save-data version number** (veterans and unlocks persist across runs; saves will change).

## Explicitly NOT doing (for now)

Generic ECS framework · plugin/mod system · dependency-injection containers · networking abstractions · editor tooling · hot-reload of everything · abstract "engine layer" for hypothetical future engines.

# core/run

- **Purpose:** the run as a state machine: start screen, battles 1-4, debriefs, end (spec: `docs/specs/prototype-3-pilots.md` section 1). Practice mode (the Prototype 1/2 arena) is the default and what the simulation tests use.
- **Status:** contract skeleton. Issue A2 implements transitions, the waves objective, the player hull and defeat, and resupply; I1 wires the boot flow.
- **Contract:** `world.run` = `{ mode: 'practice' | 'run', phase: 'start' | 'battle' | 'debrief' | 'end', battle, wave, result, cursor }`. `stepRun(world)` runs first each step. Menu input arrives only as the edge-triggered `menuUp/menuDown/menuSelect/menuBack` actions (compare with `world.prev.menu*`, updated at the end of the step), so replays record every menu choice. While the phase is not `battle` the world does not step gameplay. Events: `BattleStarted`, `WaveStarted`, `BattleCleared`, `RunEnded`. Anything you add to `Run` must go into `mixRun` (replay hash).
- **Parameters:** `data/tuning/run.ts`.

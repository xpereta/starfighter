# Prototype 5: who owns what

After the contract PR (`feature/p5-contract`), three tracks run in parallel (spec: `specs/prototype-5-enemy-variety.md` section 10). Each track owns its files; touch another track's file only through a small separate PR or by agreeing first.

## What the contract gives you
Types and validators in `src/core/enemies` (kinds, weapon mounts, capital parts, battle table, wing and missile state), data in `data/content/{enemies,capital,battles}.ts` and `data/content/kinds/*`, tuning stubs `data/tuning/{gunship,lancer,capital,wings}.ts` (typed, not yet part of `Tuning`), `world.enemies` (empty, hashed only when non-empty), and the seven new events (declared, silent in every style pack, not emitted). Existing behaviour and replay hashes are unchanged (replay version 7).

## Track A: framework, wings, gunship
Owns `src/core/ai/wings*`, `data/content/kinds/fighter.ts` and `gunship.ts`, `data/tuning/gunship.ts` and `wings.ts`, `data/content/battles.ts`, the code that spawns from kinds and from the battle table (`src/core/ai/waves.ts`, `stepRunBattle` in `src/core/run/run.ts` for the wave source), gunship AI and mounts, `WingState` use, `EnemySpawned` and `WingBroken` emission.

## Track B: missile fighter
Owns `src/core/ai/lancer*` (new), `src/core/enemies/enemy-missiles*` (new: stepping, hits; the pool lives in `state.ts`), `data/content/kinds/lancer.ts`, `data/tuning/lancer.ts`, warning cues (events and HUD read-only state), wingman rules about missiles, `EnemyMissileFired` and `EnemyMissileHit` emission.

## Track C: capital ship
Owns `src/core/enemies/capital*` (new: part damage routing, core exposure, AI, death sequence data), `data/content/capital.ts`, `data/content/kinds/capital.ts`, `data/tuning/capital.ts`, lock-on on parts (`src/core/lockon`, `src/core/world/lockable.ts` additions), escorts and the battle 4 boss script, `PartDestroyed`, `CoreExposed`, `CapitalDestroyed` emission, the parts HUD bar data.

## Shared files (small edits, rebase often)
`data/tuning/index.ts` (each track adds one line per group), `src/core/enemies/state.ts` and `mixEnemies` (add your fields and the audit in `hash-coverage.test.ts` together), `src/render/style.ts`, `data/styles/*/sounds.ts` (replace your `'silent'` entries only), `src/core/events/events.ts` (change only your events).

## Merge order and rules
1. The contract PR merges first; tracks branch from main after it.
2. Wiring a tuning group into `Tuning` changes the replay tuning shape: the first track to do it (or to make enemy state non-empty) bumps `REPLAY_VERSION` to 8 with a one-line reason; later tracks rebase and bump again only if their own state or tuning changes the hash again.
3. Track A should land the spawn-from-kinds change before B and C wire their spawns; B and C may land in either order. If a track needs an A change, it asks for a small PR to main rather than copying code.
4. Every new gameplay field goes into the hash with the audit test updated, every new event into every style pack, every new parameter with default, range, unit and note.
5. Integration (the full battle ramp, tuning, e2e, reviewer pass) starts only when A, B and C are merged.

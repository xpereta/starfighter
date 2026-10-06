# data/content

Content data (not tuning, not looks): trait definitions and names (prototype 3) and, for prototype 5, the enemy roster.

- `enemies.ts` lists the enemy kinds; one file per kind in `kinds/` (`fighter.ts` track A, `gunship.ts` track A, `lancer.ts` track B, `capital.ts` track C). Validated when loaded (bad data throws).
- `capital.ts`: the capital ship's parts (track C): turrets, engines, plates, bridge, core, validated at load by `validateCapitalParts`; the numbers in it are starting defaults with notes in the file header.
- `battles.ts`: the authored ramp, one entry per battle (waves of groups, turrets, optional boss; a `wing` group may name its size, 3 to 5). Types and validation: `src/core/enemies`. The run reads it (`battleDefOf` in `core/run/run.ts`) while the tuning toggle `run.ramp` is `authored` (the default): battle 1 fighters then a wing of 3, battle 2 fighters, a gunship (wave 2) and a wing, battle 3 a wing, a gunship with a lone missile fighter, a gunship with a pair, battle 4 the capital ship boss (its escorts come from the boss script, not the waves). `classic` switches back to the old fighter-only ramp from the run formulas (kept for tests and comparison). A battle past the end of the table uses the classic formulas.

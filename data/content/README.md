# data/content

Content data (not tuning, not looks): trait definitions and names (prototype 3) and, for prototype 5, the enemy roster.

- `enemies.ts` lists the enemy kinds; one file per kind in `kinds/` (`fighter.ts` track A, `gunship.ts` track A, `lancer.ts` track B, `capital.ts` track C). Validated when loaded (bad data throws).
- `capital.ts`: the capital ship's parts (track C; empty until then).
- `battles.ts`: the authored ramp, one entry per battle (waves of groups, turrets, optional boss). Types and validation: `src/core/enemies`. The run reads it (`battleDefOf` in `core/run/run.ts`) while the tuning toggle `run.ramp` is `authored` (the default); `classic` switches back to the old fighter-only ramp built from the run formulas (kept for tests and comparison). A battle past the end of the table uses the classic formulas.

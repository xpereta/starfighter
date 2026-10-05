# data/content

Content data (not tuning, not looks): trait definitions and names (prototype 3) and, for prototype 5, the enemy roster.

- `enemies.ts` lists the enemy kinds; one file per kind in `kinds/` (`fighter.ts` track A, `gunship.ts` track A, `lancer.ts` track B, `capital.ts` track C). Validated when loaded (bad data throws).
- `capital.ts`: the capital ship's parts (track C; empty until then).
- `battles.ts`: the authored ramp, one entry per battle (waves of groups, turrets, optional boss). Types and validation: `src/core/enemies`. Nothing reads it yet; today's values equal the run formulas, and a test keeps them equal until track A switches the run over.
- `kinds/lancer.ts` also holds `LANCER_RAMP` (lancers per wave of battles 3 and 4, used behind `tuning.lancer.inBattles` until the battle table spawns kinds).

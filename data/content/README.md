# data/content

Content data (not tuning, not looks): trait definitions and names (prototype 3) and, for prototype 5, the enemy roster.

- `enemies.ts` lists the enemy kinds; one file per kind in `kinds/` (`fighter.ts` track A, `gunship.ts` track A, `lancer.ts` track B, `capital.ts` track C). Validated when loaded (bad data throws).
- `capital.ts`: the capital ship's parts (track C): turrets, engines, plates, bridge, core, validated at load by `validateCapitalParts`; the numbers in it are starting defaults with notes in the file header.
- `battles.ts`: the authored ramp, one entry per battle (waves of groups, turrets, optional boss). Types and validation: `src/core/enemies`. Nothing reads the waves yet; today's values equal the run formulas (battles 1 to 3), and a test keeps them equal until track A switches the run over. Row 4 is the capital ship boss (`boss: 'capital'`), which the run already reads.

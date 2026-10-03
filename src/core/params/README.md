# core/params

- **Purpose:** the one convention for tunable parameters: `ParamDef` (default, min, max, unit) plus validation that fails loudly.
- **Used by:** every module's tuning file in `data/tuning/` (`defaultsOf(defs)` gives the typed defaults).
- **Units:** world units (u), seconds (s), radians internally; say the unit in each `ParamDef`.
- **Test:** `params.test.ts`.

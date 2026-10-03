# dev

- **Purpose:** tuning panel and debug overlay, so feel can be tuned live (including on preview URLs). Not gameplay code: nothing in `src/core` imports it.
- **Loading:** a separate lazy chunk. It loads with `?dev` in the URL (always in `npm run dev`). Build with `VITE_DEV_TOOLS=false npm run build` to strip it from the bundle entirely (release builds).
- **Panel (`panel.ts`, lil-gui):** generated from the parameter definitions in `data/tuning` (range and unit from the definition). Groups: Flight, Evade, Guns, Camera, plus the toggles (steering scheme, evade sidestep, look-ahead mode, shake). Pool-size parameters (`bulletCap`) are not shown: they only apply when the world is created.
- **Presets (`presets.ts`, pure and tested):** save/load by name in browser storage, export/import as a versioned JSON file (validated: unknown keys and out-of-range values are rejected loudly), reset to defaults. **Copy as defaults** copies a list of every value that differs from the committed defaults (`flight.grip: 6 -> 9`); paste it to Claude to commit them into `data/tuning`.
- **Debug overlay (`debug-overlay.ts`, toggle with `` ` `` or the panel):** nose vs velocity vectors, turn-rate curve with the current point, camera center and safe frame, hit circles (targets, bullets, enemy shots, ship), fps/frame time, entity counts.
- **Reads/writes:** edits `world.tuning` in place; reads `world` for the overlay.
- **Test:** `presets.test.ts`; the e2e test checks that the panel is absent without `?dev`, loads with it, and logs no errors.

# ui

- **Purpose:** the screens and text of a run (spec: `docs/specs/prototype-3-pilots.md` sections 4 and 5): the Start, Debrief and End menus (controller-first), the chatter feed, the squad roster and the objective line.
- **Status:** menus done (issue B2). Chatter and roster come with issue B3.
- **Contract:** menus read `world.run` (`phase`, `cursor`, `battle`, `result`) and `world.pilots`, and change the game only through the `menu*` actions (`menuUp/Down/Select/Back`, edge-triggered by `stepRun`), so replays record every menu choice. Pure menu state logic lives apart from the DOM drawing, so it is unit-tested. Chatter and the roster are presentation only: they are not in the replay hash.
- **Files:**
  - `menu-model.ts`: pure. `menuDataFromWorld(world, extras)` is the one adapter from the world to `MenuData`; `startScreen`, `debriefScreen`, `endScreen` and `buildScreen` turn that into a `MenuScreen` (title, lines, items, cursor). `menuVisible` is true only in run mode outside the battle phase, so practice never shows a menu. Candidates and selected veterans come from `world.run` when Track A provides them, otherwise from `extras`; the limits come from `run.battleCount`, `pilots.squadMax` and `pilots.veteransPerRun`, with the spec defaults until those exist.
  - `menu-nav.ts`: pure. Edge detection, wrapping cursor movement and `maskFlightActions` (clears steering, guns, evade, launch, orders, respawn and trial while a menu is up, keeps the menu buttons).
  - `menu-view.ts`: the DOM overlay (`#run-menu`). Display only, CSS-sized, rebuilt only when the screen data changes. Marks are text (`>` for the highlight, `[x]`/`[ ]` for ticks), not colour alone.
- **Wiring:** `app/main.ts` creates the view with a `getExtras` callback (veterans and best run, empty until the meta module exists) and masks the flight actions while `menuVisible`.

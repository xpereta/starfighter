# ui

- **Purpose:** the screens and text of a run (spec: `docs/specs/prototype-3-pilots.md` sections 4 and 5): the Start, Debrief and End menus (controller-first), the chatter feed, the squad roster and the objective line.
- **Status:** contract placeholder. Issues B2 (menus) and B3 (chatter and roster) fill it in.
- **Contract:** menus read `world.run` (`phase`, `cursor`, `battle`, `wave`, `result`) and `world.pilots`, and change the game only through the `menu*` actions (`menuUp/Down/Select/Back`, edge-triggered by `stepRun`), so replays record every menu choice. Pure menu state logic lives apart from the DOM drawing, so it is unit-tested. Chatter and the roster are presentation only: they are not in the replay hash.

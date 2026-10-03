# render

- **Purpose:** draw core state with Three.js: orthographic camera, flat silhouettes, limited palette, 3-layer parallax stars plus speed streaks. Renderer reads core state; core never imports it.
- **Reads:** `world.ship`, `world.tuning.flight` (speed range). **Writes:** nothing in core.
- **Palette:** `palette.ts` (friendly, enemy types, projectiles; high contrast on the dark background).
- **View:** `viewSize` keeps the same visible world _area_ as the 1280x800 reference on any screen shape. The camera center, zoom and shake come from `world.camera` (`core/camera`).
- **Background:** `background.ts` tiles a seeded star pattern 3x3 per layer; `layerShift` keeps it around the camera. Dust streaks fade in above half speed. No allocation per frame.
- **Enemy fighters:** `fighters.ts` draws one swept-dart mesh per fighter slot (created on demand, hidden while dead, squashed during an evade roll). The HUD gives fighters a larger notched edge arrow; the debug overlay shows their hit circles.
- **Guns:** `bullets.ts` draws every bullet with one `InstancedMesh` sized to the pool cap; `sparks.ts` is a visual-only pooled consumer of `Hit` events (`renderer.consumeEvents`, called once per step by the app).
- **HUD:** `hud/hud.ts` is a 2D canvas overlay (speed bar with min/corner/cruise/max markers, throttle state, evade cooldown, kills/hits, time-trial readout, arena warning, edge arrows). All placement math is in `hud/layout.ts` (pure, tested); tuning in `data/tuning/hud.ts`.
- **Test:** `hud/layout.test.ts` (edge-arrow placement, distance style, speed bar); `view.test.ts` (parallax/streak math); `core/camera/view.test.ts` covers `viewSize`; the Playwright smoke test covers canvas/console errors.

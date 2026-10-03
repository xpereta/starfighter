# render

- **Purpose:** draw core state with Three.js: orthographic camera, flat silhouettes, limited palette, 3-layer parallax stars plus speed streaks. Renderer reads core state; core never imports it.
- **Reads:** `world.ship`, `world.tuning.flight` (speed range). **Writes:** nothing in core.
- **Palette:** `palette.ts` (friendly, enemy types, projectiles; high contrast on the dark background).
- **View:** `viewSize` keeps the same visible world _area_ as the 1280x800 reference on any screen shape. The camera currently centers on the ship; issue #6 replaces that with `core/camera`.
- **Background:** `background.ts` tiles a seeded star pattern 3x3 per layer; `layerShift` keeps it around the camera. Dust streaks fade in above half speed. No allocation per frame.
- **Test:** `view.test.ts` (pure math); the Playwright smoke test covers canvas/console errors. Pooled/instanced bullet meshes arrive with the guns issue (#7).

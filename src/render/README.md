# render

- **Purpose:** draw core state with Three.js: orthographic camera, flat silhouettes, limited palette, 3-layer parallax stars plus speed streaks. Renderer reads core state; core never imports it.
- **Reads:** `world.ship`, `world.tuning.flight` (speed range). **Writes:** nothing in core.
- **Palette:** `palette.ts` (friendly, enemy types, projectiles; high contrast on the dark background).
- **View:** `viewSize` keeps the same visible world _area_ as the 1280x800 reference on any screen shape. The camera center, zoom and shake come from `world.camera` (`core/camera`).
- **Background:** `background.ts` tiles a seeded star pattern 3x3 per layer; `layerShift` keeps it around the camera. Dust streaks fade in above half speed. No allocation per frame.
- **Guns:** `bullets.ts` draws every bullet with one `InstancedMesh` sized to the pool cap; `sparks.ts` is a visual-only pooled consumer of `Hit` events (`renderer.consumeEvents`, called once per step by the app).
- **Test:** `view.test.ts` (parallax/streak math); `core/camera/view.test.ts` covers `viewSize`; the Playwright smoke test covers canvas/console errors.

# render

- **Purpose:** draw core state with Three.js: orthographic camera, flat silhouettes, limited palette, 3-layer parallax stars plus speed streaks. Renderer reads core state; core never imports it.
- **Reads:** `world.ship`, `world.tuning.flight` (speed range). **Writes:** nothing in core.
- **Palette:** `palette.ts` (friendly, enemy types, projectiles; high contrast on the dark background).
- **View:** `viewSize` keeps the same visible world _area_ as the 1280x800 reference on any screen shape. The camera center, zoom and shake come from `world.camera` (`core/camera`).
- **Background:** `background.ts` tiles a seeded star pattern 3x3 per layer; `layerShift` keeps it around the camera. Dust streaks fade in above half speed. No allocation per frame.
- **Squadron:** `wingmen.ts` draws one green delta per wingman slot (hidden while shot down). The HUD shows the wingman count, the formation and the active order with its time left (`squadronReadout` in `hud/layout.ts`, pure and tested), and gives wingmen small hollow edge arrows.
- **Enemy fighters:** `fighters.ts` draws one swept-dart mesh per fighter slot (created on demand, hidden while dead, squashed during an evade roll). The HUD gives fighters a larger notched edge arrow; the debug overlay shows their hit circles.
- **Guns:** `bullets.ts` draws every bullet with one `InstancedMesh` sized to the pool cap; `sparks.ts` is a visual-only pooled consumer of `Hit` events (`renderer.consumeEvents`, called once per step by the app).
- **HUD:** `hud/hud.ts` is a 2D canvas overlay (speed bar with min/corner/cruise/max markers, throttle state, evade cooldown, kills/hits, time-trial readout, arena warning, edge arrows). All placement math is in `hud/layout.ts` (pure, tested); tuning in `data/tuning/hud.ts`.
- **Lock-on and missiles (Prototype 2, track A):**
  - `missiles.ts` draws the missile bodies (one instanced draw, the same renderer as bullets) and their trails: tapered ribbons, one mesh, no allocation per frame. Wingman missiles live in the same pool, so they look identical to the player's.
  - `missile-trails.ts` is the pure trail store: one point per simulation tick, trails keyed by the missile `uid` (pool slots move when missiles are removed), a trail keeps fading about 0.35 s after its missile is gone.
  - `hud/order-marker.ts` draws green corner brackets and "ATTACK" on the target of an active attack order (distinct from the gold lock rings; geometry tested).
  - `hud/locks.ts` is the pure placement math for lock rings and the panel (`ringRadiusPx` never goes below a readable 16 px, so rings stay visible at maximum zoom-out); `hud/locks-hud.ts` draws it: a faint full ring plus a gold clockwise sweep for the target being acquired, a solid gold ring with the lock order number for locked targets (with a dark under-stroke for contrast), and in the bottom-left column `LOCKS n/limit` plus the salvo bar (`SALVO READY` / `SALVO 2.5s` / `NO LOCK`).
  - The debug overlay adds the lock cone and a lock state label next to each target (`src/dev/lock-debug.ts`).
- **Test:** `hud/locks.test.ts` (ring placement and size, sweep angle, panel text, debug labels); `missile-trails.test.ts` (one point per tick, ring order, identity across pool swaps, fade and slot reuse); `hud/layout.test.ts` (edge-arrow placement, distance style, speed bar); `view.test.ts` (parallax/streak math); `core/camera/view.test.ts` covers `viewSize`; the Playwright smoke test covers canvas/console errors.

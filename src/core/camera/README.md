# core/camera

- **Purpose:** camera logic as pure data: zoom by speed, look-ahead, safe frame, optional shake. The renderer applies `world.camera`.
- **Reads:** `world.ship`, `world.tuning.flight` (speed range), `world.tuning.camera`, this step's `events` (shake). **Writes:** `world.camera`. The app writes `camera.aspect` each frame (core cannot read the DOM).
- **Behavior:** visible width goes from `viewMin` (min speed) to `viewMax` (max speed), smoothed by `zoomLerp`. Look-ahead offsets toward the velocity (default) or the nose, capped at `lookAheadMax` half-widths, smoothed by `lookLerp`. Safe frame keeps the ship `safeFrame` of the screen away from each edge. Shake is off by default; `ShotFired`/`Hit` add trauma, offset is a deterministic function of sim time.
- **View size:** `viewSize` keeps the same visible world area on any screen shape (1280x800 reference).
- **Not yet:** the optional "zoom out when the nearest target is far" toggle needs targets (issue #8).
- **Parameters:** `data/tuning/camera.ts`.
- **Test:** `camera.test.ts`, `view.test.ts`.

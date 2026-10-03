# Prototype 1 — Flight & Camera (spec v1, draft)

## Purpose

Answer two questions before building anything else:

1. **Is flying satisfying and worth mastering?** (pillar "Ace in the cockpit")
2. **Is the camera readable on a 1280×800 screen** (Steam Deck) while giving a strong sense of speed?

Everything not needed to answer these is out of scope. Values below are **starting defaults to tune**, not final numbers. All are parameters (typed, default, range, units) in `data/tuning/*.ts|json`, editable live in the tuning panel.

Units: world units (u), seconds (s), radians internally (degrees in the panel). Simulation at fixed 60 Hz.

## Scope

In: one player fighter · flight model · throttle · guns · evade · camera (zoom, look-ahead) · arena with targets · off-screen indicators · minimal HUD · tuning panel · debug overlay · input recording/replay · gamepad + keyboard.
Out: lock-on & missiles, wingmen, orders, enemy AI beyond simple drones, run map, pilots, audio (except optional placeholder gun sound), full craft/FX pass.

## 1. Flight model (`core/flight`)

Plane-like, not Newtonian: velocity follows the nose, with a little slide.

- **Speed**: `minSpeed` 120 u/s (can't stop — always flying) · `cruiseSpeed` 220 · `maxSpeed` 360.
- **Throttle**: RT/LT. Neutral → speed returns toward cruise (`cruiseReturnRate` 60 u/s²). RT accelerates (`accel` 180 u/s²), LT brakes (`brake` 240 u/s²).
- **Turn rate depends on speed** (the "corner speed" sweet spot): curve with peak `maxTurnRate` 200°/s at `cornerSpeed` 180 u/s, falling to ~110°/s at max speed and ~150°/s at min speed. Defined as a small editable curve (3–5 points).
- **Angular inertia**: turn rate ramps up/down (`turnAccel` 1200°/s²) so turns feel smooth, not twitchy.
- **Grip / slide**: velocity direction rotates toward the nose at `grip` (e.g. 6 /s); lower = more drift. High speed may reduce grip slightly (`gripAtMaxSpeed` 4 /s).
- **Arena boundary**: arena radius 6000 u; beyond it a soft force turns you back + a warning on HUD.

### Steering schemes (toggle in panel — we test both)

- **A. Point-to-steer** (default): left stick direction = desired heading; ship turns toward it at its turn rate. Stick magnitude below deadzone = keep heading.
- **B. Rotate**: left stick X = turn left/right (like a plane's roll/yaw), proportional to deflection.
  Keyboard: A/D or ←/→ rotate (scheme B), W/S throttle, Space guns, Shift evade.

## 2. Evade (`core/flight`)

- Button X (gamepad) / Shift. A quick roll: duration `evadeTime` 0.45 s, lateral sidestep `evadeOffset` 90 u (direction = stick side, default left), **invulnerable** during `evadeIFrames` 0.3 s, cooldown `evadeCooldown` 2.0 s, brief speed bonus +15%.
- Visible: ship silhouette squashes/rotates to suggest a roll; cooldown shown on HUD.
- Variant to test (toggle): no sidestep, only i-frames + tight break turn.

## 3. Guns (`core/weapons`)

- Hold A (gamepad) / Space. Two alternating barrels, `fireRate` 12 shots/s, `bulletSpeed` 900 u/s **+ ship velocity**, `bulletLife` 0.9 s, slight spread 0.6°.
- Bullets pooled (cap 400). Hit = small spark + `Hit{dir, impulse}` event.

## 4. Camera (`core/camera`, applied by renderer)

- **Reference resolution** 1280×800; scale to screen keeping the same visible world area per zoom.
- **Zoom by speed**: visible width from `viewMin` 1600 u (at min speed) to `viewMax` 2600 u (at max speed), smoothed (`zoomLerp` 2 /s). Toggle: also zoom out when nearest target is far (off by default).
- **Look-ahead**: camera target = ship position + `lookAhead` × speed-factor in the chosen direction (toggle: **nose** vs **velocity**; default velocity), max offset 30% of visible half-width, smoothed (`lookLerp` 3 /s) so hard turns never jerk the view.
- **Safe frame**: ship never closer than 15% to the screen edge.
- Small screen shake on firing/hits (`shake` amount, default low, toggle off).
- **Sense of speed**: parallax background — 3 layers of stars/dust at different depths; fine dust streaks at high speed.

## 5. Arena & targets

- Static **target drones** (20), **moving drones** (10) flying straight or in circles at 100–250 u/s, and 2 **turrets** that fire slow, dodgeable projectiles at the player (to practice evade).
- Drones take N hits, then break into 3–5 flat shards that drift and fade (minimal first version of the death-sequence hook; shards & counts are parameters/quality settings).
- Respawn button / auto-respawn so practice never stops.
- **Time-trial mode** (simple): "destroy all 10 moving drones" with a timer + best time → measures mastery over sessions.

## 6. HUD & readability

- Speed bar with markers for min / corner / max speed; throttle state; evade cooldown.
- **Edge indicators** for off-screen targets (arrow at screen edge, colored by type, size/opacity by distance).
- Visual style: flat silhouettes, limited palette (player friendly color, targets enemy color, projectiles high contrast).

## 7. Dev tools (dev builds only)

- **Tuning panel** (e.g. lil-gui): all flight/camera/evade/gun params, steering scheme and camera toggles; **save/load presets** as JSON; "copy as defaults" to commit tuned values.
- **Debug overlay** toggle: velocity vs nose vectors, turn-rate curve with current point, camera target & safe frame, hit circles, FPS/frame time, entity counts.
- **Replay**: record seed + inputs; play back a recording; export/import file.

## 8. Architecture notes

- `core` is pure TS, fixed timestep, seeded RNG, no Three.js/DOM imports (lint-enforced).
- Modules this prototype creates: `input`, `core/flight`, `core/weapons`, `core/camera`, `core/world` (entities, pools, events), `render`, `dev`.
- Each module gets a README contract.
- Typed events at least: `ShotFired`, `Hit`, `Killed`, `EvadeStarted`.

## 9. Tests

- Unit: speed clamps; turn-rate curve interpolation; grip aligns velocity; evade timings/cooldown; bullet inherits ship velocity; camera zoom/look-ahead math & smoothing bounds.
- Determinism: same seed + recorded inputs → identical final state.
- Simulation: 120 s of random inputs → no NaN, ship stays within arena constraints, pools never exceed caps.
- Perf (manual for now): 60 fps in browser with 400 bullets + all targets on a mid-range laptop.
- E2E smoke: page loads, canvas renders, no console errors.

## 10. Acceptance criteria

- Playable in the browser via preview URL, with gamepad and keyboard.
- All parameters above are live-tunable and savable as presets.
- Both steering schemes and both look-ahead modes selectable.
- CI green; tests above in place.

## 11. Playtest questions (for Xavi, after each tuning round)

1. Does turning feel responsive but weighty? Twitchy or sluggish?
2. Do you naturally slow down to turn tighter? Does that feel rewarding?
3. Point-to-steer vs rotate — which feels more like a pilot?
4. Can you track a moving drone and keep it in front of your nose?
5. Is evade satisfying and fair? Too strong?
6. Speed: do you _feel_ fast at max speed? Is zoom-out helpful or dizzying?
7. Look-ahead by nose or by velocity — which reads better?
8. On a small screen: can you see threats in time? Are edge indicators clear?
9. Does your time-trial time improve over sessions (mastery)?

## 12. Proposed issues (in order)

1. Scaffold + CI + preview (setup checklist B–D).
2. Fixed-timestep loop, seeded RNG, world/entities/pools, typed events.
3. Input layer: gamepad + keyboard → actions; deadzones.
4. Flight model + both steering schemes + throttle.
5. Renderer: orthographic Three.js, flat silhouettes, parallax background.
6. Camera: zoom by speed, look-ahead, safe frame, shake.
7. Guns + bullets (pooled) + hit events + sparks.
8. Targets, turrets, shards, respawn, time trial.
9. Evade.
10. HUD + edge indicators.
11. Tuning panel + presets; debug overlay.
12. Replay record/playback + determinism test + simulation test.

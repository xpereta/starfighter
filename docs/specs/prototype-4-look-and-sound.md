# Prototype 4: Look & Sound (spec v1, draft)

## Purpose
The game has no sound and no art direction yet (placeholder flat shapes and colours in `src/render/palette.ts`). Before more content, answer:
1. **Does an 80s/90s anime look and sound make the dogfight feel the way the concept wants** (pillar "Ace in the cockpit")? Hand-drawn-feeling ships, dramatic explosions, radio chatter you can hear.
2. **Can Xavi change the look and the sound himself, quickly,** by editing data or turning panel knobs, without touching code?

The second question is the main one: this prototype builds **the plumbing to iterate**, plus a first considered pass on the things that matter most. Values are starting points; everything is data or a typed parameter (default, range, short unit, plain-language note), live in the tuning panel. Core stays untouched: look and sound only **listen to events and read state**; replays and the state hash are unchanged.

## Decisions taken (Xavi, 2026-10-05)
- **References:** 80s and 90s anime: spaceship design, kinds of explosions, art style (cel look, hard shadows, bold outlines, speed lines, flash frames).
- **Approach:** a minimal, swappable first pass, then one considered pass at a time (explosions and ship silhouettes first).

## Scope
In: art direction doc · theme data and panel presets · ship/enemy silhouettes redrawn in the reference style · explosion kinds · screen flash/shake/hit-stop style · sound system driven by events with a data table · synthesised placeholder sounds · volume/mute · music slot (one looping track, optional).
Out: final art and music assets · voice acting · cutscenes or portraits · 3D models · localisation · per-level backdrops beyond one background.

## 1. Art direction doc (`docs/art-direction.md`)
One page, written first and kept short: mood, palette families (3 to 4 named palettes), line weight and outline rules, shading rules (flat cel with one hard shadow tone, no gradients except glows), silhouette language per faction (player/wingmen: clean, nose-forward, white and primary accent; enemies: angular, asymmetric, one eye or sensor), explosion vocabulary (below), UI style, and the reference list (titles and what to take from each). Xavi supplies or approves the references; I propose and he edits.

## 2. Theme data (`data/theme/*.ts`, `render/theme`)
- A **theme** is typed data: palettes (named colours), outline width and colour, shadow tone share, glow strength, per-entity colours (player, wingman, enemy, pod, bullets, missiles, UI), explosion colours, background colours and star styles.
- `render` reads the theme instead of hard-coded colours (`palette.ts` becomes a thin reader). A theme is validated at load like parameters (valid colours, ranges).
- The panel gets a **Look** section: pick a theme preset, tweak the main colours and outline width live; save and load themes as JSON like tuning presets. Several themes ship (current flat look as `plain`, plus the first anime-style one).

## 3. Silhouettes (`render/ships`)
Ships are drawn from **data shape definitions** (polygons, outline, one shadow shape, engine glow points) rather than code: `data/theme/ships.ts` with a shape per kind (player, wingman, fighter, drone, turret, pod). First pass: player and fighter in the anime style; the rest get matching quick versions. Shapes are validated (closed, bounded). Engine glow and a thin speed trail follow speed.

## 4. Explosions and impact style (`render/fx`)
A small set of **explosion kinds** as data (shape, colour ramp, size, duration, flash frames, debris count), chosen by event and entity:
- **Hit spark:** short sharp starburst (bullets hitting).
- **Small kill:** quick round flash, white then colour, with ring and a few shards.
- **Big kill / turret:** large layered burst, shockwave ring, hard-edged smoke puffs, lingering debris.
- **Missile hit:** bright flash with cross flare.
- **Player or pilot loss:** bigger, slower, with a screen flash frame and a short hit-stop (render-only freeze of drawing, never of the simulation).
- Screen effects (render-only): flash frame on big kills, chromatic edge on player hit, optional speed lines at high speed. All parameters, all off-able.

## 5. Sound (`src/audio`)
- **Listens to events** (`ShotFired`, `Hit`, `Killed`, `LockAcquiring/Acquired/Lost`, `MissileLaunched`, `SalvoFired`, `EvadeStarted`, `OrderGiven`, `BattleStarted/Cleared`, `PodSpawned/Rescued/Lost`, `PilotLost`, `RunEnded`, plus pause) and plays sounds from a **data table** `data/audio/sounds.ts`: event → sound (kind, base pitch, pitch randomness, volume, minimum gap, max voices, optional position for stereo pan and distance fade).
- **Placeholder sounds are synthesised** with Web Audio (oscillator and noise recipes as data: waveform, envelope, filter, sweep), so no files are needed and Xavi can edit the recipe. A sound can instead point at a sample file (`data/audio/`), so real assets drop in later without code changes.
- **Mix:** master, effects and music volume as parameters; mute key (M); the audio context starts after the first key press (browser rule); pausing the game pauses the effects.
- **Music slot:** one looping track (file or simple synthesised loop) with its own volume and a ducking amount while chatter or big explosions play.
- Audio never touches `src/core`; it has its own panel section **Sound** (volumes, per-sound volume and pitch) and a **sound test** list in the panel to play each sound.

## 6. Dev tools
Look and Sound panel sections as above; presets for both; a "screenshot-friendly" toggle that hides the HUD and dev overlays; a replay can be watched with any theme (the theme never affects the simulation).

## 7. Tests
- Theme and sound tables validate (colours, ranges, every event has a sound entry or an explicit "silent").
- Shape definitions are valid (closed polygons, bounded size).
- Determinism: a replay's final hash is identical with every theme and with audio on or off.
- Audio: a fake audio backend records which sounds the events trigger and checks pitch/volume bounds, minimum gaps and max voices.
- e2e: the page loads with each shipped theme without console errors; the Look and Sound sections exist; the mute key toggles.

## 8. Issues and tracks
Contract first (small PR): theme types and loader, the event→sound table type, panel sections skeleton, `docs/art-direction.md` outline. Then two parallel tracks:
- **Track Look:** theme reader, ships, explosions and screen effects, presets.
- **Track Sound:** audio engine, synthesised recipes, event table, mix, music slot, sound test.
Then one integration issue (everything together, tuning pass, e2e).

## 9. Feel questions for Xavi
Does the anime look read clearly at speed? Are explosions satisfying without hiding the fight? Is the sound busy or sparse, and is anything annoying after ten minutes? Which reference titles should the next pass lean on more?

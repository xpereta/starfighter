# Prototype 4: Look & Sound (spec v1, draft)

## Purpose
The game has no sound and no art direction yet (placeholder flat shapes and colours in `src/render/palette.ts`). Before more content, answer:
1. **Does an 80s/90s anime look and sound make the dogfight feel the way the concept wants** (pillar "Ace in the cockpit")? Hand-drawn-feeling ships, dramatic explosions, radio chatter you can hear.
2. **Can several art directions live side by side and be branched, compared and repeated from this state?**
3. **Can Xavi change the look and the sound himself, quickly,** by editing data or turning panel knobs, without touching code?

The second and third questions are the main ones: this prototype builds **the plumbing to iterate**, plus a first considered pass on the things that matter most. Values are starting points; everything is data or a typed parameter (default, range, short unit, plain-language note), live in the tuning panel. Core stays untouched: look and sound only **listen to events and read state**; replays and the state hash are unchanged.

## Decisions taken (Xavi, 2026-10-05)
- **References:** 80s and 90s anime: spaceship design, kinds of explosions, art style (cel look, hard shadows, bold outlines, speed lines, flash frames).
- **Many directions:** art style is a swappable, forkable **style pack**; several directions can exist side by side, each on its own branch, and the process is written down and repeatable from a frozen `art-baseline` tag.
- **Approach:** a minimal, swappable first pass, then one considered pass at a time (death sequences and ship silhouettes first). Every explosion is unique: ships break into parts, each with secondary explosions and lingering debris (as already written in the concept).

## Scope
In: art direction doc · theme data and panel presets · ship/enemy silhouettes redrawn in the reference style · unique death sequences (ships break into parts, secondary explosions, lingering debris) · explosion kinds · screen flash/shake/hit-stop style · sound system driven by events with a data table · synthesised placeholder sounds · volume/mute · music slot (one looping track, optional).
Out: final art and music assets · voice acting · cutscenes or portraits · 3D models · localisation · per-level backdrops beyond one background.

## 1. Art direction doc (`docs/art-direction.md`)
One page, written first and kept short: mood, palette families (3 to 4 named palettes), line weight and outline rules, shading rules (flat cel with one hard shadow tone, no gradients except glows), silhouette language per faction (player/wingmen: clean, nose-forward, white and primary accent; enemies: angular, asymmetric, one eye or sensor), explosion vocabulary (below), UI style, and the reference list (titles and what to take from each). Xavi supplies or approves the references; I propose and he edits.

## 2. Style packs: many art directions side by side (`data/styles/<id>/`)
The unit of art direction is a **style pack**: one self-contained folder with everything that makes a look and sound, so any number of directions can live next to each other, be compared, forked, or thrown away without touching code or each other.
- **A pack contains:** `style.ts` (manifest: id, name, one-line intent, parent style if forked, the references used and what was taken from each, status `idea | active | shelved`, notes) · `theme.ts` (palettes, outline width and colour, shadow share, glow, per-entity colours, background) · `ships.ts` (shape per kind) · `deaths.ts` (death sequences) · `explosions.ts` (explosion kinds) · `sounds.ts` (event to sound recipes or sample files) · optional `assets/` (samples, images).
- **The style contract** (`src/render/style.ts`, validated at load like parameters): the full list of things a pack must provide. A pack that misses something falls back to the matching part of `plain` and says so in the console and the panel, so a half-finished idea still runs.
- **Core code never knows which style is active.** `render` and `audio` read the active pack through one accessor; no pack-specific code anywhere else. Adding a direction means adding a folder (and one line in the registry), nothing more.
- **Choosing a style:** `?style=<id>` in the URL (so each preview link can show a different one), a Style picker at the top of the panel's Look section, and the choice remembered per browser. The Look and Sound panel sections edit the active pack live; **Save style** exports the edited pack as a file you drop into `data/styles/`, like tuning presets.
- **Shipped packs:** `plain` (today's flat look and silence, kept forever as the safe baseline and the fallback) and the first anime pack. Further directions are new folders.
- **Compare:** a panel action to flip between two styles instantly (hold a key to peek at the other), and a screenshot-friendly mode (HUD and dev overlays hidden) to capture the same moment in two styles.

## 2b. Repeatable art direction process (`docs/art-direction-process.md`)
So the work can be redone from this state in the future, the recipe is written down and the starting point is frozen:
- **Frozen starting point:** a git tag `art-baseline` on the commit that has the style contract, `plain` and the tooling, but no anime pack. Any new direction starts from that tag (or from any earlier style it forks), so a clean start is always one command away.
- **The process, as steps:** 1. write the intent and gather references in the manifest; 2. copy `plain` (or fork an existing pack) into a new folder; 3. edit theme, then ship shapes, then death sequences and explosions, then sounds, checking each in the panel; 4. run the style checks (below); 5. open a PR for the pack on its own branch `style/<id>`; 6. play, record notes in the manifest, set status. Each step lists what to look at and who decides.
- **Branches:** each direction is a branch `style/<id>` and a PR that only adds or changes files under its own `data/styles/<id>/` (plus the registry line), so directions never conflict and can be merged, kept as branches, or dropped independently. The shared plumbing (the contract, panel, renderer) changes only in its own PRs.
- **Reuse:** a pack can inherit from a parent and override only some files (for example the same ships with a different palette and sounds), so variations are cheap.
- **Style checks (run for every pack, automatically):** the manifest and files validate; every ship kind, explosion kind and event has an entry or an explicit "silent"; shapes are closed and bounded; the replay hash is identical under every style and with audio on or off; the page loads with each style without console errors.
- **Agent recipe:** the doc also contains a ready-to-use prompt for an agent to build a new pack from the baseline given an intent and references, so a new direction can be started in one go.

## 3. Silhouettes (`render/ships`)
Ships are drawn from **data shape definitions** (polygons, outline, one shadow shape, engine glow points) rather than code: `ships.ts` in the style pack, with a shape per kind (player, wingman, fighter, drone, turret, pod). First pass: player and fighter in the anime style; the rest get matching quick versions. Shapes are validated (closed, bounded). Engine glow and a thin speed trail follow speed.

## 4. Death sequences, explosions and debris (`render/fx`)
This builds on what the concept already asks for (`concept.md` "Craft & detail"; decision 2026-10-02): **an enemy death is not one explosion; the ship breaks apart into pieces, with explosions of different sizes, some at once and some delayed; every death is different; debris lingers for a while.** Today only the first step exists (random shards, `render/shards.ts`).
- **Each ship kind has a death sequence definition (data, `deaths.ts` in the style pack):** how many pieces it breaks into (cut from its own silhouette along seeded fracture lines, so the pieces match the ship), the primary explosion (kind, size), and a list of **secondary explosions** (count, size range, delay range, attached to a piece or to the wreck), plus debris (lifetime, drift, spin, fade) and an optional last big blast.
- **Every death is unique:** the sequence is *rolled* from the definition with a seeded random stream tied to the world seed and the event, so the same replay shows the same deaths, and two kills never look the same (different fracture lines, piece count, delays, sizes, directions). The hit direction and impulse and the ship's speed shape the break-up (pieces fly along the blow; a fast ship's wreck keeps its momentum).
- **Pieces keep going:** each piece drifts and spins, can trail smoke or flame, and **explodes again on its own timer** (small secondary bursts, occasionally a chain: one piece's blast pushes a neighbour). Bigger ships get longer, heavier sequences (a turret or later a capital ship: many pieces, long chain, a final blast).
- **Debris lingers** (fades and stays low-contrast so it never hides ships or bullets), within hard pool caps and the Low/Medium/High quality presets from the architecture rules.
- **Explosion kinds** (data: shape, colour ramp, size, duration, flash frames) used by sequences and by other events, in the anime vocabulary: hit spark (sharp starburst), small round flash with ring, large layered burst with shockwave ring and hard-edged smoke puffs, missile hit with cross flare, and a bigger slower one for the player or a pilot.
- **Wingman and player deaths** use the same system with a heavier, more dramatic sequence (and the screen flash frame below).
- **Screen effects** (render-only, all parameters, all off-able): flash frame on big blasts, a short hit-stop in drawing only (never the simulation), chromatic edge on a player hit, optional speed lines at high speed.
- **Performance and determinism:** pieces and explosions live in pooled flat arrays; the roll uses its own seeded stream (never the simulation's), so it cannot change replays or the hash.

## 5. Sound (`src/audio`)
- **Listens to events** (`ShotFired`, `Hit`, `Killed`, `LockAcquiring/Acquired/Lost`, `MissileLaunched`, `SalvoFired`, `EvadeStarted`, `OrderGiven`, `BattleStarted/Cleared`, `PodSpawned/Rescued/Lost`, `PilotLost`, `RunEnded`, plus pause) and plays sounds from the active style pack's **data table** `sounds.ts`: event → sound (kind, base pitch, pitch randomness, volume, minimum gap, max voices, optional position for stereo pan and distance fade).
- **Placeholder sounds are synthesised** with Web Audio (oscillator and noise recipes as data: waveform, envelope, filter, sweep), so no files are needed and Xavi can edit the recipe. A sound can instead point at a sample file (`data/audio/`), so real assets drop in later without code changes.
- **Mix:** master, effects and music volume as parameters; mute key (M); the audio context starts after the first key press (browser rule); pausing the game pauses the effects.
- **Music slot:** one looping track (file or simple synthesised loop) with its own volume and a ducking amount while chatter or big explosions play.
- **Addendum (realistic direction, 2026-10-05):** beyond event sounds, a pack has **loops**: continuous sounds that follow game values (engine hum by speed and throttle, afterburner, wind-like rumble, rescue-progress tone, low-hull alarm, arena-edge alarm), each with volume and pitch curves and smooth fades. Synthesis gained optional layers of grit and space (hold, detune, distortion, tremolo, pink and brown noise, per-sound reverb send and pre-delay, distance low-pass, lag and wetness) on a shared generated reverb, and every action now has an event (enemy and wingman shots, player damage, wingman hit and down, missile impact, arena edge, respawn, menu navigation). The pack `realistic` (`data/styles/realistic/`) is the believable sound-design set and the default for packs without sounds.
- Audio never touches `src/core`; it has its own panel section **Sound** (volumes, per-sound volume and pitch) and a **sound test** list in the panel to play each sound.

## 6. Dev tools
Look and Sound panel sections as above; presets for both; a "screenshot-friendly" toggle that hides the HUD and dev overlays; a replay can be watched with any theme (the theme never affects the simulation).

## 7. Tests
- The style checks of section 2b run over every pack in `data/styles/`. Theme and sound tables validate (colours, ranges, every event has a sound entry or an explicit "silent").
- Shape definitions are valid (closed polygons, bounded size).
- Determinism: a replay's final hash is identical with every theme and with audio on or off.
- Audio: a fake audio backend records which sounds the events trigger and checks pitch/volume bounds, minimum gaps and max voices.
- e2e: the page loads with each shipped theme without console errors; the Look and Sound sections exist; the mute key toggles.

## 8. Issues and tracks
Contract first (small PR): the style contract and loader, `plain` as a pack, the registry and `?style=`, the event→sound table type, panel sections skeleton, `docs/art-direction.md` and `docs/art-direction-process.md` outlines. Once it is merged I tag `art-baseline`. Then two parallel tracks:
- **Track Look:** style reader, ships, death sequences (fracture, secondary explosions, debris), explosion kinds, screen effects, presets.
- **Track Sound:** audio engine, synthesised recipes, event table, mix, music slot, sound test.
Then one integration issue (everything together, tuning pass, e2e).

## 9. Feel questions for Xavi
Does the anime look read clearly at speed? Is every death different enough, and are the break-ups and secondary explosions satisfying without hiding the fight? Is the sound busy or sparse, and is anything annoying after ten minutes? Which reference titles should the next pass lean on more?

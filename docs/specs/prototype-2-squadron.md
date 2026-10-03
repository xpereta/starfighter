# Prototype 2: Lock-on, Salvos & Wingmen (spec v1, draft)

## Purpose
Answer two questions before building the run structure (concept §9, risks 3 and 4):
1. **Does "you lock, the squadron fires" feel great, and does your own skill stay central?** (pillar "Ace in the cockpit")
2. **Is wingman AI useful, readable, not stealing the show, and not suicidal?** (pillar "Fast tactics, no pauses")

Everything not needed to answer these is out of scope. Values are **starting defaults to tune**, not final numbers; all are parameters (typed, default, range, short unit, plain-language note) in `data/tuning/*.ts`, live in the tuning panel. Units: world units (u), seconds (s), radians internally (degrees in the panel). Fixed 60 Hz, seeded RNG, deterministic (replays must still match).

## Decisions taken (Xavi, 2026-10-03)
- **Stacked locks, you fire.** Holding enemies in your nose cone builds locks one by one, up to 1 + number of living wingmen. Pressing the launch button once fires the salvo: each pilot launches one missile at one locked target.
- **Scope:** lock-on, missiles, wingmen, the 3 orders, and one enemy fighter type that fights back. No pilot names/traits/chatter (Prototype 3), no run map.

## Scope
In: lock-on cone and lock set · missiles and salvo · one enemy fighter AI · 0-4 wingmen with simple AI · 3 orders (tight / spread / attack my target) · HUD for locks, salvo, formation and orders · tuning panel groups, debug overlay additions, replay/determinism coverage · a test arena scenario (waves of enemy fighters, N wingmen).
Out: pilot identity, rescue/recruitment, run map, capital ships, more enemy types, missile countermeasures, audio, the craft-and-detail pass beyond the hooks below.

## 1. Lock-on (`core/lockon`)
Mostly automatic: governed entirely by where the nose points.
- **Cone:** half-angle `coneHalfAngle` 14°, max range `lockRange` 1500 u, in front of the nose. Candidates: living enemy fighters, drones, turrets, statics.
- **Acquiring:** one target is acquired at a time: the candidate nearest to the nose axis. While it stays in the cone its progress fills over `lockTime` 1.0 s. When full it joins the **lock set** and the next candidate (not already locked) starts filling.
- **Lock set:** at most `maxLocks` = 1 + living wingmen (cap 5). Order of acquisition = priority. When the set is full, acquiring pauses.
- **Losing locks:** a target outside the cone for longer than `lockGrace` 0.4 s, beyond `lockRange`, or dead is dropped (an acquiring target resets its progress). Locks persist while the target is in the cone or within grace, so you must keep flying at them.
- **Events:** `LockAcquiring{targetId}`, `LockAcquired{targetId}`, `LockLost{targetId, reason}`.
- Pure data on `world.lockon`; no rendering knowledge.

## 2. Missiles and salvo (`core/weapons`)
- **Launch:** button B / key E. Needs at least one lock and the salvo off cooldown (`salvoCooldown` 4 s from launch). Each **pilot** (the player plus each living wingman) launches one missile; missiles are assigned to locked targets round-robin in lock order (more pilots than locks: extra missiles double up from the top). Missiles leave `salvoStagger` 0.10 s apart, so a salvo reads as a ripple.
- **Wingmen fire:** a wingman's missile spawns from the wingman, not the player.
- **Missile motion (hooks for the craft pass, data-driven):** starts at `launchSpeed` 200 u/s plus the launcher's velocity component, accelerates at `missileAccel` 600 u/s² to `missileMaxSpeed` 750 u/s; homing turn rate `missileTurnRate` 160°/s toward its target; a small seeded wobble (`wobbleAmount` 3°, `wobbleHz` 5) added to heading; life `missileLife` 4.5 s. If its target dies it flies on straight and expires.
- **Hit:** radius `missileRadius` 14 u, damage `missileDamage` 4 hp, `Hit{dir, impulse}` event with a bigger impulse than guns. A missile that reaches `missileLife` expires with no effect.
- Pooled (cap `missileCap` 64), no allocation per frame. Events: `SalvoFired{count}`, `MissileLaunched{x, y, angle, targetId}`.

## 3. Enemy fighter (`core/ai`)
A basic fighter that makes the dogfight real. It uses the **same flight model** as the player (driven by AI-produced actions), with its own `FlightConfig` (about 85% of the player's turn rate, slightly lower top speed).
- **Behavior:** pick the nearest target among the player and wingmen (re-evaluated every `retargetInterval` 1.5 s); steer to put its nose on a lead point; fire guns when the target is inside `fireCone` 7° and `fireRange` 900 u (slower bullets than the player: `enemyBulletSpeed` 600 u/s); when hit by 2 bullets within 1 s or locked by the player, break away (hard turn plus a short evade) for `breakTime` 1.2 s. Stays inside the arena (reuses the boundary push).
- **Stats:** `hp` 3 (a missile kills it), radius 28 u. Dies with `Killed{kind: 'fighter'}`, shards through the existing FX consumer.
- **Spawning (test scenario):** waves of `waveSize` 4 fighters spawn at the arena edge; the next wave spawns `waveDelay` 6 s after the last fighter dies. Existing drones, statics and turrets stay available behind a toggle.
- Silhouette distinct from drones (readable at a glance), enemy color family.

## 4. Wingmen (`core/squadron`)
0-4 wingmen (test arena default 2; `wingmanCount` parameter). Each flies with the same flight model, driven by AI actions.
- **Formation slots** relative to the player's heading: **tight** (defend me): two behind-left/right at ~`tightRadius` 160 u, further ones stacked behind; **spread** (cover area): ring around the player at `spreadRadius` 650 u. Wingmen steer to their slot with a speed match (they can fall behind and catch up), and avoid colliding with the player and each other (`separation` 120 u).
- **Guns:** each wingman fires at any enemy inside its `fireCone` 8° and `fireRange` 800 u, with reduced damage so the player's aim still matters (`wingmanGunDamage` 0.6). Friendly bullets and missiles never hurt friends (no friendly fire in this prototype).
- **Engaging:** in tight they only engage enemies near the player (`tightEngageRange` 700 u); in spread they engage anything within `spreadEngageRange` 1100 u, then return to their slot.
- **Attack my target:** see orders.
- **Losses:** `hp` 3, hit by enemy bullets; `Killed{kind: 'wingman'}`. In the test arena a fallen wingman returns after `wingmanRespawnDelay` 12 s so practice never stops (in a real run it would be a lost pilot: Prototype 3).
- Friendly color, distinct from the player's silhouette.

## 5. Orders
- **LB / key Q: cycle formation** tight ↔ spread. **RB / key F: attack my target:** for `attackOrderTime` 8 s every wingman pursues and fires at the player's first locked target (or, with no locks, the enemy nearest the nose); it ends early if the target dies, then they return to the current formation. A second press cancels.
- One button each, no menus, no pauses. `OrderGiven{order}` event.
- Controller map is the concept's draft: A guns · B launch · X evade · RB attack my target · LB cycle formation.

## 6. HUD and readability
- **Lock rings** on targets: acquiring = thin ring filling clockwise; locked = solid ring with a small order number; they must stay readable at max zoom-out and on 1280×800.
- **Lock/salvo panel:** `LOCKS 2/3`, salvo ready / cooldown bar, formation (TIGHT/SPREAD) and active order with its time left.
- **Edge indicators:** wingmen get friendly-color arrows (smaller, distinct shape); enemy fighters a distinct enemy arrow.
- **Missiles:** small elongated body plus a short fading trail; wingman missiles visually identical to the player's.
- Wingman and enemy status are shown only when useful (no text clutter in combat).
- Palette and shapes keep faction readable by silhouette and color (concept §5).

## 7. Dev tools
- Tuning panel groups: Lock-on, Missiles, Enemy fighter, Wingmen (all with plain-language notes), plus scenario toggles (wingman count, wave size, drones on/off).
- Debug overlay additions: lock cone and acquisition progress, per-target lock state, AI intent lines (target and lead point), formation slots, missile target lines.
- **Replay/determinism:** `hashWorld` must include all new state (lock set, missiles, enemy fighters, wingmen, squadron state). New gameplay state not in the hash is a bug.

## 8. Architecture notes
- New modules: `core/lockon`, `core/squadron`, `core/ai`; missiles extend `core/weapons`. Each gets a README contract. Rendering in `render/` reads state only. `core` stays free of three/DOM (lint).
- **Shared contract (landed first, in one small PR, so the two tracks do not collide):** new actions (`launch`, `attackOrder`, `cycleFormation`) with input mapping; event types listed above; `Killed.kind` extended with `'fighter' | 'wingman'`; `world` fields (`lockon`, `missiles`, `fighters`, `squadron`) with empty implementations and their slots in `stepWorld`'s fixed order; empty tuning groups; palette entries; `hashWorld` extended as state is added.
- `stepWorld` order after this prototype: input edges, flight (player), enemy AI + fighters, squadron AI + wingmen, lock-on, guns and missiles, bullets and missiles hits, kills, targets, enemy shots, waves, trial, camera.

## 9. Tests
- Unit: cone geometry; acquisition order and progress; lock limit and priority; lock grace and range loss; target death; salvo assignment (more pilots than locks, fewer, none); missile acceleration, homing turn limit, wobble determinism, expiry; fighter targeting, firing cone, break-away; formation slot math and separation; order timing and cancel; edge-triggered buttons.
- Determinism: same seed + inputs → identical final state with enemies, wingmen and missiles.
- Simulation: 120 s of seeded random inputs with 2 wingmen and waves: no NaN, pools within caps, ships inside arena limits, wingmen mostly survive when the player is competent scripted bot.
- E2E smoke: page loads, no console errors, panel groups present.
- Manual: 60 fps with a full salvo, 6 fighters, 4 wingmen, 400 bullets on a mid-range laptop.

## 10. Acceptance criteria
- Playable on the preview URL with gamepad and keyboard: lock several enemies, fire a salvo with wingmen, give both orders.
- All parameters above live-tunable and savable as presets; replay of a dogfight reproduces exactly.
- CI green; tests above in place.

## 11. Playtest questions (for Xavi)
1. Does stacking locks feel like painting targets for a strike? Is 1.0 s per lock right?
2. Does the salvo feel earned, and does the squadron's missile ripple look great?
3. Is it clear what you locked and what the salvo will do?
4. Do the wingmen feel useful but not like they play for you? Do they die stupidly?
5. Are tight and spread distinguishable and worth switching? Is "attack my target" decisive?
6. Can you tell friend from foe instantly at max zoom-out and on a small screen?
7. Is the enemy fighter a fun opponent (not too passive, not unfair)?
8. Is flying still the core skill, or does the squadron take over?

## 12. Proposed issues (two parallel tracks after a small contract PR)
0. **Contract PR (first, small):** actions + input mapping, events, `Killed.kind`, world slots and step order, empty tuning groups, palette. (Claude, before the tracks start.)

**Track A: lock-on and missiles** (`lockon`, `weapons`, `render`, `hud`)
- A1. Lock-on core: cone, acquisition, lock set, grace/range loss, events, tests.
- A2. Missiles core: salvo with stagger and cooldown, assignment, motion with acceleration/homing/wobble, hits, pool, tests.
- A3. Lock/missile rendering and HUD: lock rings, `LOCKS` and salvo panel, missile body and trail, edge cases at max zoom.

**Track B: enemies, wingmen and orders** (`ai`, `squadron`, `render`, `hud`)
- B1. Enemy fighter: AI driving the flight model, guns, break-away, waves, silhouette, tests.
- B2. Wingmen: formations (tight/spread), separation, guns, engagement rules, losses and test-arena respawn, silhouette, tests.
- B3. Orders and HUD: cycle formation, attack my target, formation/order display, wingman edge arrows, tests.

**Integration (after A and B)**
- I1. Wingmen launch the salvo: each living wingman fires one missile; salvo size = pilots; tests.
- I2. Tuning panel groups with notes, debug overlay additions, `hashWorld`/replay coverage, 120 s simulation and determinism tests.
- I3. Scenario polish: wave pacing, default counts, a first tuning pass from the playtest questions.

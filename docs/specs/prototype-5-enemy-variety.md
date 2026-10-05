# Prototype 5: Enemy Variety & a Capital Ship (spec v1, draft)

("Prototype 4" is the look-and-sound work, `prototype-4-look-and-sound.md`; this is the next gameplay prototype.)

## Purpose
Answer two questions:
1. **Do different enemy types change how the player flies and fights,** not just how long a fight lasts? Each new type should ask for a different answer: flank it, roll through it, pick a target, ask the squad for help.
2. **Does a run with a built-up threat curve and a boss at the end feel more varied and challenging** than four battles of the same fighters?

Everything not needed for these is out of scope. Values are **starting defaults to tune**, all parameters (typed, default, range, short unit, plain-language note) in `data/tuning/*.ts`, live in the tuning panel. Same rules as before: fixed 60 Hz step, seeded RNG, deterministic, replay-safe, core never imports render/ui.

## Decisions taken (Xavi, 2026-10-05)
- **Run mix:** an **authored ramp** (each battle has a planned mix), plus a new enemy type: **formation wings** (groups of fighters flying in formation).
- **Capital ship:** a **boss in battle 4**; the battle is won by **destroying its core**.
- **Missile defence:** the player counters enemy missiles with the **existing evade roll only** (its invulnerability frames, plus hard turns); no flares, no shooting missiles down in this prototype.
- **Scope:** all three listed enemies in the first build: gunship, missile fighter, capital ship (plus the formation wing).

## Scope
In: enemy framework (data-driven kinds) · formation wings · gunship · missile fighter and enemy missiles · multi-part capital ship with turrets, armour and a core · the authored battle table · wingmen rules for the new threats · HUD cues for the new threats · dev tools · replays · sound/FX hooks (events only).
Out: more than one capital ship, boarding or shields as a player mechanic, flares/decoys, shooting down missiles, random enemy generation, new pilot traits, branching map.

## 1. Enemy framework (`core/ai`, `data/content/enemies.ts`)
Today the enemy fighter, drone and turret are separate code paths. Introduce **enemy kinds as data** validated like parameters: id, hull points, radius, speed and turn scales, weapons (list of mounts), AI profile, score/threat value, which waves it can appear in. Existing fighters become the `fighter` kind with unchanged behaviour (their tests stay green). New kinds reuse the fighter flight model where they fly.
- **Weapon mounts:** position and aim limits in ship space, fire rate, bullet speed/damage, range, burst pattern. Mounts are what turrets and the gunship use.
- **Events (additive):** `EnemySpawned{kind}`, `EnemyMissileFired`, `EnemyMissileHit`, `PartDestroyed{part}`, `CoreExposed`, `WingBroken`, `CapitalDestroyed`.

## 2. Formation wing (`ai/wings.ts`)
A **wing** is 3 to 5 fighters flying in a formation (V, line, or box) behind a **leader**. Followers hold slots relative to the leader like the player's squad does (reuse the slot logic), attack together, and **break formation** when the leader dies, when they take fire, or when the player gets close (then they act as ordinary fighters). A wing is announced to the player with a cue ("WING INBOUND"). Defaults: 4 fighters, tight slot radius 140 u, leader slightly sturdier (+1 hp).

## 3. Gunship (`kind: gunship`)
A **slow, tough, heavily armed** ship: speed scale about 0.35 of a fighter, turns slowly, hull 12, radius 70.
- **Weapons:** two **rapid-firing turrets** (independent, each with a wide firing arc, 12 shots/s, low damage, short bursts with pauses so there are windows), plus a fixed nose gun optional.
- **AI:** drifts towards the player's side of the arena, keeps a standoff distance (700 u), turns to bring turrets to bear, retreats from missiles' danger, prefers shooting the player but also wingmen.
- **Counter:** fast flanking from behind its turret arcs, missile salvo (lock takes a while but it is slow), or the squad's attack order. Flying straight at it is punished.

## 4. Missile fighter (`kind: lancer`)
A fighter variant, a bit faster than a normal fighter, that **fires homing missiles** at the player.
- **Enemy missile:** its own pool; slow launch, accelerates, **limited turn rate**, lifetime 5 s, damage 2 hull (a normal bullet is 1). Telegraph: a short launch warning tone/flash and a **red missile warning marker** on the HUD pointing at the incoming missile.
- **Player counter:** the **evade roll's invulnerability frames beat a missile** if timed right; a hard turn also works because missiles turn slowly. A missile that hits an immune target is spent.
- **Wingmen:** enemy missiles **ignore wingmen or they evade them easily** (wingmen are not hit by enemy missiles; a gentle rule: they get an automatic roll). Decision: wingmen are **not targeted** by enemy missiles in this prototype.
- **AI:** keeps range 900-1500 u, fires one missile every 6 s (burst of 2 on higher battles), cannot fire while evading; dies as a normal fighter (hull 3).
- Existing "enemies evade your missiles" applies to it too.

## 5. Capital ship (`kind: capital`, boss of battle 4)
A **huge ship (radius about 700 u, about 5 to 6 times the gunship) made of independent parts**, drifting slowly and turning to keep the player in its broadside.
- **Parts (data, each a body with local position, radius/shape, hp, and role):**
  - **Turret mounts** (6 to 8): rapid-fire turrets with arcs; destroying one removes that gun. Some are heavier (slower, bigger bullets, long range).
  - **Engines** (2): destroying them stops the ship's movement and its turning (it becomes a sitting hulk).
  - **Armour plates** (4 to 6): tough, no weapons; they **cover the core**. The core cannot be hit until the plates on its side are gone (or: damage to the core is cut by 90% while any plate covers it; decision below).
  - **Bridge** (1): destroying it blinds its turrets (lower accuracy, longer reaction).
  - **Core** (1): **killing it wins the battle** and triggers the capital death sequence.
- **Damage model:** each part has its own hp and radius; bullets and missiles hit the part they touch (parts nearest the surface first); **missiles lock onto parts** (the lock-on and salvo system treat each part as a lockable target, with a part cap so a salvo is not wasted on tiny parts). Parts show their health and a destroyed part leaves a wreck with smaller secondary explosions.
- **Death sequence:** a long chain: turret by turret, engine fire, the whole hull breaking into big pieces over several seconds, a final blast (reuses the death-sequence system from Prototype 4, as data per part).
- **Escort:** two formation wings and, later in the fight, a couple of missile fighters, so the player cannot just hover at the capital.
- **Squad:** wingmen attack parts of the capital ship (target the nearest turret or the part the player has marked with the attack order); the order cycles parts sensibly.
- **Arena:** capital ship starts at the arena edge and slowly approaches; player and capital share the arena (radius 6000 u); parts must stay inside the arena.

## 6. The battle table (authored ramp, `data/content/battles.ts`)
Starting defaults (waves of fighters stay as today):
| Battle | Enemies |
|---|---|
| 1 | fighters, one formation wing in the last wave (it is the introduction) |
| 2 | fighters, formation wings, one gunship in wave 2 |
| 3 | wings, two gunships, the first missile fighter (alone) then pairs |
| 4 | **the capital ship** with two escort wings, missile fighters joining halfway |
Pods, debriefs and pilot picks work as before. The ramp is data: Xavi can edit each battle's list in one file.

## 7. Wingmen and orders
- Wingmen treat gunships as high-threat (they avoid its turret arcs unless attack-ordered), attack wings' leaders first, and ignore enemy missiles (they are not targets).
- The attack order works on parts of the capital ship (its target is the nearest part within the cone, cycling).

## 8. HUD and readability (data, additive)
- Enemy kind markers (shape per kind) on the edge indicators, a **MISSILE** warning with an arrow to each inbound missile, **WING INBOUND** and **CAPITAL SHIP** cues, a capital ship health bar made of its parts (parts as segments, core highlighted) at the top of the screen during battle 4.
- All cues are events and read-only state (they work with every style).

## 9. Dev tools and tests
- Panel: run-phase jumps and spawn buttons per kind (gunship, wing, lancer, capital; via the spawn registry from `dev-tools/jump-and-spawn`), toggles to freeze them, per-kind tuning groups, a capital parts overlay (part circles, hp, which plates cover the core), a missile overlay.
- Pure-function tests: formation slots and break rules, weapon mount arcs, missile steering and expiry, part damage routing and core exposure.
- Sim tests: whole battles 1 to 4 with scripted bots under the authored ramp (never NaN, always ends, bounded pools); a capital ship fight where parts die in any order; determinism of a whole run; hash coverage updated.
- e2e: each new enemy appears and the page has no console errors.
- Replay format version bumps (new state in the hash).

## 10. Issues and tracks (after a small contract PR)
Contract first: enemy kind data types and validation, weapon mount type, events, enemy missile pool skeleton, battle table type, hash and README stubs.
Then three parallel tracks:
- **Track A, framework and wings:** enemy kinds as data, weapon mounts, formation wings, the battle table and spawning, gunship.
- **Track B, missiles:** lancer, enemy missiles, warning markers, wingmen rules, tuning.
- **Track C, capital ship:** multi-part bodies and part damage, lock-on on parts, the capital's AI, death sequence data, escorts and the battle 4 script, HUD bar.
Then integration (everything together, battle ramp tuning, e2e, a reviewer pass).

## 11. Open points: decided (Xavi, 2026-10-05: "go with your recommendation")
1. **Armour plates block the core:** the core cannot be damaged while any plate covering it stands, so there is a clear order of play.
2. **Gunship turret arcs** are wide but not 360 degrees, so there are blind spots to exploit.
3. **Enemy missiles do not target wingmen** at all (simplest, protects the pilots); revisit after play.
4. **Missile damage is 2 hull** against the player's 5; tune after play.
5. **Looks and sound:** each new kind gets placeholder shapes in `plain` now and a proper pass later through the style packs (ships and death sequences are data already), so this prototype does not wait for art.

## 11b. Dev tools requested (Xavi, 2026-10-05)
The debug menu must allow **jumping between run phases** (Start, Battle 1 to N, Debrief, End) and **spawning enemies of any type**. This is built first, as its own small PR (`dev-tools/jump-and-spawn`), around a spawn registry: every new enemy kind from this spec adds one registry entry and appears in the panel automatically.

## 12. Feel questions for Xavi
Does each new enemy ask for a different answer? Is the missile fighter fair and readable (can you tell a missile is coming and when to roll)? Is the capital ship exciting rather than a slog, and are the parts and the core order clear? Is the ramp too fast or too slow, and which battle is the hardest?

# Prototype 3: Pilots & a Short Run (spec v1, draft)

## Purpose
Answer the question that matters most for the game's heart (concept §9, risk 5, pillar "Every pilot matters"):
1. **Will players care about generated pilots with names, traits and radio chatter?** Do they remember them, feel their loss, and change how they play to protect them?
2. **Does a short run (a few battles in a row) make those losses matter?**

Everything not needed to answer these is out of scope. Values are **starting defaults to tune**, not final numbers; all are parameters (typed, default, range, short unit, plain-language note) in `data/tuning/*.ts`, live in the tuning panel. Units, fixed 60 Hz step, seeded RNG and determinism as in Prototype 2: replays of a whole run must reproduce it exactly, **including the player's menu choices**.

## Decisions taken (Xavi, 2026-10-04)
- **Joining:** both ways: **rescue** stranded pilots (escape pods) in battle, and a **post-battle pick** of 1 of 3 generated pilots.
- **Run:** a **short linear run**: 4 battles (the last one the hardest) with a debrief between them. No branching map yet.
- **Identity:** a generated **name**, **one trait**, and short **text radio chatter** for key events.
- **Loss:** a pilot shot down is **lost for good**. Pilots who survive a run become **veterans** (a saved roster you can bring into later runs); a veteran who falls is lost forever.

## Scope
In: run flow (start, 4 battles, debriefs, end) · player hull and defeat · pilot generation, 5 traits, squad of up to 4 · rescue pods · post-battle pick · veterans roster and save data v2 · text chatter and a squad roster HUD · controller-first menus · dev tools for runs · replay including menu choices.
Out: branching map, other battle objectives (escort, capital ship), more enemy types, audio or voices, pilot growth/promotion/relationships, unlock tree, war map, a carrier hub, touch controls.

## 1. Run structure (`core/run`)
A run is a state machine: `start` (menu) → `battle` 1..4 → `debrief` after each of battles 1-3 → `end` (victory after battle 4, or defeat). The existing arena with drones, turrets and statics stays available as **practice mode** (reached with `?practice` in the URL or a panel switch) and is what the simulation tests and tuning use.
- **Battle:** a fixed number of waves of the existing enemy fighters, `battleWaves` = [2, 3, 3, 4], wave size `waveSize` growing by `waveGrowth` 1 per battle (the existing wave logic, with an objective counter). The battle is won when its last wave is cleared. Statics and drones are off in run mode; turrets appear from battle 3 (`runTurrets` 0, 0, 2, 3).
- **Player hull:** the player can now be shot down: `playerHull` 5 hp, each enemy bullet that hits takes 1 (evade i-frames still protect). At 0 the run ends in **defeat**. Hull and the squad's hp are **fully restored at each debrief**.
- **Debrief:** shows what happened (kills, pilots lost), lets you take the pilot pick if there is a free squad slot, and **Continue**. The simulation is paused while a menu is up (the world does not step; replays record the menu actions).
- **Victory/defeat:** the end screen shows the result and which pilots survived or fell; survivors are saved as veterans (section 8).
- Events: `BattleStarted{n}`, `WaveStarted{n}`, `BattleCleared{n}`, `RunEnded{result}`.

## 2. Pilots (`core/pilots`)
- **Pilot:** stable `id`, `name`, `trait`, `kills`, `battles` flown, `status` (`active`, `lost`), `veteran` flag. The run's pilots are `world.pilots`; each active pilot **is** a wingman (`squadron.wingmen` is built from active pilots in run mode, instead of `wingmanCount`, which keeps working in practice mode).
- **Squad size:** up to `squadMax` 4 pilots.
- **Generation (seeded, deterministic):** names combine a first name and a callsign from data tables (`data/content/names.ts`, about 24 each, no duplicates in a run); the trait is uniform among the five. Candidates in a pick are 3 distinct pilots.
- **Traits (`data/content/traits.ts`, validated like parameters):** each trait is a set of multipliers on that wingman's existing squadron parameters, so it changes how they fly and fight (and what they tell you):
  - **Sharpshooter:** wider fire cone x1.6, gun damage x1.3.
  - **Steady:** +2 hp, tighter slot hold radius x0.6 (stays in formation).
  - **Bold:** engage range x1.5, top speed x1.1, −1 hp.
  - **Guardian:** prefers enemies that are chasing the player; tight engage range x1.4.
  - **Hunter:** their missiles do x1.5 damage.
- Trait effects are data, applied through one `effectiveSquadronConfig(world, wingman)`; the tuning panel can edit each multiplier.
- Events: `PilotJoined{id}`, `PilotLost{id}`, `PilotKill{id}`.

## 3. Joining
- **Rescue pods (`core/world/pods`):** in battles 2 and 3 (`podBattles` 2, 3), when wave `podWave` 2 starts and the squad has a free slot, an escape pod appears far out in the arena. It has `podHealth` 3 and drifts slowly. Enemy fighters and turrets treat a pod as a target if it is within `podThreatRange` 1200 u. To rescue it, stay within `rescueRadius` 160 u for `rescueTime` 2.5 s (progress fills while you are close and drains while you are away). A pod that is destroyed (`PodLost`) is lost with its pilot. A rescued pod's pilot joins at once. HUD: an edge arrow with a distance, a progress ring on the pod.
- **Post-battle pick:** at each debrief with a free slot, choose 1 of 3 generated pilots (name, trait and one line of what it does). You may skip.
- A full squad (4) skips both: pods do not spawn and the pick is replaced by **Continue**.

## 4. Chatter and HUD
- **Chatter (`ui/chatter`):** short text lines from pilots at key events: joined, rescued, kill, took a hit while low, a squadmate lost, battle cleared, run won. Three line templates per trait and event, chosen by a seeded generator so a replay shows the same text. Rate limited: at most one line per `chatterGap` 2.5 s, up to `chatterLines` 3 on screen, each fading after `chatterLife` 6 s. Presentation only (not in the replay hash).
- **Squad roster (top-left, under the existing lines):** each pilot's name, trait tag and hull pips; fallen pilots stay in the list, struck through.
- **Objective line:** `BATTLE 2/4 · WAVE 2/3 · HOSTILES 5`.

## 5. Menus and flow (`src/ui`, controller-first)
- Screens: **Start** (choose up to `veteransPerRun` 2 veterans to bring, then Start; also shows best run), **Debrief** (pick and continue), **End** (result, who survived, who fell, restart).
- Navigation with the stick or D-pad and **A** (confirm), **B** (back) on a gamepad, arrows/Enter/Esc on a keyboard; the existing flight keys are ignored while a menu is up. New actions `menuUp`, `menuDown`, `menuSelect`, `menuBack` (edge-triggered), used only outside battle and **recorded in replays**.
- The game boots into the Start screen (the previous behavior is practice mode).

## 6. Meta (`core/meta`, `app/save`)
- Save data **v2**: the veterans roster (up to `veteranCap` 8: id, name, trait, kills, runs) and the best run, migrating v1 (`bestTrialTime`) without loss.
- At the end of a run, every pilot still active becomes a veteran (or stays one, with `runs` + 1); a veteran who is lost is **deleted from the save**.
- Veterans chosen at the start join the squad as normal pilots (with their name and trait).
- Pure functions for roster updates and migration, unit-tested; the browser storage wrapper stays thin.

## 7. Dev tools
- Panel groups: **Run**, **Pilots** (trait multipliers), **Rescue**, **Chatter** (all with plain-language notes), plus a **Run controls** section: jump to battle N, add a pilot with a chosen trait, kill a pilot, grant/clear veterans, end the run.
- Debug overlay additions: pod rescue radius and progress, pod threat range, which pilot each wingman is (name tag).
- **Replay/determinism:** the run state (phase, battle, wave, pilots, pods, objective counters) is in `hashWorld`; the hash-coverage audit test must stay green; a whole run (menus included) replays exactly.

## 8. Architecture notes
- New modules: `core/run`, `core/pilots`, `core/meta`, `core/world/pods`, `src/ui` (screens, chatter, roster HUD). `core` stays free of three/DOM.
- **Shared contract (landed first, one small PR, so the tracks do not collide):** new actions (`menuUp/Down/Select/Back`) with input mapping; events listed above; world slots `run`, `pilots`, `pods` with skeletons, step functions in the fixed step order (run before everything, pods after enemy shots), hash hooks; empty tuning groups `run`, `pilots`, `rescue`, `chatter`; content data files (`traits.ts`, `names.ts`) with validated shapes; save data v2 types.
- **Run mode vs practice mode** is one world flag; the existing systems (waves, wingmen, lock-on, missiles) are reused, not duplicated.

## 9. Tests
- Unit: name generation (no duplicates, deterministic per seed); trait multipliers applied (each trait); squad cap; pick candidates distinct; battle/wave progression and objective counter; player hull and defeat; resupply restores hull and squad hp; pod spawn rules, rescue progress fill/drain, pod destruction; roster promotion to veteran and deletion on loss; save v1 to v2 migration; chatter rate limit and fading; menu navigation and edge-triggering.
- Determinism: same seed + inputs (menu choices included) → identical final state over a full 4-battle run, headless with a scripted bot.
- Simulation: a scripted bot flies a whole run (random inputs plus scripted menu picks) for several seeds: no NaN, pools within caps, no stuck menu, the run always ends.
- E2E: boot to the Start screen, start a run with the keyboard, reach a battle with no console errors; practice mode still loads with `?practice`.
- Manual: 60 fps with 4 wingmen, a wave of 8 and a pod.

## 10. Acceptance criteria
- Playable on the preview URL with gamepad and keyboard: start a run, fly four battles, rescue a pod, pick pilots, lose some, finish or fail, and see veterans saved and available at the next start.
- All new parameters live-tunable and presets savable; a replay of a whole run reproduces exactly.
- CI green; the tests above in place.

## 11. Playtest questions (for Xavi)
1. After four battles, can you name your pilots and their traits without looking?
2. When a pilot dies, do you feel it? Do you change how you fly or what you order to protect them?
3. Is a rescue worth the risk? Is the pod too easy, too hard, too slow?
4. Do the traits change how you fly and command? Which feel useless or too strong?
5. Is the chatter flavour or noise? Too frequent, too rare, repetitive?
6. Is four battles the right length (about 10 minutes)? Is the last one properly tense?
7. Does bringing a veteran into a new run feel special?
8. Does the hull and defeat make the run feel risky without being frustrating?

## 12. Proposed issues (two parallel tracks after a small contract PR)
0. **Contract PR (first, small):** menu actions, events, world slots (`run`, `pilots`, `pods`), step order, hash hooks, empty tuning groups, content data shapes, save v2 types. (Claude, before the tracks start.)

**Track A: run, pilots and meta** (`run`, `pilots`, `meta`)
- A1. Pilots: generation (names, traits), roster as wingmen in run mode, trait effects, squad cap, events, tests.
- A2. Run state machine: battles and waves objective, player hull and defeat, resupply, practice-mode flag, events, tests.
- A3. Meta: veterans roster, save v2 with migration, run end to veterans, start-of-run veteran selection logic, tests.

**Track B: world content and UI** (`world`, `ui`, `hud`)
- B1. Rescue pods: spawn rules, drift, rescue progress, enemy targeting, HUD arrow and ring, tests.
- B2. Menu screens: Start, Debrief (pick), End, controller-first navigation, pause while a menu is up, tests.
- B3. Chatter feed, squad roster HUD and objective line, tests.

**Integration (after A and B)**
- I1. Wire the whole flow: boot into Start, practice mode switch, run and meta hooks, replay with menu choices, hash coverage, a full scripted-run determinism test.
- I2. Dev tools: panel groups with notes, run controls, overlay additions, 4-battle simulation tests over several seeds.
- I3. Scenario polish and a first tuning pass from the playtest questions.

# Prototype 6: The Sector Map & Battle Objectives (spec v1, draft)

(Numbering: Prototype 4 = look and sound, Prototype 5 = enemy variety and a capital ship. Xavi asked me to decide the scope of "the next prototype"; this is it.)

## Purpose
The MVP in `concept.md` section 9 needs a **branching sector map** of about 6 to 8 nodes, more than one kind of battle, a carrier stop, and a final battle. Today a run is four fixed battles. Answer:
1. **Do choices between battles make runs feel different and make the player think about risk versus reward** (take the hard fight for a pilot, or rest at the carrier)?
2. **Do different battle objectives (not only "kill everything") make the fights feel varied** with the enemies we now have?

Everything not needed for these is out of scope. Values are starting defaults to tune, all parameters in `data/tuning` (typed, default, range, unit, note), live in the panel. Fixed 60 Hz step, seeded RNG, deterministic, replay-safe (menu choices on the map are recorded like other menu actions), core never imports render/ui.

## Decision basis
Scope is mine (Xavi left it to me, 2026-10-05): it is the next item of the concept's MVP list, builds on Prototype 3 (runs, pilots, veterans) and Prototype 5 (enemy kinds and the capital ship). Decisions are logged in `decisions.md`.

## Scope
In: a seeded branching sector map (generated per run) · node types: battle (easy, hard), rescue mission, carrier resupply, elite battle, final battle · three new battle objectives · the carrier screen (repair, promote one pilot, recruit) · rewards after battles · controller-first map UI · dev tools · replays including map choices.
Out: upgrades or new fighters as rewards (no permanent stat upgrades, per concept), unlock tree, war map, shops with currency, multiple carriers, story events, touch controls.

## 1. The sector map (`core/run/map.ts`, data in `data/content/sector.ts`)
- A map is a small directed graph in **columns** (about 6): start, then 4 to 5 columns of 2 or 3 nodes each, then the final battle. Each node links to 1 or 2 nodes of the next column. Generated from the world seed (deterministic), always connected, always at least one carrier node and one rescue node reachable before the final.
- **Node types** (icon and short description shown on the map):
  - **Skirmish** (easy battle): fighters and a wing, small reward.
  - **Strike** (hard battle): gunships, lancers, more enemies, bigger reward (a pilot pick of 3 and a repair).
  - **Rescue mission:** the objective is to reach and protect stranded pilots (see section 2), reward: 1 or 2 pilots.
  - **Carrier:** no battle: repair hull and wingmen, promote one pilot (see section 3), recruit from a list of 2.
  - **Elite:** a capital ship (small version of the boss) or a gunship group; guaranteed good reward.
  - **Final:** the capital ship boss of Prototype 5 with escorts.
- Map state in the run: current node, visited nodes, hull and squad carry over between nodes (hull is only restored at carriers, and partially after battles: tuning `run.repairAfterBattle`).
- UI: a map screen between battles (like the debrief): nodes and links drawn, the reachable nodes highlighted, up/down/left/right to choose, select to confirm, back shows the legend. The map is read-only data (`MenuData`), works with every style.

## 2. Battle objectives (`core/run/objectives.ts`)
A battle has an **objective** instead of always "clear all waves". Authored per node, data in `data/content/objectives.ts`:
1. **Clear** (as today).
2. **Defend the carrier:** an allied carrier (large static target with hull and a few turrets) sits in the arena; enemy waves attack it as well as you; the battle is won when the waves are done and the carrier is alive, lost if it dies. The carrier hull is shown on the HUD.
3. **Escort:** a slow friendly transport flies a path across the arena; enemies target it; it must reach the exit alive. Wingmen escort it with the existing orders.
4. **Rescue mission:** 2 or 3 escape pods spread across the arena (reuse pods), each must be reached and held (existing rescue logic); enemy waves keep coming; the battle is won when all pods are rescued or lost and the time limit or waves end.
(Escort and Defend are out of Prototype 5; if one proves too big it moves to a later prototype, decided at the contract.)

## 3. The carrier screen
- A menu node (no battle): **Repair** (restore hull fully, wingmen hit points are always full anyway), **Promote** one pilot (a small trait upgrade: the trait's multiplier improves a step, shown as rank stars; promotions only last the run, veterans keep their rank), **Recruit** (pick 1 of 2 generated pilots if there is a free slot).
- One action per visit among Promote and Recruit (a real choice), Repair is free.

## 4. Rewards and the run's length
- Battle rewards: **pilot pick** (as today, 1 of 3), **hull repair**, occasionally **a veteran call** (offer a saved veteran not yet in the squad).
- Run length: about 20 to 30 minutes in the concept. The default map is 7 to 8 nodes along the path taken (5 battles at most).
- Defeat ends the run as before; survivors are saved as veterans, now with a **rank** (runs survived and kills) shown on the Start screen.

## 5. Dev tools and tests
- Panel: "Map" section: regenerate the map from a seed, jump to any node, set the node type, force an objective, skip to the final.
- Pure tests: map generation (connected, node counts, always reachable carrier and rescue, determinism per seed), objective win and lose rules, carrier actions, rewards.
- Sim tests: whole runs through random map paths with scripted bots (finite, bounded, always ends, all node types visited across seeds), determinism including map choices, hash coverage.
- e2e: the map screen appears after a battle, choosing a node starts it, the carrier works, no console errors.
- Replay format version bumps.

## 6. Issues and tracks (after a small contract PR)
Contract: map graph types, node and objective data types, the new events (`MapEntered`, `NodeChosen`, `ObjectiveProgress`, `CarrierAction`), menu data for the map and carrier, hash and README stubs.
Tracks: **A map and run flow** (generation, state, map UI, replay); **B objectives** (defend, escort, rescue mission, HUD cues); **C carrier, rewards and ranks** (carrier screen, promote/recruit/repair, veteran ranks). Then integration.

## 7. Decisions and open points (my recommendations, Xavi to confirm or change)
1. **Escort and Defend in the first build?** Recommend yes for Defend (simple: a big static target) and Rescue mission, **Escort second** if time allows.
2. **Promotion upgrades a trait step** (no new stats), lasting for the run; veterans keep a rank cosmetic plus small trait bonus. This keeps "no permanent stat upgrades" honest.
3. **Map is visible whole** (all nodes known), unlike FTL's fog, so the player can plan.
4. **Hull repair mostly at the carrier** (partial after battles), so the carrier is worth visiting.
5. **Looks and sound:** map and carrier screens use the style system (data for colours, sounds as events) so every pack works.

## 8. Feel questions for Xavi
Is the choice between nodes interesting or obvious? Is a carrier visit worth the lost battle? Which objective is the most fun? Is a run of 7 to 8 nodes the right length?

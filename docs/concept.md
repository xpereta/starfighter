# Starfighter — Game Concept (in progress)

## Definition process

Phase 1 – Idea: 1) Core fantasy · 2) Constraints · 3) References & twist · 4) Design pillars · 5) Setting & tone · 6) One-page concept (gate) — ✅ DONE
Phase 2 – Mechanics: 7) Player verbs ✅ · 8) Core loop ✅ · 9) Scope cut & risks ✅ · 10) Prototype core loop (next: engine choice, then prototype 1 spec)

## 1. Core fantasy ✅

"You're an elite ace facing impossible odds. Your skill keeps you alive, but only the squadron you build and lead can win the war."

- Personal piloting skill must always matter; the squadron multiplies it, never replaces it.
- Early game feels desperate; building the squadron is the path to power.
- The scale of the odds should be visible.
- Wingmen should feel like people, not stat upgrades.

## 2. Constraints ✅

- Platform: browser first; later PC (Steam / Steam Deck), console, mobile.
- Input: controller-first (Xbox-style gamepad); keyboard/mouse and touch secondary.
- Builders: AI agents → needs clear written specs, modular & data-driven design, automated tests.
- Dimension: 2D first; possible 3D spin-off later. Keep game logic separate from rendering.
- Structure: **roguelite** — replayable runs, every run different; some progression carries over between runs.

## 3. References & twist ✅

References:

- **1942 series** — arcade punch and readability; side fighters that join your plane (seed of the squadron); evasive loop/roll.
- **Rayforce / Gunlock** — multi-target lock-on, used with missiles.
- **Ace Combat** — missiles and lock-on, named wingmen with radio chatter, squadron orders, epic set-piece battles.
- **Star Wars** (films/space-combat games) — space fighters that handle like planes; fighters, carriers/capital ships, squadron dogfights.

Genre: **NOT a vertical shmup.** Top-down 2D, **free flight in all directions** (arena / open-space dogfighting).

- **Dynamic camera zoom** so the player can see where they're heading and where enemies are.
- **Camera look-ahead**: the player ship is not always centered; the camera shifts to show more space in front of the ship.
- **Radar and/or off-screen enemy indicators** at the screen edges.

Twist — all three combined:

- **A. Power-ups are pilots** — named pilots join your squadron, fly with you, grow during the run, can be shot down.
- **B. Paint & strike** — you lock targets; the squadron fires the missiles. More pilots = more locks = bigger salvos.
- **C. Formation orders** — Ace Combat–style commands on the controller (e.g. tight / spread / attack my target). Adds the tactical layer.

Working pitch: "Ace Combat's squadron and missiles, Rayforce's multi-lock and 1942's arcade punch, in a free-flying top-down roguelite where every power-up is a pilot you command."

## 4. Design pillars ✅

1. **Ace in the cockpit** — your own flying and aiming always decide the fight; the squadron amplifies skill, never replaces it.
2. **Every pilot matters** — wingmen are people: names, voices, growth, and losses that hurt.
3. **Fast tactics, no pauses** — orders and locks happen in real time with one button each; the battlefield must stay readable at a glance (camera, radar, indicators).

## 5. Setting, tone & look ✅

Setting

- **Space sci-fi** with **plane-like handling** — Star Wars / Ace Combat style: set in space, flies like jets. Cinematic physics, no realistic Newtonian drift; no in-world justification needed (genre convention).
- Enables **starfighters, carriers, and a wide variety of enemies**.
- Optional flavor: battle locations like nebulae, debris fields, gas-giant upper atmospheres, capital-ship fleets — visual variety between run stages.

Tone

- **Grounded military drama (Ace Combat–like)**: radio chatter, real stakes.
- Story is **emergent, per run**: each run is a different war story told through pilots, chatter and events (who joined, who was lost, the comeback), within a light persistent war backdrop. No heavy fixed campaign narrative.

Visual direction

- **Flat, stylized silhouettes**, limited palette.
- Ships recognizable by silhouette (role readable from shape: fighter, bomber, carrier…); color codes faction and threat.
- Readable at any zoom level and on small screens; effects (missile trails, lock-on rings, hits) must pop against the flat shapes.
- Agent-friendly: shapes can be produced as vector/code assets; style translates naturally to flat-shaded low-poly if a 3D version happens.

## 6. One-page concept ✅ (v1.1 approved)

See `docs/one-pager.md`.

## 7. Player verbs ✅

Cockpit (moment to moment):

1. **Fly** — steer with the left stick; the nose leads, guns follow the nose.
2. **Throttle** — accelerate / brake; speed drives turning, camera zoom and look-ahead.
3. **Shoot** — guns straight ahead.
4. **Lock & launch** — hold enemies in the nose cone to lock; launch the squadron's missile salvo.
5. **Evade** — a short evasive maneuver (roll/break turn) to shake a missile lock or dodge fire; a nod to 1942's loop. Timing-based, skill-expressive. (Exact effect and cooldown TBD.)

Command (real time, one button each): 6. **Order** — formation commands: tight (defend me) / spread (cover area) / attack my target.

Controller layout (draft, approved; validate in prototype):

- Left stick: steer · RT: throttle up · LT: brake
- A (hold): guns · B: launch missiles (when locked) · X: evade
- RB: attack my target · LB: cycle formation (tight/spread) · D-pad: alternatives for orders
- Right stick: free for now (later: camera nudge or extra maneuvers)

## 8. Core loop ✅

Second-to-second (combat): fly → line up nose → guns / lock & launch → evade incoming → order squadron → repeat.

Battle (~2–4 min): drop into a battle with an objective (clear a wave, escort, destroy a capital ship, defend the carrier). Earn rewards; possibly gain or lose pilots.

Run (~20–30 min, Steam Deck–friendly): a branching sector map (FTL-style). Choose the next node: battles of different risk, rescue missions, resupply at your carrier (repair, promote pilots, upgrades), elite fights. Ends in a desperate set-piece battle against overwhelming forces.

How pilots join during a run ✅

- **Rescue in combat** — stranded allied pilots / escape pods appear mid-battle; fly to them and protect them to recruit. Risk vs reward.
- **Post-battle pick** — after a battle, choose 1 of 2–3 pilots, each with a trait/role.
- (Carrier recruitment possible as a secondary source later.)

What persists between runs ✅

- **Veterans** — pilots who survive a run can be called on in future runs. Implication: a veteran shot down is lost for good — maximum weight for "Every pilot matters".
- **Unlocks** — new fighters, pilot types, starting options, enemy variety.
- Maybe later: **war map** (front moves based on runs).
- Rejected: permanent stat upgrades (would weaken "Ace in the cockpit").

## 9. Scope cut & risks ✅

MVP (first complete playable run in the browser):

- 1 player fighter: full flight model (throttle, turn/speed trade-off), guns, nose-cone lock-on missiles, evade.
- Camera: speed-driven zoom, look-ahead, edge indicators (+ simple radar if needed).
- Enemies: 3 fighter types (e.g. basic fighter, missile interceptor, heavy/bomber) + 1 capital ship as final battle.
- Squadron: up to 4 wingmen; simple AI; 3 orders (tight / spread / attack my target); squadron missile salvos tied to your locks.
- Pilots: generated names, 1 trait each, text radio chatter for key events (joined, hit, shot down, kill).
- Recruitment: rescue in combat + post-battle pick.
- Run: short branching map (~6–8 nodes): battles, 1 rescue mission, 1 carrier resupply, final battle.
- Meta: veterans roster (survivors persist; dead stay dead).
- Input: gamepad + keyboard. Platform: browser.
- Craft & detail: hooks/systems in place + simple first versions only (see §9b).

Later:

- More fighters, enemy types, capital ships, battle objectives and locations.
- Pilot growth depth: promotions, skill trees, relationships.
- Unlock tree; war map; carrier recruitment; elite fights.
- **Full craft & detail pass** (see §9b).
- Voiced chatter; touch controls/mobile; Steam/Steam Deck build; consoles; 3D version.

Not now: multiplayer/co-op, story campaign, Newtonian physics, permanent stat upgrades (never).

Biggest risks → what to prototype:

1. **Flight feel** — is flying satisfying and masterable? (turn/speed trade-off, evade) → prototype 1: one ship, empty arena, dummy targets.
2. **Camera readability** — zoom range + look-ahead on a 1280×800 screen → in prototype 1.
3. **Lock-on + salvo feel** — does "you lock, squadron fires" feel great and keep your skill central? → prototype 2.
4. **Wingman AI** — useful, readable, not stealing the show, not suicidal → prototype 2.
5. **Pilot attachment** — will players care about generated pilots with names, traits and chatter? → prototype 3 (short run).
6. **Agent-built pipeline** — engine choice and project structure must suit AI agents → decide before prototype 1.

## 9b. Craft & detail — "the developers really cared" (vision; full pass is Later)

Goal: players should feel that every small thing was crafted with care. Not in MVP scope (too expensive), but the architecture must make it cheap to add later.

Xavi's examples:

- **Missiles**: accelerate after launch (not constant speed); trajectory wobbles slightly, not a perfect line; small debris/puff on launch.
- **Hits** (on enemies AND the player): sparks or debris on impact; each hit nudges the target's movement/orientation slightly.
- **Enemy destruction**: not a single explosion. The ship breaks apart into pieces; a sequence of explosions of different sizes, some immediate, some delayed; **every death is different**; debris stays visible for a while after the sequence ends.
- More to come.

Design notes:

- Flat silhouettes help: a vector ship shape can be procedurally split into shards, so every death can differ without hand-made animations.
- Effects should be **data-driven and randomized** (seeded), e.g. per-ship "death sequence" definitions: number of break-up pieces, explosion count/sizes/delays, debris lifetime.
- Hit nudges affect gameplay (aim, flight) → must be tuned together with the flight model; keep them subtle so they never fight "Ace in the cockpit".
- Lingering debris must not hurt readability (fade, low contrast vs. ships) or performance on Steam Deck/mobile (pooling, caps).
- MVP should include the **hooks**: hit events with direction/impulse, a death-sequence system, a particle/debris system, missile motion driven by tunable curves — even if the first versions are simple.

## Early mechanics decisions (captured ahead of Phase 2)

Flight model

- **Nose-aiming**: you fire where the ship points. Using both sticks may be explored later, but the baseline is nose-aim.
- The flight model must be **very satisfying** and **masterable** — not a brainless arcade; mastering it is what makes you an effective dogfighter.
- Has **speed and acceleration** (throttle). Handles like a plane (Star Wars / Ace Combat), not Newtonian.
- To explore: slowing down to turn tighter (a turn-rate vs speed trade-off, like a "corner speed" sweet spot). Included in MVP for testing.

Camera

- Zoom **driven by speed**; possibly also by distance to enemies (undecided).
- **Look-ahead offset**: camera shifts ahead of the ship so more of the area in front is visible; ship is off-center. (To spec: offset direction — nose vs travel direction; how it scales with speed; smoothing so it never feels jerky during sharp turns.)
- Min/max zoom must be tuned carefully so it stays readable on small screens (Steam Deck, later mobile).

Lock-on (baseline)

- **Cone in front of the nose**, with a set angle and max range.
- Mostly automatic: governed entirely by where the fighter points.
- Keeping a target in the cone runs a **lock-on timer** (~a couple of seconds, to tune); once locked, you can fire missiles.
- More lock-on variants can come later as power-ups.

## Open questions

- Engine choice (web-only like Phaser vs multi-platform like Godot, which also covers 3D) — needed before prototype 1.
- Evade: exact effect (i-frames? break missile lock?) and cooldown.
- How the player's cone lock connects to the squadron's missiles (Twist B): do locks stack per pilot? Does the squadron fire on your command or automatically?
- Camera: does enemy distance also affect zoom? Look-ahead tuning (see Camera).
- Radio chatter: text only for MVP; voiced later (how, given an AI-agent build?).
- Craft & detail: collect more examples over time (§9b).

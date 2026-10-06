# Art direction

One page, kept short. Written by Claude as a first proposal for the `anime-80s` direction; **Xavi edits it** (the references above all). Each style pack (`data/styles/<id>/`) states its own intent and references in its manifest; this page holds the direction the first considered pack follows, and the headings every direction answers (`specs/prototype-4-look-and-sound.md`, section 1).

Packs today: `plain` (flat placeholder shapes, silent: the baseline and the fallback), `anime-80s` (the first sections of this page) and `used-future` (the last section). View with `?style=anime-80s` or `?style=used-future`.

## Mood

A hand-drawn OVA dogfight from around 1984-1992: you are the ace of a small squadron, the sky is deep indigo, the fighters are clean and bright, the enemy is a swarm of angular, one-eyed machines in hot red. Everything is flat cel colour with one hard shadow and thick ink lines; light only comes from things that glow (engines, sensors, blasts). Explosions are drawn, not simulated: big, layered, a little theatrical, and every one different.

## Palette families

Four named palettes. The game uses one flat colour per role (`theme.palette`), so a palette is a short list.

| Palette | Role | Colours |
| --- | --- | --- |
| **Cel White** | Player and friendly accents | fighter body `#f2f6ff`, cockpit and sensor light `#fff4b0` |
| **Squadron Cyan** | Wingmen, friendly UI, lock cues | wingman `#57d6ff`, pod `#7cf0c8`, lock ring `#ffd23f` |
| **Hot Red** | Enemies, ordered by threat | fighter `#ff3a60`, drone `#ff4d6d`, static `#ff9a3c`, turret `#b06cff`, enemy shot `#ff6fa0` |
| **Indigo Night** | Space, ink, stars | background `#070a1c`, ink outline `#4f6fd8`, stars `#aabbe6`, dust `#dfe8ff` |

Explosions add their own short ramp (white-yellow core, orange, red, then a dark violet smoke); see the vocabulary below.

## Line weight and outline rules

- Outline: **2 u** thick, ink blue `#4f6fd8`, drawn outside the silhouette, with mitred corners, on every ship. Ships are 25 to 100 u across, so the line stays bold at the default zoom.
- Never thinner than 1 u at any zoom (do not scale the line with the ship). Bullets, missiles and sparks have no outline.
- The outline colour is a mid ink blue, not navy: a dark ink vanished against the deep indigo sky (contrast audit, `scripts/contrast-audit.mjs`), so the line is light enough to give every ship a readable rim against the background.
- Eyes, cockpits and engine flames have no outline: light has no ink line.

## Shading rules

- **Flat cel:** one fill colour and **one hard shadow tone** (the fill at 55% brightness), cut by a straight terminator, covering about 45% of the ship on the lower side. No gradients.
- The only soft thing is glow: engine discs with a faint halo that brightens with thrust, and the eye/sensor. Explosion cores are hard-edged flat shapes.
- Light is local to the ship (the shadow turns with it), a cheap and readable stand-in for a fixed light.

## Silhouette language

- **Player and wingmen:** clean, nose-forward, symmetric. A needle nose, a thin canopy, swept wings and twin tails (Valkyrie-like). The player is cel white with a cyan-blue edge feeling from the outline; wingmen are the same family, cyan, a little wider. Two engine glows at the tail.
- **Enemies:** angular, asymmetric, never a clean mirror. One bright **sensor eye** (a yellow-white shard) near the front: fighters are swept darts with one longer wing and a notched flank; drones are shard-shaped diamonds with the eye off-centre; turrets are armoured octagons with a stub barrel; static targets are crystal-like heptagons. Threat reads by colour first, shape second.
- **Pods:** a ring with a bright core, mint green, rounder than anything else on screen.

## Explosion vocabulary

All explosions are flat, hard-edged shapes with a colour ramp (core to rim). Each death rolls its own variation (see spec section 4).

- **Hit spark:** a sharp starburst, white-yellow, a few frames long.
- **Small flash:** a round flash with one thin ring, orange to red, for drones and pieces bursting.
- **Large burst:** layered spherical burst with a shockwave ring and hard-edged violet smoke puffs, for fighters and turrets.
- **Missile hit:** a cross-shaped flare over a small burst: the missile signature.
- **Heavy:** bigger and slower, a flash frame, double ring, long smoke: wingman, player, pilot loss and final blasts.
- **Break-up:** ships split into pieces along their own outline; pieces drift, spin, burst again on timers (occasionally in a chain) and linger as dim debris.

## UI style

Thin, high-contrast HUD in the Indigo Night family: cel white text, gold for locks and warnings, no gradients or blur. Flash frames and speed lines are screen effects that can be turned off.

## References

| Title | What to take from it |
| --- | --- |
| Macross / Robotech (VF-1 Valkyrie; Kawamori, Yamashita) | The hero silhouette: needle nose, swept wings, twin tails, white body with one accent colour. Missile swarms with long curling trails (the "Itano circus"). |
| Mobile Suit Gundam (0079, Zeta) | Hard cel shadows with one tone, angular asymmetric enemy machines with a single mono-eye sensor, beam-and-ring explosions. |
| Bubblegum Crisis | Neon accent colours on dark navy, thick confident ink lines, glow only where light is emitted. |
| Space Battleship Yamato | Heavy, deliberate big-ship destruction: long secondary-explosion chains and a final blast (turrets now, capital ships later). |
| Gunbuster (Top wo Nerae!) | Speed lines, flash frames, stark high-contrast moments on big blasts. |
| Akira and Patlabor-era explosions | Hand-drawn layered spherical bursts, hard-edged smoke puffs, shockwave rings, drifting debris that bursts again. |

Xavi supplies or approves the references: swap any title for one you prefer and the notes in `data/styles/anime-80s/style.ts` follow.

---

# Used future (`used-future`)

Gritty used-future space war in the spirit of Star Wars (the original trilogy's model shop) and Aliens. Models are **layered parts** (panels, panel lines, greebles, canopies, nacelles, flaps, hardpoints, scars: `ShapeDef.parts` in `src/render/style.ts`), each ship slot designed on its own; see the reference sheet `docs/reference/used-future/sheet.png` and the large single-ship images beside it (regenerate with `node scripts/style-sheet.mjs used-future --each --port=<free port>`). View with `?style=used-future`. Sound: parent `realistic`, only the three guns are replaced by blaster zaps.

## Mood

Everything is a working machine that has been used hard: scuffed white and grey hulls, red and orange squadron markings, soot behind the engines, patched plates, uneven wear (one side of every ship is battered, the other cleaner). The sky is dim and sparse: a grey-blue planet low in a corner, a faint sodium glare in the opposite one, teal fog and film grain; light comes from engines, lamps, cockpits and fires, plus one hard key light that cuts every ship's lower side into a flat shadow. Fights are blaster bolts and orange fireballs with sparks and slow, burning wreckage; no rings, no cel shapes.

## Palette families

| Palette | Role | Colours |
| --- | --- | --- |
| **Rebel Grey** | Player and wingmen | player `#e4e5dc` worn white, wingmen `#c4d2de` pale blue-grey; markings red-orange `#d9452a` (player, Red squadron), yellow and blue (Gold), blue and orange (Blue); canopy glass `#182636`, blue astromech lamp, sodium cockpit light `#ffb347` |
| **Imperial Steel** | Enemy craft | fighter, lancer, gunship, capital `#b0c2d4` cold steel with `#c8321f` stripes; drone `#d8aa74` rust and brass; turret `#aabda3` gunmetal green; static dummy `#e8b84a` hazard amber with black bands |
| **Blaster Fire** | Shots and lock | player bolts `#ff4a3a` red, enemy bolts `#6dff5a` green, missiles `#ffb347` sodium, lock ring `#ffc94a`; engine glows orange (friendly, drone, lancer, gunship) or ion blue (fighter, capital) per ship |
| **Deep Sky** | Space | background `#04060c`, stars `#b8c4d8`, planet `#1e2a38` with a `#2f4a66` haze, glare `#ff7a2e` at 6 percent, fog `#1f4a5a`, grain `#9aa6b8` |

All hulls are mid to light on purpose: the contrast audit (`scripts/contrast-audit.mjs`) requires 3:1 against the backdrop everywhere (enemies included), and a dark hull would not read at top-speed zoom, where the 1.6 u outline is under a pixel. The dark look comes from the sky and the dark parts (glass, intakes, soot), not from dark hulls.

## Line weight and shading

- Outline: **1.6 u** soot `#0a0d12`, outside the silhouette. Light rim lines (pale `#eee9dc` or `#cfe0f0`) run along the leading edges as part data, so every ship has a bright edge toward the light.
- Panel lines are 0.008 to 0.016 radii wide (about 0.3 to 0.6 u on a fighter, visible on the large player and capital only; they are texture, not read at game zoom).
- Shading: one hard shadow over about half of the dark side (`shadowShare` 0.5), a translucent darkening over all parts; lights (glass, glow) stay lit.

## Silhouette language

- **Player (Stingray):** long needle nose, wings spread in attack position with a cannon at each tip, four nacelles at the wing roots, astromech socket; X-wing family. **Wingmen (Dart):** thin fuselage between two swept engine pods on pylons (A-wing and Y-wing family); three liveries on one silhouette.
- **Fighter (Raider):** a pod between two hexagonal blades on struts (TIE family) with a sensor eye. **Lancer:** spear nose, forward-swept stub wings with missile racks. **Drone:** spiked probe droid, rust and brass.
- **Turret:** bolted octagonal base with hazard edging, round housing and twin barrels. **Static:** dented hexagonal drum with hazard bands. **Pod:** round life pod with a porthole, thrusters and a sodium strobe.
- **Gunship (Hauler):** slab-sided dropship with two armoured sponsons and gun turrets (the Aliens dropship). **Capital (Bulwark):** a long armoured wedge with spine plates, flank turret blisters, bridge tower and shield domes, lit window rows and a four-nozzle engine bank; its parts (`capitalTurret`, `capitalEngine`, `capitalArmour`, `capitalBridge`, `capitalCore`) have their own shapes; the game draws them since Prototype 5.

## Explosion vocabulary

Fireballs from a white-hot core through sodium orange and ember red to sooty smoke, thin spike sparks, almost no shockwave ring, a one-frame flash on large blasts. Deaths break the hull along its outline (pieces take the colour of the part under them), pieces tumble slowly (up to 8 s), burn with smoke trails and cook off in chains; missile racks pop on the lancer; the turret, gunship, capital and its core end with a heavy last blast.

## References

| Title | What to take from it |
| --- | --- |
| Star Wars: A New Hope, The Empire Strikes Back (ILM model shop: Joe Johnston, Colin Cantwell, Lorne Peterson) | The used-future rule, kit-bashed greebles, panel lines, scuffs and soot; X-wing, TIE, Y/A-wing, Star Destroyer silhouettes; red and green blaster bolts |
| Aliens (Ron Cobb, Syd Mead, Dennis Skotak) | Dark industrial blue-grey with sodium-orange lamps, hard shadows, hazard stripes, the dropship, orange tracers, glare and fog |
| Alien (Ron Cobb, Chris Foss, H. R. Giger) | Sparse dim lighting, heavy tonnage, slow debris, lit window rows on a big hull |
| Battlestar Galactica (2004), The Expanse | Restraint: fireballs, sparks and tumbling chunks instead of rings |

# Art direction

One page, kept short. Written by Claude as a first proposal for the `anime-80s` direction; **Xavi edits it** (the references above all). Each style pack (`data/styles/<id>/`) states its own intent and references in its manifest; this page holds the direction the first considered pack follows, and the headings every direction answers (`specs/prototype-4-look-and-sound.md`, section 1).

Packs today: `plain` (flat placeholder shapes, silent: the baseline and the fallback) and `anime-80s` (this page). View with `?style=anime-80s`. `anime-spectacle` builds on it with a presentation layer (angled neon HUD, comm windows with visor portraits, title cards, camera punch/roll/kill-cam, readability aids; see `src/ui/README.md`): `?style=anime-spectacle`, `&spectacle=calm|full|overdrive|off`.

## Mood

A hand-drawn OVA dogfight from around 1984-1992: you are the ace of a small squadron, the sky is deep indigo, the fighters are clean and bright, the enemy is a swarm of angular, one-eyed machines in hot red. Everything is flat cel colour with one hard shadow and thick ink lines; light only comes from things that glow (engines, sensors, blasts). Explosions are drawn, not simulated: big, layered, a little theatrical, and every one different.

## Palette families

Four named palettes. The game uses one flat colour per role (`theme.palette`), so a palette is a short list.

| Palette | Role | Colours |
| --- | --- | --- |
| **Cel White** | Player and friendly accents | fighter body `#f2f6ff`, cockpit and sensor light `#fff4b0` |
| **Squadron Cyan** | Wingmen, friendly UI, lock cues | wingman `#57d6ff`, pod `#7cf0c8`, lock ring `#ffd23f` |
| **Hot Red** | Enemies, ordered by threat | fighter `#e8264f`, drone `#ff4d6d`, static `#ff9a3c`, turret `#b06cff`, enemy shot `#ff6fa0` |
| **Indigo Night** | Space, ink, stars | background `#070a1c`, ink outline `#22367a`, stars `#aabbe6`, dust `#dfe8ff` |

Explosions add their own short ramp (white-yellow core, orange, red, then a dark violet smoke); see the vocabulary below.

## Line weight and outline rules

- Outline: **2 u** thick, ink navy `#22367a`, drawn outside the silhouette, with mitred corners, on every ship. Ships are 25 to 100 u across, so the line stays bold at the default zoom.
- Never thinner than 1 u at any zoom (do not scale the line with the ship). Bullets, missiles and sparks have no outline.
- The outline colour is dark but not black so it also reads on the dark background.
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

## Spectacle (`anime-spectacle`)

A second pack on the same direction, `data/styles/anime-spectacle/` (parent `anime-80s`, view with `?style=anime-spectacle`, quality `&fx=low|medium|high`): the same ships and palette with the lights on. Bloom on emissives, a faint laser-disc colour fringe, vignette and grain; a living backdrop with a new sky each battle (gas clouds, a ringed planet, a colony ring or a carrier, drifting rocks, distant flashes); engine plumes, nav lights, wingtip trails, a helix streak on the roll, spiralling missile smoke; multi-stage blasts (flash frame, shock rings, fireball, ink-blot smoke, glinting debris, chain reactions, capital-scale turret kills) with a zoom punch; title cards. All render-only (contract: `src/render/spectacle-contract.ts`, notes: `src/render/spectacle/README.md`). Screenshots: `docs/reference/spectacle/`.

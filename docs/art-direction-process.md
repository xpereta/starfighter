# Art direction process (outline)

How to make a new look and sound direction, so it can be redone from a clean start at any time. Background and decisions: `specs/prototype-4-look-and-sound.md` (sections 2 and 2b). This is an outline; each step gets filled in as the first packs are built.

## Frozen starting point

The git tag `art-baseline` marks the commit that has the style contract, `plain` and the tooling, but no other pack. Xavi tags it after the contract PR is merged. A new direction starts from that tag (or from any earlier style it forks).

```
git fetch --tags
git checkout -b style/<id> art-baseline
```

## What a style pack is

A folder `data/styles/<id>/` plus one line in `data/styles/index.ts`. The contract (types and checks) is `src/render/style.ts`; the active pack is read through `src/render/style-active.ts` only.

| File             | Content                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `style.ts`       | manifest: id, name, one-line intent, parent, references (title and what was taken), status, notes            |
| `theme.ts`       | palette, outline, shadow share, glow                                                                         |
| `ships.ts`       | shape per ship kind                                                                                          |
| `deaths.ts`      | death sequence per ship kind                                                                                 |
| `explosions.ts`  | explosion kinds                                                                                              |
| `sounds.ts`      | event to sound table (every event has a sound or `'silent'`), and optionally `loops` (continuous sounds)     |
| `index.ts`       | exports the pack                                                                                             |

Anything a pack leaves out falls back to its `parent`, else to `plain`, with a console warning and a note in the panel's Look section. The exception is sound: a pack whose parent is `plain` (or none) that has no sounds or loops of its own (or lacks entries for newer events) takes them from the `realistic` pack, so a new direction is never silent. Inheritance makes variations cheap (same ships, new palette and sounds).

## Steps

1. **Intent and references.** Write the manifest: intent in one line, references with what is taken from each. Xavi approves the references.
2. **Start the folder.** Copy `data/styles/plain/` (or fork an existing pack: set `parent`) to `data/styles/<id>/` and add one line to `data/styles/index.ts`.
3. **Edit in this order, checking each in the panel** (`?dev&style=<id>`): theme (try colours, outline and shadow live in the Look section, then **Save theme.ts**), then ship shapes, then death sequences and explosions, then sounds. Hold **V** to peek at another style and **K** for a screenshot-friendly view, to compare two directions on the same moment.
4. **Run the style checks** (below).
5. **Open a PR** from branch `style/<id>`.
6. **Play, then record notes in the manifest** (`notes`, `status`: `idea | active | shelved`). Xavi decides what is kept.

## Branches and PRs

- One direction = one branch `style/<id>` = one PR, labelled `feature` + `render` (`fx` or a sound label as relevant).
- The PR only adds or changes files under its own `data/styles/<id>/`, plus its registry line. Shared plumbing (the contract, panel, renderer, audio) changes only in its own PRs, so directions never conflict and can be merged, kept as branches, or dropped independently.

## Style checks (automatic, for every pack)

Run by `npm test` (`src/render/style.test.ts`, `src/render/style-active.test.ts`), `npm run test:sim` and `npm run e2e`:

- The manifest and every file the pack has validate (colours, ranges, units, ids).
- Every event has a sound entry or an explicit `'silent'` (the type requires it); every ship and explosion kind it defines is a known kind; its parent exists.
- Shapes are closed and bounded.
- The replay hash is identical under every style (`tests/sim/style.sim.test.ts`).
- The page loads with each style without console errors (`tests/e2e/smoke.spec.ts`).

## Richer ships, the backdrop and the tools (contract additions)

All additive: a pack that uses none of this is drawn exactly as before.

- **Layered ship parts** (`ShapeDef.parts`): after the outer `polygon` (outline, base fill, death fracture) a ship may have up to 96 parts drawn in order: kinds `hull`, `panel`, `greeble`, `canopy`, `nacelle`, `flap`, `hardpoint`, `scar` (filled polygons) and `line` (panel lines, strips: a polyline with a width). Each has a colour **role** (`hull` = the faction colour, `panel` and `dark` = tones of it, `accent`, `glass`, `glow` from `theme.partColors`) or an exact `color`, and `mirror: true` draws the mirror image for symmetric ships. All parts of a ship are one vertex-coloured mesh (plus one for lights, drawn above the shadow), built once. Complexity budget per shape: 900 triangles (the `capital` 4000), checked by the validator; `shapeTriangles()` tells the cost. A death still cuts the **outer polygon** into pieces; the part under a piece's centre colours it.
- **Extra shape slots** (`EXTRA_SHAPE_KINDS`): `wingmanB`/`wingmanC` (liveries for the 2nd and 3rd wingman; keep the wingman silhouette), optional for every pack; `deaths` accepts the same ids. The Prototype 5 kinds `gunship`, `lancer`, `capital` and the capital's parts (`capitalTurret`, `capitalEngine`, `capitalArmour`, `capitalBridge`, `capitalCore`) are plain `SHIP_KINDS` (every pack gives them).
- **Backdrop** (`theme.backdrop`): up to 6 soft glows or lit spheres (planets) and film grain behind the stars, sized as fractions of the view so they look the same at every zoom.
- **Tools** (headless Chromium with software GL, served by Vite, nothing is built): `node scripts/style-sheet.mjs <style> [--each]` draws every ship large on the pack's backdrop (the reference sheet, saved under `docs/reference/<style>/`). `node scripts/contrast-audit.mjs [style ...]` measures every pack (see the script header) and `node scripts/frame-time.mjs` compares their frame cost. Use a free `--port=`.

## Agent prompt template

Copy, fill the `<...>` parts, and give it to an agent started from `art-baseline`.

```
Repo: Starfighter. Read AGENTS.md and docs/art-direction-process.md first and follow them.
Task: build a new style pack `<id>` from the `art-baseline` tag.
Intent (one line): <what this direction is going for>
References (title: what to take): <list>
Parent style (optional): <id or none>
Do: create data/styles/<id>/ by copying plain, fill the manifest, then theme, ships, deaths,
explosions and sounds in that order, add one line to data/styles/index.ts, run all checks
(typecheck, lint, format:check, test, test:sim, build, e2e), push branch `style/<id>`, open a PR
with labels feature + render. Only touch data/styles/<id>/ and the registry line.
Never push to main, never --no-verify, never force-push, do not merge.
Report: PR URL, what you made, what is still a placeholder, questions for Xavi.
```

# AGENTS.md — Starfighter

Browser game (top-down 2D space dogfighting roguelite): Vite + TypeScript (strict) + Three.js, deployed on Cloudflare Workers static assets. Read `docs/one-pager.md` first, then `docs/architecture.md`, `docs/project.md` and the spec for your issue in `docs/specs/`. Past decisions are in `docs/decisions.md` — don't reopen them without a reason; propose changes in an issue.

## Commands

Node version: see `.nvmrc` (24 LTS). `npm install` also installs the git hooks.

| Command                          | What it does                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                    | Vite dev server                                                                                                       |
| `npm run build`                  | typecheck + production build into `dist/`                                                                             |
| `npm test`                       | unit tests (Vitest, `src/**/*.test.ts`)                                                                               |
| `npm run test:sim`               | headless simulation tests (`tests/sim`)                                                                               |
| `npm run lint`                   | ESLint (includes the core boundary rule)                                                                              |
| `npm run format`                 | Prettier write (`format:check` to verify)                                                                             |
| `npm run typecheck`              | `tsc --noEmit`                                                                                                        |
| `npm run e2e`                    | Playwright smoke test (builds + serves `dist/`)                                                                       |
| `npm run board`                  | sync the GitHub Project board (needs `gh` with the `project` scope)                                                   |
| `npm run audio:measure`          | headless level check of the sound (after a build; see `src/audio/README.md`)                                          |
| `npm run style:contrast`         | headless contrast audit of every style pack (ships, shots, UI colours vs the backdrop; `-- --strict` fails on a miss) |
| `npm run style:sheet -- <style>` | headless reference sheet of a pack's ships, large, on its backdrop                                                    |
| `npm run style:frame-time`       | headless frame cost of a busy scene per style pack (compare packs, not absolute)                                      |

## Module map

```
src/core/      gameplay, pure TS: flight/ weapons/ camera/ world/ events/ rng/ replay/ lockon/ ai/ enemies/ squadron/ run/ pilots/ meta/
src/render/    Three.js renderer (orthographic); reads core state and the active style pack (style.ts contract, style-active.ts accessor)
src/audio/     Web Audio engine: plays the active style pack's sound table from the events (prototype 4); never imported by core
src/input/     gamepad + keyboard -> actions
src/dev/       tuning panel, debug overlays, run-phase jumps and enemy spawn registry (dev builds only; add new enemy kinds to spawn-registry.ts)
src/ui/        menus, chatter, roster HUD (prototype 3)
src/app/       bootstrap, fixed-timestep loop
data/          content data, tuning defaults, quality presets, style packs (data/styles/<id>/)
tests/         simulation tests (sim/), e2e (e2e/)
docs/          source of truth for concept, architecture, specs, decisions
```

`docs/reference/` is a throwaway proof of concept: a feel reference only. Do not copy its structure.

## Architecture rules

- `src/core/**` never imports `three`, `src/render`, `src/audio`, `src/app`, `src/input`, `src/dev`, or DOM/browser APIs. Lint enforces this; don't disable the rule.
- Core is deterministic: fixed 60 Hz timestep, seeded RNG (`src/core/rng`), no `Math.random`/`Date.now`.
- Modules talk through shared world state (plain typed data) and typed events, not direct calls into each other's internals.
- Hot paths (bullets, particles, debris): pooled flat arrays, no per-entity objects or allocation per frame, no per-entity event dispatch.
- One module = one gameplay system. Each module gets a short README contract: purpose, state read/written, events in/out, parameters, how to test.
- No extra libraries, frameworks or abstractions beyond what the docs ask for (see "Explicitly NOT doing" in `docs/architecture.md`).

## Parameter rules

- No magic numbers in gameplay code. Three kinds, kept apart: content data, tuning (feel), quality presets (eye candy; gameplay must never depend on them).
- Every parameter is typed and has a default, a sane range and units, and is validated at load (bad data fails loudly).
- Units: world units (u), seconds (s), radians internally (degrees only in UI).
- Spec numbers are starting defaults, not tuned values.

## Git rules

- **Never push to `main`. Never use `--no-verify`. Never force-push.** Always: branch, commit, push the branch, open a PR.
- Branch names: `<module>/<short-topic>`, e.g. `flight/turn-rate-curve`. One issue = one branch = one small PR.
- Git hooks (lefthook) run Prettier + ESLint on commit and typecheck + unit tests on push; `.claude/settings.json` blocks the forbidden commands for Claude Code. Fix the cause when a hook fails — don't bypass it.
- CI runs on every PR and is the real gate.
- Fill in the PR template (`.github/pull_request_template.md`), link the issue (`Closes #n`), and name the agent/model used.

## Labels and review

- Type: `feel` (changes how it plays), `feature` (new capability), `bug`, `tuning`, `tech`. Module: `flight` `camera` `weapons` `input` `render` `fx` `dev-tools` `world` `hud` `lockon` `ai` `squadron` `run` `pilots` `meta` `ui`.
- PRs labeled `feel` or `feature` need Xavi's approval after playing the preview. Others merge on reviewer-session approval + green CI: the agent merges them itself (squash, delete branch) and does not wait for Xavi.

## Definition of done

CI green · tests added (unit, plus sim/determinism where the spec asks) · module README updated if its contract changed · parameters in config, no magic numbers · preview URL playable · reviewer session passed · Xavi approved if `feel`/`feature`.

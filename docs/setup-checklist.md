# Starfighter — Setup Checklist (Phase 0, before Prototype 1)

Who: **[X]** = Xavi does it (accounts, clicks) · **[C]** = Claude Code does it (as issues/PRs, except the very first scaffold commit).

## A. Accounts & machine

1. ✅ [X] Private GitHub repo `starfighter` created.
2. ✅ [X] Branch protection decision: **stay on GitHub Free, no server-side protection.** `main` is protected by `AGENTS.md` rules + local git hooks + Claude Code hooks (see B2). CI is still the real quality gate.
3. ✅ [X] `gh` authorized on the Mac. Still check: Node.js LTS, git, Claude Code (logged in with Pro), an Xbox-style controller.
4. [x] Preview hosting on **Cloudflare Workers** (Xavi has an account; a test Worker exists at orange-queen-f438.xpereta.workers.dev). **No credentials are shared with Claude** — Cloudflare builds directly from GitHub:
   - Do this **after** the scaffold is merged (the repo needs `package.json` + `wrangler.jsonc` first; Claude Code adds them).
   - Cloudflare dashboard → Workers & Pages → Create → **Import a repository** → pick `starfighter` → ✅ Worker created and named `starfighter` (URL: starfighter.xpereta.workers.dev); Git build settings configured. `wrangler.jsonc` must use `"name": "starfighter"`.
   - Build command `npm run build` · deploy command `npx wrangler deploy` · production branch `main`.
   - Settings → Build → Branch control → **Enable Preview Builds** → every PR branch gets its own preview URL (and a PR comment with the link).
   - Only if we later deploy from GitHub Actions instead: a scoped Cloudflare API token stored as a GitHub secret — never in the repo or in chat.

## B. Repo scaffold — [C], first commit (bootstrap, allowed directly on `main`)

5. Vite + **TypeScript (strict)** + **Three.js**; `wrangler.jsonc` serving `dist/` as static assets.
6. Tooling: **Vitest** (unit + simulation tests), **ESLint** with a boundary rule (`src/core/**` may not import `three`, `src/render/**`, DOM/browser APIs), **Prettier**, **Playwright** (one smoke test: page loads, canvas renders, no console errors).
7. Folder structure:
   ```
   src/core/      gameplay modules (no rendering): flight/, weapons/, camera/, world/, events/, rng/, replay/
   src/render/    Three.js renderer (orthographic)
   src/input/     gamepad + keyboard → actions
   src/dev/       tuning panel, debug overlays (dev builds only)
   src/app/       bootstrap, game loop (fixed timestep)
   data/          content data + tuning defaults (+ quality presets)
   docs/          concept, architecture, project, specs/, decisions.md
   tests/         simulation tests, e2e
   ```
8. npm scripts: `dev`, `build`, `test`, `test:sim`, `lint`, `format`, `typecheck`, `e2e`.

### B2. Guardrails for `main` (instead of GitHub branch protection)

9. **Git hooks** (installed automatically on `npm install`, e.g. with lefthook or simple-git-hooks):
   - `pre-commit` (fast, staged files only): Prettier + ESLint.
   - `pre-push`: **reject pushes to `main`**; run typecheck + unit tests.
   - Keep hooks fast (seconds) — slow hooks get bypassed.
10. **Claude Code hooks** (committed in `.claude/settings.json`): a PreToolUse check on shell commands that blocks `git push` to `main`, `--no-verify`, and force pushes. Unlike git hooks, the agent can't skip these.
11. `AGENTS.md` rule: never push to `main`, never use `--no-verify`, never force-push; always branch + PR.
12. Limits (accepted): all of this is local — a human can still bypass it. CI on every PR remains the real gate; an optional CI job can flag any direct push to `main`.

## C. Docs into the repo — [C]

13. Move the Claude project docs to `/docs`: concept, one-pager, architecture principles, engine choice, project management, this checklist, prototype 1 spec.
14. `AGENTS.md` (vendor-neutral): build/test commands, module map, the architecture rules, parameter rules (typed, defaults, ranges, units), definition of done, git rules (B2), PR template usage, labels `feel`/`feature`.
15. `CLAUDE.md` → one line pointing to `AGENTS.md`.
16. `docs/decisions.md` seeded with decisions made so far (engine, architecture, process, hosting, no branch protection).
17. PR template: summary · linked issue · how to test · tuning values changed · `feel`/`feature`? · agent/model used.

## D. CI & GitHub — [C] writes, [X] enables

18. GitHub Actions workflow on every PR: typecheck · lint · format check · unit tests · simulation tests · build.
19. Labels: `feel`, `feature`, `bug`, `tuning`, `tech`, module labels (`flight`, `camera`, `weapons`, `input`, `render`, `fx`, `dev-tools`).
20. Milestones: Prototype 1 · Prototype 2 · Prototype 3 · MVP. One GitHub Project board.
21. Create the Prototype 1 issues from its spec.

## Done when

- `npm run dev` shows an empty Three.js scene; `npm test` and CI pass on a trivial PR; that PR gets a playable Cloudflare preview URL; pushing to `main` is blocked locally; `AGENTS.md` and `/docs` are in place.

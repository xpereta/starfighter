# Starfighter — Source Control & Project Management (v1.3)

Principle: the lightest process that lets AI agents work safely and lets Xavi steer and play every change. No Jira, no GitFlow, no sprint ceremonies.

## Current setup (decided)

- ✅ **For now: only Claude, running on Xavi's Mac** (Claude Code + Cowork for design/planning). Claude Pro plan.
- Multiple agents/vendors (Codex, OpenCode, Hermes) and the Ubuntu VM "agent box": **later** (see bottom section). The process stays vendor-neutral so they can join without changes.
- Implications of Claude-only on Pro:
  - Work is mostly **sequential**: one task at a time (occasionally two, via git worktrees). Pro limits (5-hour window + weekly cap, shared with Cowork) are the real throughput limit → keep tasks small and specs precise to avoid wasted iterations.
  - **Review = a fresh Claude Code session** (new context, reviewer instructions) — not the session that wrote the code. Less independent than cross-model review, but catches a lot.

## Roles

- **Xavi** — product owner & game designer: sets priorities, approves specs, playtests. ✅ **Reviews only PRs that affect feel or add new features** (labels `feel` / `feature`).
- **Builder session** — implements one issue, on its own branch, with tests.
- **Reviewer session** — fresh session reviewing the PR against the spec, architecture principles and tests. For PRs without `feel`/`feature`, reviewer approval + green CI is enough to merge.

## Source control

- ✅ **Git + GitHub**, private repo, one repo for everything (code, data, docs).
- **Trunk-based**: `main` is always playable. Short-lived branches, one per task (`flight/turn-rate-curve`). No direct pushes to `main` (enforced by branch protection if available — see setup checklist — and by `AGENTS.md`).
- **Pull requests** are the only way in. Small PRs (one task, one module where possible).
- **CI gate on every PR** (GitHub Actions): typecheck · lint (incl. core-never-imports-render rule) · formatter check · unit tests · simulation tests · web build · (perf stress test from prototype 2).
- **Playable preview per PR** (e.g. Cloudflare Pages): Xavi plays each change on any device, including Steam Deck, before merging.
- Large binary assets (audio, later): Git LFS when needed — not before.

## Single source of truth for docs

- Once construction starts, **the repo `/docs` folder is the source of truth** for specs.
- Concept/design docs move from this Claude project into `/docs`: `concept.md`, `one-pager.md`, `architecture.md`, `project.md`, `specs/prototype-1-flight.md`…
- `AGENTS.md` at repo root (vendor-neutral): how to build, test, conventions, module map, rules. `CLAUDE.md` just points to it.
- Module README contracts live next to the code.
- **Decision log** `docs/decisions.md`: one dated entry per decision (what, why).

## Planning & tracking

- **GitHub Issues + one GitHub Project board** (Backlog → Ready → In progress → Review → Done).
- **Milestones**: Prototype 1 (flight & camera) → Prototype 2 (lock-on, salvos, wingmen) → Prototype 3 (short run, pilots) → MVP.
- **One issue = one task**: goal, link to spec section, acceptance criteria, tests required, module label. Self-contained (no chat history needed). Too big to describe that way → split.
- **Definition of done**: CI green · tests added · module README updated if the contract changed · parameters in config (no magic numbers) · preview playable · reviewer session passed · Xavi approves `feel`/`feature` PRs.
- **Playtest notes → issues** (feel tweaks often just need a tuning-value change).

## Cadence

Per milestone: spec → issues → build (one at a time) → review session → playtest on preview → tune → close milestone, update decision log.

## Later: multiple agents & VM (parked)

- Vendor-neutral rules: GitHub issues/PRs as the only interface · `AGENTS.md` single instruction file · CI as referee · `agent:<name>` label to claim work, one agent per module at a time · PR field "Agent / model used" · least-privilege token per agent, no merge rights.
- Cross-model review (reviewer from a different vendor than the author).
- Start with 2 tools (Claude Code + Codex); add OpenCode/Hermes only with a concrete need.
- Ubuntu VM as "agent box": unattended work, isolation, hosts non-Claude agents, headless browser tests. Does **not** add Claude capacity (limits are per account). One VM + git worktrees first; per-agent fine-grained tokens; snapshots; not used as CI runner.

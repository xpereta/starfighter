# Decision log

One entry per decision: date — decision — why. Newest at the bottom. Agents: don't reopen these without a reason; propose changes in an issue.

- 2026-10-02 — Game concept approved (see `one-pager.md`): top-down 2D, free-flight space dogfighting roguelite; pillars "Ace in the cockpit", "Every pilot matters", "Fast tactics, no pauses".
- 2026-10-02 — Free flight in all directions, not a vertical shmup — keeps the dogfight feel.
- 2026-10-02 — Nose-aiming; plane-like (non-Newtonian) handling; speed/throttle; turn-rate vs speed trade-off to be tested — mastery is the goal.
- 2026-10-02 — Camera: zoom driven by speed, look-ahead offset, edge indicators — readability on small screens.
- 2026-10-02 — Lock-on: cone in front of the nose with a lock timer, then missiles.
- 2026-10-02 — Pilots join by rescue in combat + post-battle pick; veterans and unlocks persist between runs; no permanent stat upgrades — protect skill and pilot attachment.
- 2026-10-02 — Visual style: flat stylized silhouettes, limited palette — readable, cheap to produce, shatterable procedurally.
- 2026-10-02 — Craft & detail (missile wobble, hit reactions, varied multi-stage deaths, lingering debris): full pass later; hooks (events, death-sequence system, particle/debris system, curve-driven missiles) built from the start.
- 2026-10-02 — Consoles deferred; engine: Three.js + TypeScript with an engine-agnostic core — best agent productivity and browser performance, 3D possible later in the same codebase.
- 2026-10-02 — Architecture principles approved (`architecture.md`): system-level modules, shared state + typed events, pooled hot paths, three kinds of parameters, deterministic simulation, replays, debug overlays.
- 2026-10-03 — Only Claude (Claude Code on Xavi's Mac) for now; multi-agent setup later.
- 2026-10-03 — GitHub Free, no server-side branch protection; `main` guarded by git hooks, Claude Code hooks and `AGENTS.md`; CI is the real gate.
- 2026-10-03 — Xavi reviews only `feel` / `feature` PRs; others merge on reviewer-session approval + green CI.
- 2026-10-03 — Hosting: Cloudflare Workers (Worker `starfighter`) built from GitHub, preview build per branch/PR.
- 2026-10-03 — Prototype 1 proof of concept built as a single throwaway HTML file (`reference/prototype-1-poc.html`); it confirmed the flight/camera direction is promising — go ahead with the real Prototype 1 in the repo.
- 2026-10-03 — Final tuning values are deliberately NOT set yet; the spec's numbers stay as starting defaults. Tuning happens in the real prototype, via the tuning panel, in playtest rounds.
- 2026-10-03 — Agents merge PRs without `feel`/`feature` labels themselves once CI is green (squash); only `feel`/`feature` PRs wait for Xavi.
- 2026-10-03 — Dev tools (tuning panel, debug overlay, replay controls) are a lazy chunk loaded with `?dev` in every build, so preview URLs can be tuned; `VITE_DEV_TOOLS=false` strips them for release builds. Replays store seed + tuning + run-length inputs and are verified with a gameplay-state hash.
- 2026-10-03 — Xavi's panel preset X1 adopted as the new tuning defaults (maxSpeed 569, accel 59, grip 2.11, turnRateAtMax 40, cornerSpeed 220, view 2050-4500, nose look-ahead, shake on, fireRate 27.6, spread 4.64, bulletRadius 1). A starting point; feel is still to be tweaked in playtest rounds.
- 2026-10-03 — Prototype 2 (see `specs/prototype-2-squadron.md`): stacked locks up to 1 + wingmen, one button launches a salvo with one missile per pilot; scope is lock-on, missiles, wingmen, 3 orders and one fighting enemy fighter type (no pilot identity yet). Built as two parallel tracks after a small contract PR.
- 2026-10-04 — Rotate steering (stick left/right turns the ship) is now the default; point-to-steer stays selectable in the panel. Enemy fighters and wingmen always steer point-to-steer, independent of this setting.

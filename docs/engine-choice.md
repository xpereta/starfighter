# Starfighter — Engine Choice (research, Oct 2026)

## Decision status

- ✅ Consoles deferred (Xavi: "we'll think of consoles later") → **TypeScript web stack**.
- Proposed (awaiting confirmation): **Three.js + TypeScript**, with an engine-agnostic game core.

## Requirements

Browser first · PC / Steam Deck · consoles later · mobile later · possible 3D later · controller-first · built by AI agents (text-based project, testable headless, popular enough that models know it well) · 2D flat vector silhouettes, lots of particles/debris.

## Candidates

|                       | Godot 4 (GDScript)                                                            | Phaser 4 (TypeScript)                                  | Three.js (TypeScript)                                    | Defold (Lua)                | Unity 6 (C#)                  |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------- | --------------------------- | ----------------------------- |
| Browser               | Yes (bigger download)                                                         | Best (native web)                                      | Best (native web)                                        | Very good, small builds     | Yes, heavy                    |
| PC / Steam Deck       | Native (Linux)                                                                | Via Electron/Tauri wrapper                             | Via Electron/Tauri wrapper                               | Native                      | Native                        |
| Consoles              | Via W4 Games (Switch, PS5, Xbox; from $800/yr per platform for small studios) | Practically no                                         | Practically no                                           | Official (Switch, PS, Xbox) | Official, best supported      |
| Mobile                | Yes                                                                           | Via wrapper                                            | Via wrapper                                              | Yes                         | Yes                           |
| 3D later              | Same engine                                                                   | No (rewrite)                                           | Same codebase (2D via orthographic camera now, 3D later) | Limited                     | Strong                        |
| AI-agent friendliness | Good: text scenes, headless runs/tests, GDScript well known                   | Excellent: plain TS, huge training data, browser tests | Excellent: the most used stack in viral AI game demos    | Weaker                      | Weaker: editor-centric        |
| Cost                  | Free, MIT                                                                     | Free, MIT                                              | Free, MIT                                                | Free                        | Free tier with revenue limits |

Notes:

- Godot C# cannot export to the web yet (no committed timeline as of 2026) → would need **GDScript**.
- W4 Consoles supports Godot 4.4–4.6.
- Three.js is a rendering library, not a full engine: no editor, physics/audio/input/scene tools are assembled from libraries or written by the agents.

## What the viral AI game demos use (Oct 2026: GPT-6 Astra and Claude Opus 5.5)

From curated demo lists (small, self-selected samples):

- **Claude Opus 5.5** (13 games in "frontier-games"): Three.js ~5, other WebGL 3, Canvas 2D 1, Unreal 1, Roblox 1, C++/SDL2 1. No Godot, Unity or Phaser.
- **GPT-6 Astra** (~70 games): Three.js dominant (~25), WebGL ~8, Godot 3, Unreal 1, rest on platform-specific tools (Tesana, Crayon, Spawn…). Larger 3D showcases use Blender → Unreal Engine 5.
- Why Three.js dominates: demos are browser-first one-shots (shareable link, no build/export step) and JS/TS is where models are strongest. Text-based, CLI-friendly stacks suit agents; GUI-only tools don't.
- Caveat: demos optimize for "playable link in an afternoon", not for a polished multi-platform release.

## Three.js vs Phaser (the remaining choice)

- **Phaser**: faster start for 2D — built-in gamepad input, particles, camera follow/zoom/offset, arcade physics. But a 3D version means a rewrite.
- **Three.js**: more to build up front (input, simple collisions, particles, camera), but:
  - 2D now via orthographic camera, **3D later in the same codebase** (switch camera + models).
  - Flat silhouettes = flat meshes from vector shapes; procedurally **shattering** them for varied deaths (§9b craft & detail) is natural.
  - Our flight model, collisions and camera logic are custom anyway; Phaser's built-ins would be partially replaced.
  - The stack AI agents demonstrably handle best right now.

## Proposed architecture (agent-friendly)

- **Game core** in plain TypeScript, no rendering: flight model, combat, lock-on, AI, run/meta logic. Fixed timestep, seeded randomness → deterministic and **testable headless** (unit + simulation tests in Node).
- **Renderer** in Three.js (orthographic now) reads the core state; 3D later = new renderer, same core.
- **Data files** (JSON/TS) for ships, enemies, pilots, weapons, death sequences, tuning values.
- Input layer: Gamepad API + keyboard, mapped to actions.
- Tooling: Vite build, Vitest tests, Playwright for in-browser smoke tests; a live **tuning panel** (sliders) in dev builds for flight/camera feel.
- Desktop/Steam Deck later: wrap with Tauri or Electron.

## Sources

- Godot C# web export status: https://forum.godotengine.org/t/is-there-an-update-on-exporting-c-projects-to-web/128821
- W4 Consoles: https://www.w4games.com/w4consoles
- Defold platforms: https://defold.com/manuals/introduction/
- Phaser v4: https://phaser.io/download/stable
- Unity runtime fee cancelled: https://unity.com/runtime-fee
- Frontier games list (Opus 5.5 & Astra): https://github.com/theolundqvist/frontier-games
- Awesome Claude Opus 5.5 demos: https://github.com/magiccreator-ai/awesome-claude-opus-5-5-demos
- Awesome GPT-6 Astra demos: https://github.com/magiccreator-ai/awesome-gpt-6-astra
- Aituts, Astra game demos: https://aituts.com/gpt6-astra-game-demos/
- Atoms, Astra early access examples: https://atoms.dev/blog/gpt-6-astra-early-access-examples

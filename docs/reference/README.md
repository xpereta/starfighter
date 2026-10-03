# Reference: Prototype 1 POC (throwaway)

`prototype-1-poc.html` is a single-file proof of concept (Three.js from a CDN, open it in a browser) of the
flight & camera spec. It showed the direction feels right. Use it ONLY as a feel reference:

- Do NOT copy its structure. The real implementation follows `docs/architecture.md` and
  `docs/specs/prototype-1-flight.md` (modules, lint-enforced core/render split, data files, tests).
- Its parameter defaults equal the spec's starting defaults; they are not tuned values.
- The `CORE` section of the file is already pure logic (fixed 60 Hz, seeded RNG), so it is a good
  reading aid for formulas (turn-rate curve, grip, evade, camera look-ahead/safe frame).
- Delete this folder once the real Prototype 1 matches or beats it.

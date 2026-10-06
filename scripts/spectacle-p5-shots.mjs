// Headless screenshots of the Prototype 5 enemies in the anime-spectacle style, saved to
// docs/reference/spectacle-combined/p5-*.png.
//   npm run dev -- --port 5291        (in another terminal)
//   node scripts/spectacle-p5-shots.mjs http://localhost:5291 [only]
// Dev-only: it imports the game's own spawn registry and dev actions through the dev server (the same
// module instances the page runs) and edits the live world, so nothing here is a replay.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5173';
const only = process.argv[3] ?? '';
const out = new URL('../docs/reference/spectacle-combined/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => {
  if (only && !name.includes(only)) return;
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('saved', name);
};

/** A fresh page (no leftovers of the last scene's blasts), panel hidden. */
const fresh = async () => {
  await page.goto(`${base}/?style=anime-spectacle&dev`);
  await page.waitForSelector('canvas');
  await page.waitForSelector('#tuning-panel');
  await wait(1200);
  await page.keyboard.press('h'); // hide the tuning panel
  await wait(400);
};

/** Runs `fn(world, api)` in the page; `api` has the game's spawn registry and dev actions. */
const act = (fn, arg) =>
  page.evaluate(
    async ({ src, arg }) => {
      const world = window.__sf.world;
      const reg = await import('/src/dev/spawn-registry.ts');
      const dev = await import('/src/core/run/dev-actions.ts');
      const cap = await import('/src/core/enemies/capital.ts');
      const run = await import('/src/core/run/run.ts');
      const em = await import('/src/core/enemies/enemy-missiles.ts');
      // Events emitted between two frames would be cleared by the next step before the renderer sees them: skip that one clear.
      const keep = (w) => {
        const q = w.events;
        const original = q.clear;
        q.clear = () => {
          q.clear = original;
        };
      };
      const api = { reg, dev, cap, run, em, keep };
      return new Function('world', 'api', 'a', `return (async () => { ${src} })()`)(
        world,
        api,
        arg,
      );
    },
    {
      src: fn
        .toString()
        .replace(/^[^{]*\{/, '')
        .replace(/\}$/, ''),
      arg,
    },
  );

const reset = async (battle, frozen) => {
  await fresh();
  await act(
    (world, api, a) => {
      api.dev.devJumpTo(world, { kind: 'battle', n: a.battle });
      api.dev.devClearEnemies(world);
      world.tuning.arena.enemiesFrozen = a.frozen;
      world.ship.x = 0;
      world.ship.y = 0;
      world.ship.heading = 0;
    },
    { battle, frozen },
  );
  await wait(2200); // the battle banner is gone
};
const spawn = (id, count = 1) =>
  act(
    (world, api, a) => {
      const entry = api.reg.SPAWN_REGISTRY.find((e) => e.id === a.id);
      api.reg.spawnAhead(world, entry, a.count);
    },
    { id, count },
  );

// 1. Gunship, frozen, at rest in front of the player.
await reset(2, true);
await spawn('gunship');
await wait(900);
await shot('p5-gunship');

// 2. Gunship firing its turrets (unfrozen).
await reset(2, false);
await spawn('gunship');
await wait(2600);
await shot('p5-gunship-fire');

// 3. Its death, a quarter of a second in and then at its height.
await act((world) => {
  for (const f of world.fighters) if (f.alive) f.hp = 0;
});
await wait(250);
await shot('p5-gunship-death-a');
await wait(700);
await shot('p5-gunship-death-b');

// 4. Missile fighter and its missile: one is launched at the player on the spot, so the shot is not left to the AI's timer.
await reset(3, true);
await spawn('lancer');
await wait(600);
await act((world, api) => {
  world.tuning.arena.enemiesFrozen = false;
  world.fighters.forEach((f, i) => {
    if (f.alive && f.lancer) {
      const a = Math.atan2(world.ship.y - f.y, world.ship.x - f.x);
      api.em.launchEnemyMissile(world, f.x + Math.cos(a) * 60, f.y + Math.sin(a) * 60, a, i);
    }
  });
});
await wait(450);
await shot('p5-lancer-missile');
await wait(700);
await shot('p5-lancer-missile-2');
await wait(1300);
await shot('p5-lancer-missile-3');
await act((world) => {
  for (const f of world.fighters) if (f.alive) f.hp = 0;
});
await wait(300);
await shot('p5-lancer-death');

// 5. A formation wing, frozen so it keeps its shape.
await reset(2, true);
await act((world, api) => {
  const entry = api.reg.SPAWN_REGISTRY.find((e) => e.id === 'wing');
  entry.spawn(world, 1500, 0, 0);
});
await wait(900);
await shot('p5-wing');

// 6. Off-screen indicators: a gunship, a missile fighter and the capital ship all behind the player.
await reset(4, true);
await act((world, api) => {
  const by = (id, x, y) => api.reg.SPAWN_REGISTRY.find((e) => e.id === id).spawn(world, x, y, 0);
  by('gunship', 3300, 900);
  by('lancer', 500, -2500);
  by('fighter', -3300, -300);
  // And a missile inbound from behind the lancer, to get its edge arrow.
  api.em.launchEnemyMissile(world, 1100, -2900, Math.PI / 2, 0);
});
await wait(700);
await shot('p5-indicators');

// 7. The capital ship of battle 4: bar, plumes, hull lights.
await reset(4, true);
await act((world) => {
  const cap = world.enemies.capital;
  world.ship.x = cap.x - 1500;
  world.ship.y = cap.y;
  world.ship.heading = 0;
});
await wait(1400);
await shot('p5-capital');

// 8. A part goes, then the plates round the core: CORE EXPOSED.
await act((world, api) => {
  const defs = api.cap.CAPITAL_PARTS;
  const i = defs.findIndex((d) => d.id === 'gun-bow-port');
  api.cap.killPart(world, i, defs);
  api.keep(world);
});
await wait(350);
await shot('p5-capital-part');
await act((world, api) => {
  const defs = api.cap.CAPITAL_PARTS;
  for (const id of ['plate-front', 'plate-aft', 'plate-port', 'plate-starboard'])
    api.cap.killPart(
      world,
      defs.findIndex((d) => d.id === id),
      defs,
    );
  api.keep(world);
});
await wait(600);
await shot('p5-capital-core-exposed');

// 9. The core goes: the death chain and the final blast.
await act((world, api) => {
  const defs = api.cap.CAPITAL_PARTS;
  api.cap.killPart(world, api.cap.coreIndex(defs), defs);
  api.keep(world);
  world.tuning.arena.enemiesFrozen = false;
});
await wait(1000);
await shot('p5-capital-chain');
await wait(700);
await shot('p5-capital-chain-2');
await wait(700);
await shot('p5-capital-final');
await wait(1200);
await shot('p5-capital-after');

await browser.close();
if (errors.length) {
  console.error('console errors:', errors);
  process.exitCode = 1;
}

// Headless level measurement for the audio engine (dev tool, not part of CI).
//
//   npm run build && npm run audio:measure -- [style] [--port=4195] [--json=out.json]
//
// Serves the built game, taps everything that reaches the Web Audio destination (a ScriptProcessor
// on whatever connects to the AudioDestinationNode, installed by an init script), and prints:
//   1. every sound on its own (peak, RMS, length), played from the panel's sound test on the Start
//      screen where no loop is running;
//   2. every loop on its own at full level (the panel's loop preview);
//   3. a scripted battle in four phases (cruise, guns, guns + missiles + turns, quiet) with peak,
//      RMS and how much the level moves while the guns fire (a constant buzz does not move).
// It checks the rules the mix has to keep: no peak over 0.9, no clipped samples, loops quiet next
// to guns, guns not blurred into one sustained tone. Exit code 1 when a rule fails.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const flag = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const style = args.find((a) => !a.startsWith('--')) ?? 'realistic';
const port = Number(flag('port', '4195'));
const jsonOut = flag('json', '');
const base = `http://localhost:${port}`;

const PEAK_LIMIT = 0.9;
/** A loop at its loudest, a steady cruise bed (engine, rumble, space), and how far gunfire must stand above that bed (dB). */
const LOOP_FULL_MAX_DB = -30;
const BED_MAX_DB = -34;
const BED_IDLE_MAX_DB = -40;
/** Spread (p90 - p10, dB) of the 20 ms level while the guns fire: a constant buzz would not move. */
const GUN_MOVEMENT_MIN_DB = 8;
const GUNS_OVER_BED_MIN_DB = 6;
const db = (x) => (x > 1e-9 ? 20 * Math.log10(x) : -180);
const f1 = (x) => x.toFixed(1);

/** Everything that connects to the destination also feeds a tap that logs [time, peak, mean square] per block. */
function installTap() {
  window.__tap = [];
  window.__clipped = 0;
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const result = connect.call(this, dest, ...rest);
    if (dest instanceof AudioDestinationNode && !this.__tapped) {
      this.__tapped = true;
      const ctx = this.context;
      const sp = ctx.createScriptProcessor(512, 2, 1);
      sp.onaudioprocess = (e) => {
        let peak = 0;
        let sum = 0;
        let n = 0;
        for (let c = 0; c < e.inputBuffer.numberOfChannels; c++) {
          const d = e.inputBuffer.getChannelData(c);
          for (let i = 0; i < d.length; i++) {
            const a = Math.abs(d[i]);
            if (a > peak) peak = a;
            if (a >= 0.999) window.__clipped++;
            sum += d[i] * d[i];
            n++;
          }
        }
        window.__tap.push([ctx.currentTime, peak, sum / n]);
      };
      connect.call(this, sp);
      connect.call(sp, dest);
    }
    return result;
  };
}

async function startServer() {
  const child = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base);
      if (r.ok) return child;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error(`the preview server did not start on ${base} (run npm run build first)`);
}

const stats = (blocks) => {
  let peak = 0;
  let sum = 0;
  for (const [, p, ms] of blocks) {
    if (p > peak) peak = p;
    sum += ms;
  }
  return { peak, rms: blocks.length ? Math.sqrt(sum / blocks.length) : 0 };
};

/** Level movement: the spread (p90 - p10, dB) of the RMS of 20 ms windows, which a steady buzz would not have. */
function movement(blocks) {
  const win = [];
  for (let i = 0; i + 2 <= blocks.length; i += 2) {
    win.push(Math.sqrt((blocks[i][2] + blocks[i + 1][2]) / 2));
  }
  const sorted = win.map(db).sort((a, b) => a - b);
  if (sorted.length < 10) return 0;
  return sorted[Math.floor(sorted.length * 0.9)] - sorted[Math.floor(sorted.length * 0.1)];
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio=false'],
  });
  const failures = [];
  const report = { style, sounds: {}, loops: {}, bed: {}, battle: {} };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(installTap);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const now = () => page.evaluate(() => (window.__tap.length ? window.__tap.at(-1)[0] : 0));
    const tapSince = async (t0) =>
      page.evaluate((from) => window.__tap.filter(([t]) => t >= from), t0);
    const row = (p) => page.locator(`#tuning-panel [data-param="${p}"]`);

    // 1 + 2: the panel, on the Start screen (no loop runs there).
    await page.goto(`${base}/?dev&style=${style}`);
    await page.getByRole('button', { name: /Sound/ }).click();
    const keys = await page
      .locator('#tuning-panel [data-sound-test]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-sound-test')));
    await page.locator(`#tuning-panel [data-sound-test="${keys[0]}"]`).click(); // unlock
    await page.waitForTimeout(1500);
    for (const key of keys) {
      const t0 = await now();
      await page.locator(`#tuning-panel [data-sound-test="${key}"]`).click();
      await page.waitForTimeout(3800);
      const blocks = (await tapSince(t0)).filter(([, p]) => p > 0.0005);
      const s = stats(blocks);
      const length = blocks.length ? blocks.at(-1)[0] - blocks[0][0] : 0;
      report.sounds[key] = { peak: s.peak, rmsDb: db(s.rms), seconds: length };
    }
    // A pile-up: many big sounds at the same instant (the test button ignores gaps and voice limits),
    // to check that the limiter and the ceiling keep the output clean when a fight gets messy.
    await page.waitForTimeout(500);
    {
      const t0 = await now();
      await page.evaluate(() => {
        const click = (key, n) => {
          const el = document.querySelector(`#tuning-panel [data-sound-test="${key}"] `);
          for (let i = 0; i < n; i++) el.click();
        };
        click('Killed', 8);
        click('MissileImpact', 4);
        click('PlayerDamaged', 3);
        click('ShotFired', 6);
        click('SalvoFired', 2);
        click('RunEnded', 1);
      });
      await page.waitForTimeout(4000);
      const s = stats(await tapSince(t0));
      report.pileUp = { peak: s.peak, rmsDb: db(s.rms) };
    }
    await page.waitForTimeout(2500);

    // Loops at full level: the preview value to the right end of its slider.
    await row('sound.loopPreview').click();
    const slider = row('loopPreview.value');
    const box = await slider.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 40, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    const loopNames = (await row('sound.loop').innerText()).includes('engine')
      ? [
          'engine',
          'afterburner',
          'rumble',
          'ambient',
          'missiles',
          'rescue',
          'hullAlarm',
          'edgeAlarm',
        ]
      : [];
    for (let i = 0; i < loopNames.length; i++) {
      await page.waitForTimeout(2500); // fade in
      const t0 = await now();
      await page.waitForTimeout(2500);
      const blocks = await tapSince(t0);
      const s = stats(blocks);
      report.loops[loopNames[i]] = { peak: s.peak, rmsDb: db(s.rms) };
      await row('sound.loop').click();
    }
    await row('sound.loopPreview').click();

    const phase = async (store, name, seconds, act) => {
      const t0 = await now();
      const wall = Date.now();
      await act();
      const rest = seconds * 1000 - (Date.now() - wall);
      if (rest > 0) await page.waitForTimeout(rest);
      const blocks = await tapSince(t0);
      const s = stats(blocks);
      store[name] = {
        peak: s.peak,
        rmsDb: db(s.rms),
        movementDb: movement(blocks),
        seconds: blocks.length ? blocks.at(-1)[0] - blocks[0][0] : 0,
      };
    };

    // 3: the flight bed on its own, in the practice arena with the enemies frozen (no enemy fire,
    //    no kills): idle, then throttle held (afterburner and rumble up), then the guns on top.
    await page.goto(`${base}/?dev&practice&style=${style}`);
    await page.getByRole('button', { name: /Debug/ }).click();
    await row('arena.enemiesFrozen').click();
    // No wingmen either: they would shoot and kill the frozen enemies.
    await page.getByRole('button', { name: /Wingmen/ }).click();
    const wingmen = row('squadron.wingmanCount');
    const wbox = await wingmen.boundingBox();
    await wingmen.dblclick({ position: { x: wbox.width - 20, y: wbox.height / 2 } });
    await page.keyboard.type('0');
    await page.keyboard.press('Enter');
    await page.mouse.click(5, 790); // unlock the audio without a game key
    await page.waitForTimeout(2500); // the loops fade in
    await phase(report.bed, 'idle', 6, async () => {});
    await phase(report.bed, 'throttle', 6, async () => page.keyboard.down('KeyW'));
    await phase(report.bed, 'throttle+guns', 8, async () => page.keyboard.down('Space'));
    await page.keyboard.up('Space');
    await page.keyboard.up('KeyW');

    // 4: a scripted battle (Start screen, Enter, then phases).
    await page.goto(`${base}/?style=${style}`);
    await page.locator('#run-menu').getByText('START RUN').waitFor();
    await page.keyboard.press('Enter'); // start the run (the first row of the Start screen)
    await page.locator('#run-hud').getByText('BATTLE 1/4').waitFor();
    await page.waitForTimeout(1500);
    await page.keyboard.down('KeyW');
    const phases = [
      ['wave 1 arrives', 8, async () => {}],
      [
        'guns',
        8,
        async () => {
          await page.keyboard.down('Space');
        },
      ],
      [
        'guns+missiles+turns',
        12,
        async () => {
          await page.keyboard.down('KeyD');
          for (let i = 0; i < 4; i++) {
            await page.keyboard.press('KeyE');
            await page.waitForTimeout(2500);
          }
          await page.keyboard.up('KeyD');
        },
      ],
      [
        'quiet',
        6,
        async () => {
          await page.keyboard.up('Space');
          await page.keyboard.up('KeyW');
        },
      ],
    ];
    for (const [name, seconds, act] of phases) await phase(report.battle, name, seconds, act);
    report.clipped = await page.evaluate(() => window.__clipped);
    report.errors = errors;

    // Rules.
    const worstPeak = Math.max(
      report.pileUp.peak,
      ...Object.values(report.sounds).map((s) => s.peak),
      ...Object.values(report.loops).map((s) => s.peak),
      ...Object.values(report.bed).map((s) => s.peak),
      ...Object.values(report.battle).map((s) => s.peak),
    );
    report.worstPeak = worstPeak;
    if (worstPeak > PEAK_LIMIT) failures.push(`peak ${worstPeak.toFixed(3)} is over ${PEAK_LIMIT}`);
    if (report.clipped > 0) failures.push(`${report.clipped} clipped samples`);
    if (errors.length) failures.push(`console errors: ${errors.join(' | ')}`);
    const gunRms = report.sounds.ShotFired?.rmsDb ?? -180;
    for (const [name, l] of Object.entries(report.loops)) {
      if (l.rmsDb > LOOP_FULL_MAX_DB)
        failures.push(`loop ${name} is loud at full level (${f1(l.rmsDb)} dBFS RMS)`);
    }
    const { idle, throttle } = report.bed;
    const guns = report.bed['throttle+guns'];
    if (idle.rmsDb > BED_IDLE_MAX_DB)
      failures.push(`the idle flight bed is loud (${f1(idle.rmsDb)} dBFS RMS)`);
    if (throttle.rmsDb > BED_MAX_DB)
      failures.push(`the flight bed at full throttle is loud (${f1(throttle.rmsDb)} dBFS RMS)`);
    if (guns.rmsDb - throttle.rmsDb < GUNS_OVER_BED_MIN_DB)
      failures.push(
        `gunfire stands only ${f1(guns.rmsDb - throttle.rmsDb)} dB over the bed (needs ${GUNS_OVER_BED_MIN_DB})`,
      );
    if (guns.movementDb < GUN_MOVEMENT_MIN_DB)
      failures.push(
        `gunfire moves only ${f1(guns.movementDb)} dB (needs ${GUN_MOVEMENT_MIN_DB}): it may be a constant buzz`,
      );
    report.gunSoloRmsDb = gunRms;
  } finally {
    await browser.close();
    server.kill();
  }

  const line = (name, o) =>
    `${name.padEnd(22)} peak ${o.peak.toFixed(3)}  rms ${f1(o.rmsDb).padStart(6)} dBFS` +
    (o.seconds !== undefined ? `  ${f1(o.seconds)} s` : '') +
    (o.movementDb !== undefined ? `  moves ${f1(o.movementDb)} dB` : '');
  console.log(`\nSounds on their own (${style}, Start screen, master 0.7):`);
  for (const [k, v] of Object.entries(report.sounds)) console.log(line(k, v));
  console.log(
    `\nPile-up (8 explosions, 4 missile impacts, 3 hull hits, 6 shots, 2 salvos at once): peak ${report.pileUp.peak.toFixed(3)}, rms ${f1(report.pileUp.rmsDb)} dBFS`,
  );
  console.log('\nLoops on their own at full level:');
  for (const [k, v] of Object.entries(report.loops)) console.log(line(k, v));
  console.log('\nFlight bed on its own (practice arena, enemies frozen):');
  for (const [k, v] of Object.entries(report.bed)) console.log(line(k, v));
  console.log('\nScripted battle:');
  for (const [k, v] of Object.entries(report.battle)) console.log(line(k, v));
  console.log(`\nworst peak ${report.worstPeak.toFixed(3)}, clipped samples ${report.clipped}`);
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 2));
  if (failures.length) {
    console.log(`\nFAILED:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
  console.log('\nAll level rules pass.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

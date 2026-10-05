// Contrast audit of the style packs (dev and CI tool, headless, software GL is fine).
//
//   node scripts/contrast-audit.mjs [style ...] [--port=4241] [--json=out.json] [--md=out.md] [--all]
//
// For every pack (all registered ones when none is named) it draws each ship slot the pack has,
// the player's and enemy bullets and the missile body on that pack's own backdrop, at three zoom
// levels (slowest flight, in between, top speed) and five spots on the screen, and measures how
// well the entity stands out from the pixels around it:
//   - the WCAG contrast ratio of its body and of its rim (outermost pixels) against the local
//     background: an entity reads when either is at least 3:1;
//   - the CIE76 colour difference from the local background;
//   - the share of its outline that stands 3:1 from its own neighbourhood.
// UI colours (HUD text, run HUD text, markers) are checked against the brightest places of the
// backdrop (95th percentile luminance): text needs 4.5:1, markers 3:1.
// Prints a table per pack; exit code 1 when anything fails (only with --strict). The worst case
// over zooms and spots is what counts.
import { writeFileSync } from 'node:fs';
import { flag, withLab } from './lib/lab-session.mjs';

const args = process.argv.slice(2);
const port = Number(flag(args, 'port', '4241'));
const jsonOut = flag(args, 'json', '');
const mdOut = flag(args, 'md', '');
const strict = args.includes('--strict');
const asked = args.filter((a) => !a.startsWith('--'));

const f1 = (x) => x.toFixed(1);
const pad = (s, n) => String(s).padEnd(n);

const results = await withLab(port, async (page) => {
  const ids = asked.length ? asked : await page.evaluate(() => window.lab.styles());
  const out = [];
  for (const id of ids) out.push(await page.evaluate((s) => window.lab.audit(s), id));
  return { ids, out };
});

/** Worst row per entity over the zooms. */
function worstPerEntity(rows) {
  const by = new Map();
  for (const r of rows) {
    const cur = by.get(r.entity);
    if (!cur || r.worst.ratio < cur.worst.ratio) by.set(r.entity, r);
  }
  return [...by.values()];
}

/** A ship that reads by its body alone: its rim is under 3:1 and under half of its edge stands out. Not a failure, a warning. */
const weakOutline = (r) =>
  r.pass && !r.entity.startsWith('shot') && r.worst.rimRatio < 3 && r.worst.edgeShare < 0.5;

let failures = 0;
const md = [];
const summary = [];
results.out.forEach((res, i) => {
  const id = results.ids[i];
  const worst = worstPerEntity(res.rows);
  console.log(`\n== ${id} ==`);
  console.log(
    `${pad('entity', 20)}${pad('side', 8)}${pad('worst at', 10)}${pad('ratio', 7)}${pad('body', 7)}${pad('rim', 7)}${pad('dE body', 9)}${pad('edge>=3', 9)}pass`,
  );
  md.push(`\n#### ${id}\n`);
  md.push(
    '| entity | side | worst zoom (u) | ratio | body | rim | dE (body) | edge share | pass |',
  );
  md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of worst) {
    const w = r.worst;
    if (!r.pass) failures++;
    const note = weakOutline(r) ? ' (weak outline)' : '';
    console.log(
      `${pad(r.entity, 20)}${pad(r.side, 8)}${pad(r.zoom, 10)}${pad(f1(w.ratio), 7)}${pad(f1(w.bodyRatio), 7)}${pad(f1(w.rimRatio), 7)}${pad(f1(w.deltaEBody), 9)}${pad(`${Math.round(w.edgeShare * 100)}%`, 9)}${r.pass ? 'ok' : 'FAIL'}${note}`,
    );
    md.push(
      `| ${r.entity} | ${r.side} | ${r.zoom} | ${f1(w.ratio)} | ${f1(w.bodyRatio)} | ${f1(w.rimRatio)} | ${f1(w.deltaEBody)} | ${Math.round(w.edgeShare * 100)}% | ${r.pass ? 'ok' : '**FAIL**'}${note} |`,
    );
  }
  const ui = [
    ...res.text.map((t) => ({ ...t, target: 4.5 })),
    ...res.markers.map((t) => ({ ...t, target: 3 })),
  ];
  console.log(`-- UI colours vs the brightest backdrop (text 4.5:1, markers 3:1)`);
  md.push('\n| UI colour | hex | ratio | target | pass |\n| --- | --- | --- | --- | --- |');
  for (const t of ui) {
    if (!t.pass) failures++;
    console.log(
      `${pad(t.text, 50)}${pad(t.color, 9)}${pad(f1(t.ratio), 6)}${t.pass ? 'ok' : 'FAIL'}`,
    );
    md.push(
      `| ${t.text} | ${t.color} | ${f1(t.ratio)} | ${t.target} | ${t.pass ? 'ok' : '**FAIL**'} |`,
    );
  }
  const enemies = worst.filter((r) => r.side === 'enemy' && r.entity !== 'shot: enemy bullet');
  summary.push({
    id,
    enemyMin: Math.min(...enemies.map((r) => r.worst.ratio)),
    entityMin: Math.min(...worst.map((r) => r.worst.ratio)),
    fails: worst.filter((r) => !r.pass).length + ui.filter((t) => !t.pass).length,
  });
});

console.log('\n== summary (worst case over zooms and spots) ==');
console.log(
  `${pad('style', 14)}${pad('weakest enemy', 15)}${pad('weakest entity', 16)}failing rows`,
);
for (const s of summary)
  console.log(`${pad(s.id, 14)}${pad(f1(s.enemyMin), 15)}${pad(f1(s.entityMin), 16)}${s.fails}`);
md.push(
  '\n| style | weakest enemy ratio | weakest entity ratio | failing rows |\n| --- | --- | --- | --- |',
);
for (const s of summary)
  md.push(`| ${s.id} | ${f1(s.enemyMin)} | ${f1(s.entityMin)} | ${s.fails} |`);

if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results.out, null, 2));
if (mdOut) writeFileSync(mdOut, md.join('\n') + '\n');
if (strict && failures > 0) {
  console.error(`\n${failures} contrast check(s) failed`);
  process.exit(1);
}

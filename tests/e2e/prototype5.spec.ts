import { expect, test, type Page } from '@playwright/test';

const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
};

const panel = (page: Page) => page.locator('#tuning-panel');
const open = (page: Page, name: string) =>
  panel(page).getByRole('button', { name: new RegExp(`^. ${name}$`) });
const button = (page: Page, name: string) => panel(page).getByRole('button', { name, exact: true });
const status = (page: Page, text: RegExp) =>
  panel(page).locator('[role=status]').filter({ hasText: text });

/** Saves a screenshot of the game (panel hidden) when `P5_SHOTS` names a folder: how docs/reference/prototype-5 was made. */
async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.P5_SHOTS;
  if (!dir) return;
  await page.evaluate(() => {
    const p = document.getElementById('tuning-panel');
    if (p) p.style.visibility = 'hidden';
  });
  await page.screenshot({ path: `${dir}/${name}.png` });
  await page.evaluate(() => {
    const p = document.getElementById('tuning-panel');
    if (p) p.style.visibility = 'visible';
  });
}

/** Gold pixels of the capital bar's band (top of the HUD canvas). */
const barPixels = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#hud');
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return -1;
    const dpr = canvas.width / window.innerWidth;
    const w = Math.round(canvas.width * 0.6);
    const x = Math.round((canvas.width - w) / 2);
    const data = g.getImageData(x, Math.round(8 * dpr), w, Math.round(12 * dpr)).data;
    let painted = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! > 240 && data[i + 1]! > 195 && data[i + 1]! < 225 && data[i + 2]! < 100)
        painted++;
    }
    return painted;
  });

test.describe('prototype 5: one journey through the new enemies', () => {
  test('a run: wing, gunship, lancer with missile warning, then the capital ship; no console errors', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = errorsOf(page);
    await page.goto('/?dev');
    await expect(panel(page)).toBeVisible();
    await open(page, 'Run phase').click();
    await button(page, 'Jump: Battle 1').click();
    await expect(page.locator('#run-hud .objective')).toContainText('BATTLE 1');

    await open(page, 'Spawn').click();
    // The wing: its cue shows while it flies in formation.
    await button(page, 'Clear all enemies (X)').click();
    await button(page, 'Spawn Formation wing').click();
    await expect(page.locator('#run-hud .cue')).toContainText('WING INBOUND');
    await shot(page, 'wing');

    // The gunship.
    await button(page, 'Clear all enemies (X)').click();
    await button(page, 'Spawn Gunship').click();
    await expect(status(page, /1 gunships/)).toBeVisible();
    await page.waitForTimeout(600);
    await shot(page, 'gunship');

    // The missile fighter (the squad may shoot it down before it fires: `lancer.spec.ts` covers the missile and its warning in practice).
    await button(page, 'Clear all enemies (X)').click();
    await button(page, 'Spawn Missile fighter').click();
    await expect(status(page, /1 fighters/)).toBeVisible();
    await shot(page, 'lancer');

    // Battle 4: the capital ship, its bar, escorts coming.
    if (!(await button(page, 'Jump: Battle 4').isVisible())) await open(page, 'Run phase').click();
    await button(page, 'Jump: Battle 4').click();
    await expect(page.locator('#run-hud .objective')).toContainText('BATTLE 4');
    await expect(status(page, /capital: 17\/17 parts, core shielded by 4 plates/)).toBeVisible();
    await page.waitForTimeout(800);
    expect(await barPixels(page)).toBeGreaterThan(20);
    await shot(page, 'capital-boss');
    await button(page, 'Next wave').click(); // sends an escort wing right away
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});

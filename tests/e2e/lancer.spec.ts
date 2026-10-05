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

/** Red HUD pixels (the MISSILE text, arrow and markers) in the strip where the warning text is drawn. */
const warningPixels = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const canvas = document.getElementById('hud') as HTMLCanvasElement | null;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return 0;
    const k = canvas.width / window.innerWidth;
    const w = Math.round(500 * k);
    const x = Math.round((window.innerWidth / 2) * k - w / 2);
    const data = g.getImageData(x, Math.round(88 * k), w, Math.round(32 * k)).data;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! > 200 && data[i + 1]! < 130 && data[i + 2]! < 130 && data[i + 3]! > 200) n++;
    }
    return n;
  });

test('a spawned missile fighter fires a missile and the MISSILE warning shows', async ({
  page,
}) => {
  const errors = errorsOf(page);
  await page.goto('/?dev&practice');
  await expect(panel(page)).toBeVisible();
  await open(page, 'Spawn').click();
  await expect(button(page, 'Spawn Missile fighter')).toBeAttached();
  // Practice waves are noise here: clear them, then bring in one lancer.
  await button(page, 'Clear all enemies (X)').click();
  await button(page, 'Spawn Missile fighter').click();
  await expect(
    panel(page)
      .locator('[role=status]')
      .filter({ hasText: /1 fighters/ }),
  ).toBeVisible();
  // It fires within a few seconds (interval 6 s, first launch staggered) and the status counts the missile.
  await expect(
    panel(page)
      .locator('[role=status]')
      .filter({ hasText: /[1-9]\d* enemy missiles/ }),
  ).toBeVisible({ timeout: 20_000 });
  // The warning is blinking, so look for red pixels for a while.
  await expect.poll(() => warningPixels(page), { timeout: 5000 }).toBeGreaterThan(50);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

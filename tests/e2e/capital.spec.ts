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

/**
 * Gold pixels (the core outline and the shield underline of the bar, #ffd24a) in the top band of the
 * HUD canvas where the capital ship bar lives, above every other HUD line. Edge arrows of other
 * enemies can touch that band too, but none of them is gold.
 */
async function barPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
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
}

test.describe('capital ship', () => {
  test('jumping to battle 4 brings the capital ship: parts, the health bar, no console errors', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await page.goto('/?dev');
    await expect(panel(page)).toBeVisible();
    await open(page, 'Run phase').click();
    await button(page, 'Jump: Battle 4').click();
    await expect(page.locator('#run-hud .objective')).toContainText('BATTLE 4');
    await open(page, 'Spawn').click();
    await expect(status(page, /capital: 17\/17 parts, core shielded by 4 plates/)).toBeVisible();
    await page.waitForTimeout(800);
    expect(await barPixels(page)).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  });

  test('the Spawn section has a capital ship button; spawning it in practice shows its parts and bar', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await page.goto('/?dev&practice');
    await expect(panel(page)).toBeVisible();
    await open(page, 'Spawn').click();
    expect(await barPixels(page)).toBe(0); // no capital ship, no bar
    await button(page, 'Spawn Capital ship').click();
    await expect(status(page, /capital: 17\/17 parts/)).toBeVisible();
    await page.waitForTimeout(800);
    expect(await barPixels(page)).toBeGreaterThan(20);
    // A second spawn replaces the first (there is only ever one capital ship).
    await button(page, 'Spawn Capital ship').click();
    await expect(status(page, /capital: 17\/17 parts/)).toBeVisible();
    // Clear battle in a run kills the core; in practice "Clear all enemies" removes it.
    await button(page, 'Clear all enemies (X)').click();
    await expect(status(page, /capital:/)).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await barPixels(page)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('clearing battle 4 runs the death chain to the victory without errors', async ({ page }) => {
    const errors = errorsOf(page);
    await page.goto('/?dev');
    await expect(panel(page)).toBeVisible();
    await open(page, 'Run phase').click();
    await button(page, 'Jump: Battle 4').click();
    await page.waitForTimeout(500);
    await button(page, 'Clear battle').click();
    await page.waitForTimeout(1500);
    expect(await barPixels(page)).toBeGreaterThan(0); // still breaking up
    await expect(status(page, /now: end \(victory\)/)).toBeVisible({ timeout: 15000 });
    expect(errors).toEqual([]);
  });
});

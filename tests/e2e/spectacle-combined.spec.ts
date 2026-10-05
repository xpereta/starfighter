import { expect, test, type Page } from '@playwright/test';

const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
};

const visuals = (page: Page) =>
  page.evaluate(() => {
    const s = (globalThis as never as { __spectacle: { settings: Record<string, boolean> } })
      .__spectacle.settings;
    return { cards: s.cards, zoomPunch: s.zoomPunch };
  });

test('visuals and presentation together: no double title cards, one zoom punch, no errors', async ({
  page,
}) => {
  const errors = errorsOf(page);
  await page.goto('/?style=anime-spectacle&dev');
  await page.keyboard.press('Enter');
  await expect(page.locator('#run-hud')).toContainText('BATTLE 1/4');
  await page.waitForTimeout(600);
  expect(await visuals(page)).toEqual({ cards: false, zoomPunch: false });
  await expect(page.locator('#sf-cards.intro')).toHaveCount(0); // the presentation banner shows instead
  await page.getByRole('button', { name: /Spectacle visuals/ }).click();
  await page.getByRole('button', { name: /Spectacle presentation/ }).click();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('with the presentation off the visuals keep their cards and punch', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('/?style=anime-spectacle&dev&spectacle=off');
  await page.waitForTimeout(600);
  expect(await visuals(page)).toEqual({ cards: true, zoomPunch: true });
  expect(errors).toEqual([]);
});

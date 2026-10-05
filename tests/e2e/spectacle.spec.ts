import { expect, test, type Page } from '@playwright/test';

const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
};

const row = (page: Page, param: string) => page.locator(`#tuning-panel [data-param="${param}"]`);

async function fly(page: Page, ms = 1500): Promise<void> {
  await page.keyboard.down('w');
  await page.keyboard.down('Space');
  await page.waitForTimeout(ms);
  await page.keyboard.up('Space');
  await page.keyboard.up('w');
}

// The anime-spectacle pack at every quality level (`?fx=`), practice field and a run.
for (const fx of ['low', 'medium', 'high']) {
  test(`?style=anime-spectacle&fx=${fx} loads and flies without console errors`, async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await page.goto(`/?style=anime-spectacle&fx=${fx}&practice`);
    await expect(page.locator('canvas').first()).toBeVisible();
    await fly(page);
    expect(errors).toEqual([]);
  });
}

// The visuals' title cards are off while the presentation banners are on (see spectacle-combined.spec.ts),
// so this one turns the presentation off to see them.
test('a run with the spectacle pack: start a battle and fly without console errors', async ({
  page,
}) => {
  const errors = errorsOf(page);
  await page.goto('/?style=anime-spectacle&spectacle=off');
  await page.keyboard.press('Enter');
  await expect(page.locator('#run-hud')).toContainText('BATTLE 1/4');
  await expect(page.locator('#sf-cards')).toHaveClass(/intro/); // the intro title card
  await expect(page.locator('#sf-cards .title')).toHaveText('FIRST CONTACT');
  await fly(page, 2500);
  expect(errors).toEqual([]);
});

test('the Spectacle panel section has quality, switches and sliders, and works live', async ({
  page,
}) => {
  const errors = errorsOf(page);
  await page.goto('/?dev&practice&style=anime-spectacle');
  await expect(page.locator('#tuning-panel')).toBeVisible();
  await page.getByRole('button', { name: /Spectacle visuals/ }).click();
  await expect(row(page, 'spectacle.quality')).toContainText('high');
  for (const p of ['post', 'bloom', 'backdrop', 'ships', 'combat', 'cards'])
    await expect(row(page, `spectacle.${p}`)).toBeVisible();
  await expect(row(page, 'spectacle.post.bloom.strength')).toBeVisible();
  await expect(row(page, 'spectacle.post.vignette')).toBeVisible();
  await expect(row(page, 'spectacle.backdrop.nebula.strength')).toBeVisible();
  await page.getByRole('button', { name: 'Demo blasts' }).click();
  await page.waitForTimeout(400);
  await row(page, 'spectacle.sky').click(); // auto -> battle 1 ... cycle through the skies
  await row(page, 'spectacle.sky').click();
  await row(page, 'spectacle.quality').click(); // high -> low
  await expect(row(page, 'spectacle.quality')).toContainText('low');
  await row(page, 'spectacle.post').click(); // off
  await row(page, 'spectacle.post').click(); // on again
  await fly(page, 800);
  expect(errors).toEqual([]);
});

test('on a style without a spectacle the section only explains', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('/?dev&practice&style=anime-80s');
  await page.getByRole('button', { name: /Spectacle visuals/ }).click();
  await expect(page.locator('#tuning-panel')).toContainText('no spectacle');
  await expect(row(page, 'spectacle.post.bloom.strength')).toHaveCount(0);
  expect(errors).toEqual([]);
});

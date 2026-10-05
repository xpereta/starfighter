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

test.describe('panel Look section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?dev&practice&style=anime-80s');
    await expect(page.locator('#tuning-panel')).toBeVisible();
    await page.getByRole('button', { name: /Look/ }).click();
  });

  test('has the style picker, colour rows, outline and shadow sliders, save and compare rows', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await expect(row(page, 'style.id')).toContainText('anime-80s');
    await expect(row(page, 'look.color.friendly')).toBeVisible();
    await expect(row(page, 'look.color.background')).toBeVisible();
    await expect(row(page, 'look.outlineWidth')).toBeVisible();
    await expect(row(page, 'look.outlineWidth')).toContainText('2.0 u');
    await expect(row(page, 'look.shadowShare')).toBeVisible();
    await expect(row(page, 'look.glow')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save style (JSON)' })).toBeVisible();
    await expect(row(page, 'look.peekStyle')).toContainText('plain');
    await expect(row(page, 'look.screenshot')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('editing a colour and the outline width marks them changed and shows no errors', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    const colour = row(page, 'look.color.friendly');
    await expect(colour).toHaveAttribute('data-changed', 'false');
    await colour.locator('input[type=color]').fill('#ff0000');
    await expect(colour).toHaveAttribute('data-changed', 'true');
    const width = row(page, 'look.outlineWidth');
    const box = (await width.boundingBox())!;
    await width.dblclick({ position: { x: box.width - 25, y: box.height / 2 } });
    await width.locator('input.edit').fill('5');
    await width.locator('input.edit').press('Enter');
    await expect(width).toContainText('5.0 u');
    await expect(width).toHaveAttribute('data-changed', 'true');
    await page.waitForTimeout(400);
    expect(errors).toEqual([]);
  });

  test('Save style downloads the edited theme as JSON', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Save style (JSON)' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('anime-80s-theme.json');
  });

  test('K hides the HUD, overlays and panel for a screenshot, and brings them back', async ({
    page,
  }) => {
    await expect(page.locator('canvas#hud')).toBeVisible();
    await page.keyboard.press('k');
    await expect(page.locator('canvas#hud')).toBeHidden();
    await expect(page.locator('#tuning-panel')).toBeHidden();
    await page.keyboard.press('k');
    await expect(page.locator('canvas#hud')).toBeVisible();
    await expect(page.locator('#tuning-panel')).toBeVisible();
  });

  test('holding V peeks at the other style and releasing flips back, without errors', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await page.keyboard.down('v');
    await page.waitForTimeout(300);
    await page.keyboard.up('v');
    await page.waitForTimeout(300);
    await expect(row(page, 'style.id')).toContainText('anime-80s');
    expect(errors).toEqual([]);
  });
});

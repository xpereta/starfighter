import { expect, test } from '@playwright/test';

test('page loads, canvas renders, no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  await expect(page.locator('canvas#hud')).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test.describe('high-DPI screens', () => {
  test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });

  test('the HUD overlay covers exactly the viewport (not 2x it)', async ({ page }) => {
    await page.goto('/');
    const box = await page.locator('canvas#hud').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(1280, 0);
    expect(box!.height).toBeCloseTo(800, 0);
  });
});

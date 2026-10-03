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

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

test('dev tools load only with ?dev, and work without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await page.waitForTimeout(300);
  await expect(page.locator('.lil-gui')).toHaveCount(0);

  await page.goto('/?dev');
  await expect(page.locator('.lil-gui').first()).toBeVisible();
  await page.keyboard.press('Backquote'); // debug overlay on
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('replay: record a run, play it back, and it matches', async ({ page }) => {
  await page.goto('/?dev');
  await page.getByRole('button', { name: /Replay/ }).click();
  const status = page.locator('.lil-gui input[disabled]').last();

  await page.getByText('Record (restarts the run)').click();
  await page.keyboard.down('KeyW');
  await page.keyboard.down('Space');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('Space');
  await page.keyboard.up('KeyW');
  await page.getByText('Stop', { exact: true }).click();
  await expect(status).toHaveValue(/recorded/);

  await page.getByText('Verify (headless)').click();
  await expect(status).toHaveValue(/verify OK/);

  await page.getByText('Play', { exact: true }).click();
  await expect(status).toHaveValue(/matches the recording/, { timeout: 15_000 });
});

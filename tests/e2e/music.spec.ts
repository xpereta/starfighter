import { expect, test } from '@playwright/test';
import { styles } from '../../data/styles';

// Runs only once the spectacle pack is registered (its folder is owned by another track).
test.skip(!('anime-spectacle' in styles), 'the anime-spectacle pack is not registered yet');

test('?style=anime-spectacle: the score runs, the panel shows it and a stinger plays, no console errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?dev&style=anime-spectacle');
  await page.getByRole('button', { name: /Sound/ }).click();
  await page.mouse.click(5, 790); // unlock the audio
  const status = page.locator('#tuning-panel [data-music-status]');
  await expect(status).toContainText(/bar \d+\/\d+/, { timeout: 5000 });
  await expect(page.locator('#tuning-panel [data-music-stems]')).toContainText('on:');
  await page.locator('#tuning-panel [data-param="music.forceIntensity"]').click();
  await page.waitForTimeout(500);
  await page.getByText('▶ Play the stinger').click();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

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

test.describe('dev panel: run phase and spawn', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?dev');
    await expect(panel(page)).toBeVisible();
  });

  test('the Run phase and Spawn sections exist with their buttons', async ({ page }) => {
    await expect(open(page, 'Run phase')).toBeVisible();
    await expect(open(page, 'Spawn')).toBeVisible();
    await open(page, 'Run phase').click();
    for (const name of [
      'Jump: Start screen',
      'Jump: Battle 1',
      'Jump: Battle 4',
      'Jump: Debrief',
      'Jump: End: victory',
      'Jump: End: defeat',
      'Next battle (N)',
      'Next wave',
      'Clear battle',
      'Restore hull and squad',
    ]) {
      await expect(button(page, name)).toBeAttached();
    }
    await open(page, 'Spawn').click();
    for (const name of [
      'Spawn Fighter',
      'Spawn Gunship',
      'Spawn Formation wing',
      'Spawn Drone',
      'Spawn Turret',
      'Spawn Static dummy',
      'Spawn Rescue pod',
      'Clear all enemies (X)',
    ]) {
      await expect(button(page, name)).toBeAttached();
    }
  });

  test('a jump to battle 3 works and the objective shows BATTLE 3', async ({ page }) => {
    const errors = errorsOf(page);
    await open(page, 'Run phase').click();
    await button(page, 'Jump: Battle 3').click();
    await expect(page.locator('#run-hud .objective')).toContainText('BATTLE 3');
    await expect(status(page, /now: battle 3\/4/)).toBeVisible();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('keys N and X: next battle and clear enemies', async ({ page }) => {
    await page.keyboard.press('n');
    await expect(page.locator('#run-hud .objective')).toContainText('BATTLE 1');
    await page.keyboard.press('n');
    await expect(page.locator('#run-hud .objective')).toContainText('BATTLE 2');
    await open(page, 'Spawn').click();
    await button(page, 'Spawn Fighter').click();
    await page.keyboard.press('x');
    await expect(status(page, /enemies alive: 0 fighters, 0 targets/)).toBeVisible();
  });

  test('spawning a fighter increases the enemy count', async ({ page }) => {
    const errors = errorsOf(page);
    await open(page, 'Run phase').click();
    await button(page, 'Jump: Battle 1').click();
    // Frozen enemies bring no natural waves, so the counts below are exact.
    await open(page, 'Debug').click();
    await panel(page).locator('[data-param="arena.enemiesFrozen"]').click();
    await open(page, 'Spawn').click();
    await button(page, 'Clear all enemies (X)').click();
    await expect(status(page, /enemies alive: 0 fighters/)).toBeVisible();
    await button(page, 'Spawn Fighter').click();
    await expect(status(page, /enemies alive: 1 fighters/)).toBeVisible();
    await panel(page).locator('[data-param="dev.spawnCount"]').click(); // 1 -> 3
    await button(page, 'Spawn Fighter').click();
    await expect(status(page, /enemies alive: 4 fighters/)).toBeVisible();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('a spawned gunship appears, shoots, and the page has no console errors', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await open(page, 'Run phase').click();
    await button(page, 'Jump: Battle 2').click();
    await open(page, 'Debug').click();
    await panel(page).locator('[data-param="arena.enemiesFrozen"]').click();
    await open(page, 'Spawn').click();
    await button(page, 'Clear all enemies (X)').click();
    await button(page, 'Spawn Gunship').click();
    await expect(status(page, /enemies alive: 1 fighters \(1 gunships\)/)).toBeVisible();
    // Unfreeze: its turrets open fire on the player (the page must keep running without errors).
    await panel(page).locator('[data-param="arena.enemiesFrozen"]').click();
    await page.waitForTimeout(3000);
    await expect(status(page, /\(1 gunships\)/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a spawned formation wing arrives with the WING INBOUND cue', async ({ page }) => {
    const errors = errorsOf(page);
    await open(page, 'Run phase').click();
    await button(page, 'Jump: Battle 1').click();
    await open(page, 'Debug').click();
    await panel(page).locator('[data-param="arena.enemiesFrozen"]').click();
    await open(page, 'Spawn').click();
    await button(page, 'Clear all enemies (X)').click();
    await button(page, 'Spawn Formation wing').click();
    await expect(status(page, /enemies alive: 4 fighters/)).toBeVisible();
    await expect(page.locator('#run-hud .cue')).toContainText('WING INBOUND');
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('a jump is refused while a replay is recording', async ({ page }) => {
    await open(page, 'Replay').click();
    await button(page, 'Record (restarts the run)').click();
    await open(page, 'Run phase').click();
    await button(page, 'Jump: Battle 3').click();
    await expect(status(page, /refused: a replay is recording/)).toBeVisible();
    await button(page, 'Stop').click();
    await button(page, 'Jump: Battle 3').click();
    await expect(page.locator('#run-hud .objective')).toContainText('BATTLE 3');
  });
});

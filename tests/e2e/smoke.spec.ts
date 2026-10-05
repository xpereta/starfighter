import { expect, test, type Page } from '@playwright/test';
import { styles } from '../../data/styles';
import { tuningParams } from '../../data/tuning';

const GRIP = tuningParams.flight.grip.default;
const VIEW_MIN = tuningParams.camera.viewMin.default;

const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
};

const row = (page: Page, param: string) => page.locator(`#tuning-panel [data-param="${param}"]`);
const value = (page: Page, param: string) => row(page, param).locator('.txt.light .val');

test('page loads, canvas renders, no console errors', async ({ page }) => {
  const errors = errorsOf(page);
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
  const errors = errorsOf(page);
  await page.goto('/');
  await page.waitForTimeout(300);
  await expect(page.locator('#tuning-panel')).toHaveCount(0);

  await page.goto('/?dev');
  await expect(page.locator('#tuning-panel')).toBeVisible();
  await page.keyboard.press('g'); // debug overlay on
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('replay: record a run, play it back, and it matches', async ({ page }) => {
  await page.goto('/?dev');
  await page.getByRole('button', { name: /Replay/ }).click();
  const status = page.locator('#tuning-panel [role=status]:visible .msg');

  await page.getByRole('button', { name: 'Record (restarts the run)' }).click();
  await page.keyboard.down('KeyW');
  await page.keyboard.down('Space');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('Space');
  await page.keyboard.up('KeyW');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(status).toHaveText(/recorded/);

  await page.getByRole('button', { name: 'Verify (headless)' }).click();
  await expect(status).toHaveText(/verify OK/);

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(status).toHaveText(/matches the recording/, { timeout: 15_000 });
});

test.describe('tuning panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?dev');
    await expect(page.locator('#tuning-panel')).toBeVisible();
  });

  test('one row per parameter with a short label, the value and a unit; the panel stays narrow', async ({
    page,
  }) => {
    const grip = row(page, 'flight.grip');
    await expect(grip).toBeVisible();
    await expect(grip.locator('.txt.light .label')).toHaveText('Grip');
    await expect(value(page, 'flight.grip')).toHaveText(`${GRIP} 1/s`);
    // Two text layers (light on track, dark inside the fill) and a fill in the same row.
    await expect(grip.locator('.txt')).toHaveCount(2);
    await expect(grip.locator('.fill')).toHaveCount(1);
    const panel = await page.locator('#tuning-panel').boundingBox();
    expect(panel!.width).toBeLessThanOrEqual(260);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });

  test('double-click the value to type it, double-click the label to reset', async ({ page }) => {
    const grip = row(page, 'flight.grip');
    await expect(grip).toHaveAttribute('data-changed', 'false');
    const box = (await grip.boundingBox())!;
    await grip.dblclick({ position: { x: box.width - 25, y: box.height / 2 } });
    const input = grip.locator('input.edit');
    await expect(input).toBeFocused();
    await input.fill('9');
    await input.press('Enter');
    await expect(value(page, 'flight.grip')).toHaveText('9.00 1/s');
    await expect(grip).toHaveAttribute('data-changed', 'true');

    await grip.dblclick({ position: { x: 25, y: box.height / 2 } });
    await expect(value(page, 'flight.grip')).toHaveText(`${GRIP} 1/s`);
    await expect(grip).toHaveAttribute('data-changed', 'false');
  });

  test('dragging the bar sets the value, and no panel control keeps keyboard focus afterwards', async ({
    page,
  }) => {
    const grip = row(page, 'flight.grip');
    const box = (await grip.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.1, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, y, { steps: 8 });
    await page.mouse.up();
    const text = await value(page, 'flight.grip').innerText();
    const dragged = Number.parseFloat(text);
    expect(dragged).toBeGreaterThan(12);
    expect(dragged).toBeLessThan(18);

    // Focus is back on the page, so game keys are not captured and arrows do not nudge the slider.
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await expect(value(page, 'flight.grip')).toHaveText(text);
  });

  test('clicking a panel button or a toggle also hands the keyboard back to the game', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Presets/ }).click();
    await page.getByRole('button', { name: 'Reset all to defaults' }).click();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await row(page, 'flight.steering').click();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await expect(row(page, 'flight.steering')).toHaveAttribute('data-changed', 'true');
  });

  test('cross-field rules: viewMax cannot go below viewMin', async ({ page }) => {
    await page.getByRole('button', { name: /Camera/ }).click();
    const viewMax = row(page, 'camera.viewMax');
    const box = (await viewMax.boundingBox())!;
    await viewMax.dblclick({ position: { x: box.width - 25, y: box.height / 2 } });
    await viewMax.locator('input.edit').fill('1100');
    await viewMax.locator('input.edit').press('Enter');
    await expect(value(page, 'camera.viewMax')).toHaveText(`${VIEW_MIN} u`); // clamped to viewMin and shown
  });

  test('H hides and shows the whole panel', async ({ page }) => {
    await page.keyboard.press('h');
    await expect(page.locator('#tuning-panel')).toBeHidden();
    await page.keyboard.press('h');
    await expect(page.locator('#tuning-panel')).toBeVisible();
  });

  test('show only changed hides rows that still have their default', async ({ page }) => {
    const grip = row(page, 'flight.grip');
    const box = (await grip.boundingBox())!;
    await grip.dblclick({ position: { x: box.width - 25, y: box.height / 2 } });
    await grip.locator('input.edit').fill('9');
    await grip.locator('input.edit').press('Enter');

    await row(page, 'ui.changedOnly').click();
    await expect(grip).toBeVisible();
    await expect(row(page, 'flight.accel')).toBeHidden();
    await row(page, 'ui.changedOnly').click();
    await expect(row(page, 'flight.accel')).toBeVisible();
  });

  test('hovering a row shows a plain-language tooltip that fits on screen; it is also the aria description', async ({
    page,
  }) => {
    const grip = row(page, 'flight.grip');
    await expect(grip).toHaveAttribute('aria-description', /glued to the nose/);
    await grip.hover();
    const tip = page.locator('.sf-tip');
    await expect(tip).toBeVisible({ timeout: 2000 });
    await expect(tip).toContainText('glued to the nose');
    await expect(tip).toContainText(`Default ${GRIP}`);
    const t = (await tip.boundingBox())!;
    const p = (await page.locator('#tuning-panel').boundingBox())!;
    const vp = page.viewportSize()!;
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.y).toBeGreaterThanOrEqual(0);
    expect(t.x + t.width).toBeLessThanOrEqual(vp.width);
    expect(t.y + t.height).toBeLessThanOrEqual(vp.height);
    expect(t.width).toBeLessThanOrEqual(262);
    expect(t.x + t.width).toBeLessThanOrEqual(p.x); // flipped to the left of the panel
    await page.mouse.move(5, 5);
    await expect(tip).toBeHidden();
  });

  test('the tooltip appears after a short delay, not instantly', async ({ page }) => {
    await row(page, 'flight.grip').hover();
    await expect(page.locator('.sf-tip')).toBeHidden(); // immediately after hovering
    await expect(page.locator('.sf-tip')).toBeVisible({ timeout: 1500 });
  });
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

  test('the debug overlay covers exactly the viewport too', async ({ page }) => {
    await page.goto('/?dev');
    await expect(page.locator('#tuning-panel')).toBeVisible();
    const box = await page.locator('canvas#debug-overlay').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(1280, 0);
    expect(box!.height).toBeCloseTo(800, 0);
  });

  test('the tuning panel is not scaled up either', async ({ page }) => {
    await page.goto('/?dev');
    const box = await page.locator('#tuning-panel').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(260);
  });
});

test.describe('debug keys and freeze', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?dev');
    await expect(page.locator('#tuning-panel')).toBeVisible();
  });

  test('H hides the panel and a hint on the game screen names the keys; G toggles the overlay row', async ({
    page,
  }) => {
    const hint = page.locator('.dev-hint');
    await expect(hint).toBeHidden(); // the panel header already shows the keys
    await expect(page.locator('#tuning-panel .header')).toContainText('G debug');
    await page.keyboard.press('h');
    await expect(page.locator('#tuning-panel')).toBeHidden();
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('G debug overlay');
    await page.keyboard.press('h');
    await expect(hint).toBeHidden();

    await page.getByRole('button', { name: /Debug/ }).click();
    const overlay = row(page, 'debug.overlay');
    await expect(overlay).toContainText('(G)');
    await expect(overlay).toHaveAttribute('data-changed', 'false');
    await page.keyboard.press('g');
    await expect(overlay).toContainText(/true|on/i);
  });

  test('the Freeze enemies row in the Debug section toggles the setting', async ({ page }) => {
    await page.getByRole('button', { name: /Debug/ }).click();
    const freeze = row(page, 'arena.enemiesFrozen');
    await expect(freeze).toBeVisible();
    await expect(freeze).toContainText('Freeze enemies');
    await expect(freeze).toHaveAttribute('data-changed', 'false');
    await freeze.click();
    await expect(freeze).toHaveAttribute('data-changed', 'true');
    await freeze.click();
    await expect(freeze).toHaveAttribute('data-changed', 'false');
  });
});

test.describe('prototype 2 panel sections and overlay', () => {
  test('the panel has sections for lock-on, missiles, enemy fighter, wingmen and arena, and one freeze row', async ({
    page,
  }) => {
    await page.goto('/?dev');
    await expect(page.locator('#tuning-panel')).toBeVisible();
    for (const name of ['Lock-on', 'Missiles', 'Enemy fighter', 'Wingmen', 'Arena']) {
      await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    }
    await page.getByRole('button', { name: /Arena/ }).click();
    await expect(row(page, 'arena.droneCount')).toBeVisible();
    await expect(row(page, 'arena.enemiesFrozen')).toHaveCount(1); // only in the Debug section
  });

  test('the debug overlay draws enemies, wingmen and missile lines without errors once a wave has arrived', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await page.goto('/?dev&practice');
    await expect(page.locator('#tuning-panel')).toBeVisible();
    await page.keyboard.press('g');
    await page.keyboard.down('w');
    await page.waitForTimeout(9000); // the first wave spawns after its delay
    await page.keyboard.up('w');
    expect(errors).toEqual([]);
  });
});

test.describe('pause', () => {
  test('P pauses the game with an overlay, the world stands still, and P resumes', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await page.goto('/?practice');
    await expect(page.locator('canvas#hud')).toBeVisible();
    const overlay = page.locator('#pause-overlay');
    await expect(overlay).toBeHidden();
    const tick = async (): Promise<number> => Number(await overlay.getAttribute('data-tick'));
    await expect.poll(tick).toBeGreaterThan(5); // the world is running

    await page.keyboard.press('p');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('PAUSED');
    await expect(overlay).toContainText('resume');
    const frozen = await tick();
    await page.keyboard.down('w'); // flight keys while paused do nothing
    await page.waitForTimeout(500);
    await page.keyboard.up('w');
    expect(await tick()).toBe(frozen);

    await page.keyboard.press('p');
    await expect(overlay).toBeHidden();
    await expect.poll(tick).toBeGreaterThan(frozen);

    await page.keyboard.press('Escape'); // Esc pauses too
    await expect(overlay).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the Start menu is not pausable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#run-menu')).toContainText('START RUN');
    await page.keyboard.press('p');
    await expect(page.locator('#pause-overlay')).toBeHidden();
  });
});

test.describe('run menus', () => {
  test('practice mode shows no menu, and the flight keys still work', async ({ page }) => {
    const errors = errorsOf(page);
    await page.goto('/?practice');
    await expect(page.locator('canvas#hud')).toBeVisible();
    await page.keyboard.press('Enter'); // a menu key does nothing in practice
    await page.keyboard.down('w');
    await page.waitForTimeout(500);
    await page.keyboard.up('w');
    await expect(page.locator('#run-menu')).toBeHidden();
    await expect(page.locator('#run-hud')).toBeHidden(); // no roster, objective or chatter in practice
    expect(errors).toEqual([]);
  });

  test('the game opens on the Start screen; Enter starts battle 1 with the roster and objective', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await page.goto('/');
    await expect(page.locator('#run-menu')).toContainText('START RUN');
    await page.keyboard.press('Enter');
    await expect(page.locator('#run-menu')).toBeHidden();
    await expect(page.locator('#run-hud')).toBeVisible();
    await expect(page.locator('#run-hud')).toContainText('BATTLE 1/4');
    expect(errors).toEqual([]);
  });
});

// Every shipped style (data/styles), plus an unknown one that only warns.
for (const style of [...Object.keys(styles), 'no-such-style']) {
  test(`?style=${style} loads without console errors`, async ({ page }) => {
    const errors = errorsOf(page);
    await page.goto(`/?style=${style}&practice`);
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.keyboard.down('w');
    await page.keyboard.down('Space');
    await page.waitForTimeout(1500);
    await page.keyboard.up('Space');
    await page.keyboard.up('w');
    expect(errors).toEqual([]); // the unknown style only warns
  });
}

test('the panel has Look and Sound sections with a Style picker showing plain', async ({
  page,
}) => {
  const errors = errorsOf(page);
  await page.goto('/?dev&style=plain');
  await expect(page.getByRole('button', { name: /Look/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sound/ })).toBeVisible();
  await page.getByRole('button', { name: /Look/ }).click();
  await expect(page.locator('#tuning-panel [data-param="style.id"]')).toContainText('plain');
  expect(errors).toEqual([]);
});

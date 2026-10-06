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
const kill = (kind: string) => ({ type: 'Killed', entityId: -1, kind, x: 0, y: 0, radius: 20 });
const inject = (page: Page, events: unknown[]) =>
  page.evaluate(
    (e) =>
      (window as never as { __presentation: { inject(e: unknown[]): void } }).__presentation.inject(
        e,
      ),
    events,
  );
/** Dev-only: stages presentation state on the world (`window.__sf`, present with ?dev). */
const poke = (page: Page, body: string) =>
  page.evaluate(`(() => { const w = window.__sf.world; ${body} })()`);

test.describe('anime-spectacle: HUD and menus', () => {
  test('the cinematic Start screen replaces the classic menu, moves its cursor and starts the run', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await page.goto('/?style=anime-spectacle&dev');
    await expect(page.locator('#sx-menu')).toBeVisible();
    await expect(page.locator('#run-menu')).toBeHidden();
    await expect(page.locator('#sx-menu .title')).toHaveText('STARFIGHTER');
    await poke(
      page,
      "w.run.available = [{ id: 1, name: 'Mara Vex', trait: 'steady', kills: 4 }, { id: 2, name: 'Joss Hale', trait: 'bold', kills: 2 }];",
    );
    await expect(page.locator('#sx-menu .sx-item')).toHaveCount(3);
    await expect(page.locator('#sx-menu .sx-item.current')).toHaveCount(1);
    await expect(page.locator('#sx-menu .sx-item .sx-portrait svg').first()).toBeVisible();
    await page.keyboard.press('s');
    await expect(page.locator('#sx-menu .sx-item').nth(1)).toHaveClass(/current/);
    await page.waitForTimeout(150); // a tap must be released for a frame to count as a new press
    await page.keyboard.press('s');
    await expect(page.locator('#sx-menu .sx-item').nth(2)).toHaveClass(/current/);
    await page.keyboard.press('Enter');
    await expect(page.locator('#sx-menu')).toBeHidden();
    await expect(page.locator('#sx-hud')).toBeVisible();
    await expect(page.locator('#sx-hud .sx-objective .t')).toContainText('BATTLE 1/');
    await expect(page.locator('#sx-hud .sx-card').first()).toBeVisible(); // the roster with portraits
    // The world picture stays put: nothing of the overlay may move the page (it once shifted by 878px).
    const box = await page.evaluate(() => {
      const r = document.querySelector('body > canvas:not([id])')!.getBoundingClientRect();
      return [r.x, r.y];
    });
    expect(box).toEqual([0, 0]);
    await page.waitForTimeout(600);
    expect(errors).toEqual([]);
  });

  test('banners, comm windows, score and the kill feed show up from events', async ({ page }) => {
    const errors = errorsOf(page);
    await page.goto('/?style=anime-spectacle&dev');
    await page.keyboard.press('Enter');
    await expect(page.locator('#sx-hud .sx-banner.battle .title')).toHaveText('BATTLE 1');
    await inject(page, [kill('fighter'), kill('drone'), { type: 'PilotLost', pilotId: 1 }]);
    await expect(page.locator('#sx-hud .sx-feedline')).toHaveCount(2);
    await expect(page.locator('#sx-hud .sx-scorevalue')).not.toHaveText('000000');
    await expect(page.locator('#sx-hud .sx-streak.on')).toBeVisible();
    await expect(page.locator('#sx-hud .sx-banner.lost')).toContainText('PILOT LOST', {
      timeout: 6000,
    });
    await expect(page.locator('#sx-hud .sx-comm').first()).toBeVisible({ timeout: 8000 });
    expect(errors).toEqual([]);
  });

  test('the debrief and the end screens are cinematic, with portraits and tones', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await page.goto('/?style=anime-spectacle&dev');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await poke(
      page,
      "w.run.phase = 'debrief'; w.run.battle = 1; w.run.cursor = 0; w.run.candidates = [{ name: 'Nadia Quill', trait: 'hunter' }, { name: 'Kenji Moth', trait: 'guardian' }];",
    );
    await expect(page.locator('#sx-menu .title')).toHaveText('BATTLE CLEARED');
    await expect(page.locator('#sx-menu .sx-item .sx-portrait')).toHaveCount(2);
    await poke(page, "w.run.phase = 'end'; w.run.result = 'victory'; w.run.battle = 4;");
    await expect(page.locator('#sx-menu')).toHaveClass(/tone-victory/);
    await expect(page.locator('#sx-menu .title')).toHaveText('VICTORY');
    await poke(page, "w.run.result = 'defeat'; w.run.battle = 2;");
    await expect(page.locator('#sx-menu')).toHaveClass(/tone-defeat/);
    expect(errors).toEqual([]);
  });

  test('turning the layers off in the panel brings the classic HUD and menus back', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await page.goto('/?style=anime-spectacle&dev');
    await page.getByRole('button', { name: /Spectacle presentation/ }).click();
    await expect(page.locator('#sx-menu')).toBeVisible();
    await row(page, 'presentation.menus').click(); // on -> off
    await expect(page.locator('#sx-menu')).toBeHidden();
    await expect(page.locator('#run-menu')).toBeVisible();
    await row(page, 'presentation.menus').click(); // off -> on
    await expect(page.locator('#sx-menu')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#sx-hud')).toBeVisible();
    await row(page, 'presentation.hud').click();
    await expect(page.locator('#sx-hud .sx-tl')).toBeHidden();
    await expect(page.locator('#run-hud .roster')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('calm has no decorative animation on the menu', async ({ page }) => {
    await page.goto('/?style=anime-spectacle&spectacle=calm');
    await expect(page.locator('#sx-menu')).toBeVisible();
    await page.waitForTimeout(200);
    const anim = await page.evaluate(
      () => getComputedStyle(document.querySelector('#sx-menu .halo')!).animationName,
    );
    expect(anim).toBe('none');
  });
});

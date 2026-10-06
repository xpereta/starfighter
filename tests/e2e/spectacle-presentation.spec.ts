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
const pictureTransform = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelector<HTMLCanvasElement>('body > canvas:not([id])')?.style.transform ?? '',
  );

test.describe('anime-spectacle: camera feel and readability layer', () => {
  test('loads with its layers, a working Start screen, and no console errors', async ({ page }) => {
    const errors = errorsOf(page);
    await page.goto('/?style=anime-spectacle&dev');
    await expect(page.locator('canvas#spectacle-world')).toBeAttached();
    await expect(page.locator('canvas#spectacle-screen')).toBeVisible();
    await expect(page.locator('#sx-menu')).toBeVisible(); // the Start screen
    await page.keyboard.press('Enter'); // START RUN
    await expect(page.locator('#sx-menu')).toBeHidden();
    await page.waitForTimeout(800);
    expect(errors).toEqual([]);
  });

  test('other styles do not get the layer', async ({ page }) => {
    const errors = errorsOf(page);
    await page.goto('/?style=anime-80s');
    await page.waitForTimeout(300);
    await expect(page.locator('canvas#spectacle-world')).toHaveCount(0);
    expect(await pictureTransform(page)).toBe('');
    expect(errors).toEqual([]);
  });

  test('a big hit punches the picture in, then settles back', async ({ page }) => {
    const errors = errorsOf(page);
    await page.goto('/?style=anime-spectacle&dev&practice');
    await page.waitForTimeout(300);
    await inject(page, [kill('turret'), { type: 'PlayerDamaged', x: 0, y: 0, hull: 2 }]);
    const scaleOf = async (): Promise<number> =>
      Number(/scale\(([0-9.]+)\)/.exec(await pictureTransform(page))?.[1] ?? '0');
    await expect.poll(scaleOf).toBeGreaterThan(1.01);
    await expect.poll(scaleOf, { timeout: 5000 }).toBe(1);
    expect(errors).toEqual([]);
  });

  test('the salvo multi-kill freezes the picture, then thaws', async ({ page }) => {
    const errors = errorsOf(page);
    await page.goto('/?style=anime-spectacle&dev&practice');
    await page.waitForTimeout(300);
    await inject(page, [
      { type: 'SalvoFired', count: 3 },
      kill('fighter'),
      kill('drone'),
      kill('drone'),
    ]);
    const frozen = await page.evaluate(
      () =>
        (window as never as { __presentation: { feel: { killCam: number } } }).__presentation.feel
          .killCam,
    );
    expect(frozen).toBeGreaterThan(0);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as never as { __presentation: { feel: { killCam: number } } }).__presentation
              .feel.killCam,
        ),
      )
      .toBe(0);
    expect(errors).toEqual([]);
  });

  test('the panel switches effects off: calm and off presets, and the master switch', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await page.goto('/?style=anime-spectacle&dev&practice');
    await expect(page.locator('#tuning-panel')).toBeVisible();
    await page.getByRole('button', { name: /Spectacle presentation/ }).click();
    await expect(row(page, 'presentation.preset')).toContainText('full');
    await row(page, 'presentation.preset').click(); // full -> calm
    await expect(row(page, 'presentation.preset')).toContainText('calm');
    await expect(page.locator('#tuning-panel [data-param="presentation.roll"]')).toContainText(
      '0.00',
    );
    await row(page, 'presentation.preset').click(); // calm -> overdrive
    await row(page, 'presentation.preset').click(); // overdrive -> off
    await expect(row(page, 'presentation.preset')).toContainText('off');
    await expect(page.locator('canvas#spectacle-screen')).toBeHidden();
    await row(page, 'presentation.preset').click(); // off -> full
    await expect(page.locator('canvas#spectacle-screen')).toBeVisible();
    await expect(row(page, 'presentation.killCam')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('?spectacle=calm starts calm and ?spectacle=off keeps the classic look', async ({
    page,
  }) => {
    const errors = errorsOf(page);
    await page.goto('/?style=anime-spectacle&dev&practice&spectacle=calm');
    await page.getByRole('button', { name: /Spectacle presentation/ }).click();
    await expect(row(page, 'presentation.preset')).toContainText('calm');
    await page.goto('/?style=anime-spectacle&practice&spectacle=off');
    await page.waitForTimeout(300);
    await expect(page.locator('canvas#spectacle-screen')).toBeHidden();
    expect(errors).toEqual([]);
  });
});

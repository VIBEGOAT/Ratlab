import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function scrub(page: Page, progress: number) {
  await page.evaluate(p => {
    const section = document.querySelector('#story')!, stage = document.querySelector('.journey-stage')!;
    const r = section.getBoundingClientRect();
    window.scrollTo({ top: scrollY + r.top + p * (r.height - stage.getBoundingClientRect().height), behavior: 'instant' });
  }, progress);
  await expect.poll(async () => Number(await page.locator('#story').getAttribute('data-progress'))).toBeCloseTo(progress, 3);
}

for (const [width, height] of [[375, 667], [768, 1024], [1440, 900], [844, 390]]) {
  test(`six stations fit and have one scroll owner at ${width}x${height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto('/?debug=1#story');
    const buttons = page.getByRole('navigation', { name: 'Story chapters' }).getByRole('button');
    for (let i = 0; i < 6; i++) {
      await buttons.nth(i).click();
      await expect(buttons.nth(i)).toHaveAttribute('aria-current', 'step');
      await expect(page.locator('#story')).toHaveAttribute('data-active-chapter', String(i));
      const layout = await page.evaluate(() => {
        const panel = document.querySelector('.journey-panel[aria-hidden="false"]')!.getBoundingClientRect();
        const disclaimer = document.querySelector('.journey-disclaimer')!.getBoundingClientRect();
        const scene = document.querySelector('.journey-scene')!.getBoundingClientRect();
        const scrollers = [...document.querySelectorAll<HTMLElement>('#story *')].filter(el => {
          const s = getComputedStyle(el); return /auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1;
        });
        return { panelBottom: panel.bottom, panelTop: panel.top, disclaimerTop: disclaimer.top, disclaimerBottom: disclaimer.bottom, sceneBottom: scene.bottom, width: document.documentElement.scrollWidth, scrollers: scrollers.length, root: document.scrollingElement?.tagName };
      });
      expect(layout.root).toBe('HTML'); expect(layout.scrollers).toBe(0);
      expect(layout.width).toBeLessThanOrEqual(width!);
      expect(layout.panelBottom).toBeLessThanOrEqual(layout.disclaimerTop);
      expect(layout.disclaimerBottom).toBeLessThanOrEqual(height!);
      expect(layout.panelTop).toBeGreaterThan(80);
      if (width! < 600) expect(layout.sceneBottom).toBeLessThan(layout.panelTop);
      await page.screenshot({ path: `test-results/journey-${width}-${i + 1}.png` });
    }
    expect(errors).toEqual([]);
  });
}

test('fast forward, reverse, idle and wheel scrolling stay synchronized', async ({ page }) => {
  await page.goto('/?debug=1#story');
  const rat = page.getByTestId('journey-rat');
  await scrub(page, .4);
  await expect(rat).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  const first = await rat.getAttribute('data-time');
  await scrub(page, .95); await scrub(page, .02); await scrub(page, .4);
  await expect(rat).toHaveAttribute('data-time', first!);
  const before = await page.locator('.journey-scene').innerHTML();
  await page.waitForTimeout(1200);
  expect(await page.locator('.journey-scene').innerHTML()).toBe(before);
  await page.mouse.move(900, 400); await page.mouse.wheel(0, 1700);
  await expect.poll(async () => Number(await page.locator('#story').getAttribute('data-progress'))).toBeGreaterThan(.7);
  await page.mouse.wheel(0, -2200);
  await expect.poll(async () => Number(await page.locator('#story').getAttribute('data-progress'))).toBeLessThan(.4);
  await scrub(page, 1); await expect(page.locator('#story')).toHaveAttribute('data-active-chapter', '5');
});

test('deep links, keyboard navigation, history, resize and palette use the same chapter state', async ({ page }) => {
  await page.goto('/#story/organs');
  await expect(page.locator('#story')).toHaveAttribute('data-active-chapter', '3');
  const nav = page.getByRole('navigation', { name: 'Story chapters' });
  await nav.getByRole('button').nth(5).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#story')).toHaveAttribute('data-active-chapter', '5');
  await page.goBack(); await expect(page.locator('#story')).toHaveAttribute('data-active-chapter', '3');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
  await expect.poll(() => page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('#story')!, stage = document.querySelector('.journey-stage')!;
    const r = s.getBoundingClientRect(); return Math.abs(Number(s.dataset.progress) - Math.min(1, Math.max(0, -r.top / (r.height - stage.getBoundingClientRect().height))));
  })).toBeLessThan(.001);
  await page.goto('/#story-dose'); await expect(page.locator('#story')).toHaveAttribute('data-active-chapter', '1');
  await page.keyboard.press('Control+k'); await page.getByRole('combobox').fill('Make the human connection'); await page.keyboard.press('Enter');
  await expect(page.locator('#story')).toHaveAttribute('data-active-chapter', '5');
  await page.getByRole('button', { name: 'Story', exact: true }).click();
  await expect(page.locator('#story')).toHaveAttribute('data-progress', '0.000000');
  await page.goto('/#story'); await expect(page.locator('#story')).toHaveAttribute('data-progress', '0.000000');
});

test('dose, compound, organs and HED are connected and keyboard accessible', async ({ page }) => {
  await page.goto('/#story');
  await page.getByLabel('Fictional profile').selectOption('1');
  const nav = page.getByRole('navigation', { name: 'Story chapters' }).getByRole('button');
  await nav.nth(1).click();
  const dose = page.getByRole('slider'); await dose.fill('100'); await dose.press('ArrowRight');
  await expect(dose).toHaveValue('101');
  await nav.nth(3).click(); await page.getByRole('button', { name: 'Kidneys', exact: true }).click();
  await expect(page.getByText('Kidneys: 80 / 100 simulated injury index')).toBeVisible();
  await nav.nth(4).click(); await expect(page.getByRole('slider')).toHaveValue('101');
  await nav.nth(5).click(); await page.getByLabel('Human body weight (kg)').fill('70');
  await expect(page.getByText(/1146.5 mg total at 70 kg/)).toBeVisible();
  await page.getByLabel('Human body weight (kg)').fill('0');
  await expect(page.getByLabel('Human body weight (kg)')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/Enter 1–500 kg/)).toBeVisible();
  await page.getByRole('button', { name: 'Explore the workbench' }).click();
  await expect(page).toHaveURL(/#toxicity/);
});

test('reduced motion uses stationary chapter poses and no running animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/#story');
  await scrub(page, .34); const point = await page.getByTestId('journey-rat').getAttribute('data-time');
  await scrub(page, .48); await expect(page.getByTestId('journey-rat')).toHaveAttribute('data-time', point!);
  await expect(page.getByTestId('journey-rat')).toHaveAttribute('data-pose', 'pause');
  expect(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
});

test('all six chapters pass axe in light and dark themes', async ({ page }) => {
  await page.goto('/#story');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
    for (let i = 0; i < 6; i++) {
      await page.getByRole('navigation', { name: 'Story chapters' }).getByRole('button').nth(i).click();
      const results = await new AxeBuilder({ page }).include('#story').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), `${theme} chapter ${i + 1}`).toEqual([]);
    }
  }
});

test('native touch drag moves the page and updates the scene', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch gesture; wheel and anchor tests also run on other engines');
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); await page.goto('http://localhost:5173/#story');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 580 }] });
  for (let y = 550; y >= 130; y -= 30) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => Number(await page.locator('#story').getAttribute('data-progress'))).toBeGreaterThan(.05);
  await context.close();
});

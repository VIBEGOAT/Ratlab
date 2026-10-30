import { test, expect, type Page } from '@playwright/test';

async function chapter(page: Page, n: number) {
  await page.evaluate(index => {
    const el = document.querySelector<HTMLElement>(`[data-chapter="${index}"]`)!;
    const header = document.querySelector('.topbar')!.getBoundingClientRect().height;
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - header - 12, behavior: 'instant' });
  }, n);
  await expect(page.locator('.story')).toHaveAttribute('data-active-chapter', String(n));
}

test('editorial Story keeps twin evidence, cohort cadence and human controls clear of the scene', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { localStorage.setItem('force3d', '1'); localStorage.setItem('theme', 'dark'); });
  await page.goto('/#story');
  await expect(page.locator('.story-stage canvas')).toBeVisible();
  await expect(page.locator('.story')).toHaveCSS('background-color', 'rgb(11, 10, 9)');
  const canvas = page.locator('.story-stage canvas');
  await canvas.evaluate(el => el.setAttribute('data-identity', 'original'));

  await chapter(page, 6);
  await expect(page.locator('.twin-readout.control')).toContainText('Untreated');
  await expect(page.locator('.twin-readout.dosed')).toContainText('Cutaway');
  await expect(page.locator('.twin-data-note')).toContainText('untreated does not necessarily mean healthy');
  // Pixel check catches clipped/unlit models that DOM-only assertions cannot see.
  await expect.poll(async () => {
    const png = (await canvas.screenshot()).toString('base64');
    return page.evaluate(async encoded => {
      const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
      const surface = document.createElement('canvas'); surface.width = image.width; surface.height = image.height;
      const ctx = surface.getContext('2d')!; ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, surface.width, surface.height).data;
      const bright = [0, 0];
      for (let y=Math.floor(surface.height*.35); y<surface.height*.7; y++) for (let x=0; x<surface.width; x++) {
        const p=(y*surface.width+x)*4;
        if(pixels[p]!>100 && pixels[p+1]!>80 && pixels[p+2]!>60) bright[x<surface.width/2?0:1]++;
      }
      return Math.min(...bright);
    }, png);
  }, { timeout: 30000 }).toBeGreaterThan(500);
  const divider = page.getByRole('slider', { name: 'Compare treated and untreated' });
  await divider.focus(); await divider.press('ArrowRight');
  await expect(divider).toHaveAttribute('aria-valuenow', '53');

  await chapter(page, 7);
  await page.mouse.move(300, 400);
  await page.mouse.wheel(0, 900 * .55);
  await expect(page.locator('.story')).toHaveAttribute('data-active-chapter', '8');
  await expect(page.getByRole('heading', { name: 'How it behaves.' })).toBeInViewport();

  await chapter(page, 9);
  const dock = page.locator('.translation-telemetry');
  await expect(dock).toBeVisible();
  const stageBox = (await page.locator('.story-canvas').boundingBox())!;
  const dockBox = (await dock.boundingBox())!;
  expect(stageBox.x + stageBox.width).toBeLessThan(dockBox.x);
  const firstTab = page.getByRole('tab', { name: 'HED', exact: true });
  await firstTab.focus(); await firstTab.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Homology' })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('Sequence evidence needed');
  await page.getByRole('tab', { name: 'Clearance', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('not a measured human clearance');
  await page.getByRole('button', { name: 'Liver', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Liver', exact: true })).toHaveAttribute('aria-pressed', 'true');

  for (const viewport of [{ width: 768, height: 1024 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    await chapter(page, 9);
    await expect.poll(async () => (await canvas.boundingBox())!.height).toBeLessThan(viewport.height * .45);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    const scene = (await canvas.boundingBox())!, metrics = (await dock.boundingBox())!;
    expect(metrics.y).toBeGreaterThanOrEqual(scene.y + scene.height);
  }
  await expect(canvas).toHaveAttribute('data-identity', 'original');
  expect(errors).toEqual([]);
});

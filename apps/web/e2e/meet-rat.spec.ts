import { test, expect } from '@playwright/test';
test('anatomy studio preserves its canvas through chapter jumps and mobile resize', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('force3d', '1'));
  await page.goto('/#story');
  await page.locator('[data-chapter="1"]').waitFor();
  const jump = async (chapter: number) => {
    await page.evaluate(c => { const el = document.querySelector(`[data-chapter="${c}"]`)!; window.scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: 'instant' }); }, chapter);
  };
  await jump(1);
  await expect(page.locator('.meet-frame')).toBeVisible();
  const canvas = page.locator('.story-stage canvas').first();
  await expect(canvas).toBeVisible();
  await canvas.evaluate(el => el.setAttribute('data-persist-check', 'same'));
  await jump(2);
  await expect(page.locator('.meet-frame')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-persist-check', 'same');
  await jump(1);
  await expect(page.locator('.meet-frame')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-persist-check', 'same');
  await page.setViewportSize({ width: 390, height: 844 });
  await jump(1);
  await expect(page.locator('.story-stage')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(canvas).toHaveAttribute('data-persist-check', 'same');
  expect(errors).toEqual([]);
});

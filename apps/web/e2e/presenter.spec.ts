import { test, expect } from '@playwright/test';

test('presenter and speaker notes follow the new six-station story', async ({ page, context }) => {
  await page.goto('/#story'); await page.keyboard.press('p');
  await expect(page.locator('html')).toHaveClass(/presenting/);
  for (let i = 0; i < 6; i++) {
    if (i) await page.keyboard.press('ArrowRight');
    await expect(page.locator('#story')).toHaveAttribute('data-active-chapter', String(i));
  }
  const notes = await context.newPage(); await notes.goto('/#notes');
  await expect(notes.getByRole('heading', { name: 'Make the human connection' })).toBeVisible();
  await notes.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('#story')).toHaveAttribute('data-active-chapter', '4');
  await page.keyboard.press('Escape'); await expect(page.locator('html')).not.toHaveClass(/presenting/);
});

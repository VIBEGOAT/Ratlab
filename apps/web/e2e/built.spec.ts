import { test, expect } from "@playwright/test";

/**
 * Smoke test of the PRODUCTION build (the dev server hides build-only problems such as a missing file that a lazy chunk
 * preloads). Run it with BUILT_URL pointing at `vite preview` or at the live site:
 *   BUILT_URL=http://localhost:4173 npx playwright test e2e/built.spec.ts
 */
const url = process.env.BUILT_URL;
test.skip(!url, "set BUILT_URL to a built site to run this");

test("built site: Story loads, Lab opens, every section renders, no failed requests", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [], failed: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${url}#story`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("no3d", "1"); });
  await page.goto(`${url}#story`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Meet the compound");
  await page.getByLabel("More options").click();
  await page.getByRole("button", { name: /^Lab/ }).click();
  await expect(page.getByRole("heading", { name: /No adverse effect|Adverse effects/ })).toBeVisible({ timeout: 120_000 });
  for (const s of ["Design", "Animal", "Data", "Population", "Translate & Trust"]) {
    await page.getByRole("navigation", { name: "Lab sections" }).getByRole("button", { name: new RegExp(`^${s}`) }).click();
    await expect(page.locator("#main h2").first()).toBeVisible({ timeout: 60_000 });
  }
  await page.goto(`${url}#lab/data`);
  await page.reload();
  await expect(page.getByRole("tab", { name: "PK/PD" })).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

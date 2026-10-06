import { test, expect, type Page } from "@playwright/test";

/**
 * Visual regression at the three sizes the product is judged at. The 3D scene is off (the pages show the poster) because
 * software-rendered WebGL is not pixel-stable; everything else is deterministic because the simulation is seeded.
 * Update the baselines on purpose with: npx playwright test e2e/visual.spec.ts --update-snapshots
 */
const SIZES = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "390x844", width: 390, height: 844 },
] as const;

async function fresh(page: Page, hash = "", theme?: "dark" | "light") {
  await page.goto("about:blank");
  await page.goto("/");
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem("no3d", "1"); if (t) localStorage.setItem("theme", t); }, theme);
  await page.goto("about:blank");
  await page.goto(`/${hash}`);
  await expect(page.locator("#root *").first()).toBeAttached();
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1600); // count-ups and draw-ins
}

const opts = { animations: "disabled" as const, maxDiffPixelRatio: 0.012, fullPage: false };

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("story hero", async ({ page }) => {
      await fresh(page, "", "light");
      await settle(page);
      await expect(page).toHaveScreenshot(`story-hero-${size.name}.png`, { ...opts, mask: [page.locator(".big-number")] });
    });

    test("story hero, dark", async ({ page }) => {
      await fresh(page, "", "dark");
      await settle(page);
      await expect(page).toHaveScreenshot(`story-hero-dark-${size.name}.png`, { ...opts, mask: [page.locator(".big-number")] });
    });

    test("lab overview", async ({ page }) => {
      test.setTimeout(180_000);
      await fresh(page, "#lab/overview", "light");
      await expect(page.getByRole("heading", { name: /No adverse effect up to/ })).toBeVisible({ timeout: 120_000 });
      await settle(page);
      await expect(page).toHaveScreenshot(`lab-overview-${size.name}.png`, opts);
    });

    test("lab design", async ({ page }) => {
      test.setTimeout(180_000);
      await fresh(page, "#lab/design", "light");
      await expect(page.getByRole("button", { name: /Heart-toxic anticancer/ })).toBeVisible();
      await settle(page);
      await expect(page).toHaveScreenshot(`lab-design-${size.name}.png`, opts);
    });

    test("lab PK/PD with labelled charts", async ({ page }) => {
      test.setTimeout(240_000);
      await fresh(page, "#lab/data", "light");
      await expect(page.getByRole("group", { name: /Use the left and right arrow keys/ }).first()).toBeVisible({ timeout: 200_000 });
      await settle(page);
      await expect(page).toHaveScreenshot(`lab-pkpd-${size.name}.png`, opts);
    });

    test("command palette", async ({ page }) => {
      await fresh(page, "#lab/design", "light");
      await expect(page.getByRole("navigation", { name: "Lab sections" })).toBeVisible();
      await page.keyboard.press("Control+k");
      await page.getByRole("combobox", { name: "Search commands" }).fill("co");
      await settle(page);
      await expect(page).toHaveScreenshot(`palette-${size.name}.png`, opts);
    });
  });
}

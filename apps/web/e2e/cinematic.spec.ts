import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("cinematic hero renders all views, pauses, and fits mobile", async ({ page }) => {
  test.setTimeout(180_000); // Software WebGL needs additional time for three full-resolution captures.
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => { if (message.type() === "error" && /shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
  await page.addInitScript(() => localStorage.setItem("force3d", "1"));
  await page.goto("/#story");
  const hero = page.getByTestId("cinematic-hero");
  await expect(hero).toBeVisible();
  await expect(page.getByText("Growing a little world…")).not.toBeVisible();
  await page.getByRole("button", { name: "Pause cinematic scene" }).click();
  for (const [index, name] of ["Meadow", "Organs", "Nerves"].entries()) {
    await hero.getByRole("button", { name, exact: true }).click();
    await expect(hero).toHaveAttribute("data-stage", String(index));
    await expect(hero.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(200);
    await hero.screenshot({ path: `test-results/cinematic-${name.toLowerCase()}.png` });
  }
  expect((await new AxeBuilder({ page }).include(".cinematic-hero").analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.locator(".story-stage")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  expect(errors).toEqual([]);
});

test("reduced motion keeps a still scene with manual anatomy selection", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("force3d", "1"));
  await page.goto("/#story");
  const hero = page.getByTestId("cinematic-hero");
  await expect(hero).toHaveAttribute("data-stage", "0");
  await expect(page.getByRole("button", { name: "Pause cinematic scene" })).toHaveCount(0);
  await hero.getByRole("button", { name: "Nerves", exact: true }).click();
  await expect(hero).toHaveAttribute("data-stage", "2");
});

test("automatic cinema completes its three-stage loop", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("force3d", "1"));
  await page.goto("/#story");
  const hero = page.getByTestId("cinematic-hero");
  await expect(hero).toHaveAttribute("data-stage", "0");
  await expect(hero).toHaveAttribute("data-stage", "1", { timeout: 20_000 });
  await expect(hero).toHaveAttribute("data-stage", "2", { timeout: 20_000 });
  await expect(hero).toHaveAttribute("data-stage", "0", { timeout: 20_000 });
  await page.getByRole("button", { name: "Pause cinematic scene" }).click();
  await expect(page.getByRole("button", { name: "Play cinematic scene" })).toBeVisible();
});

test("manual views hold their state until Auto resumes the director", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("force3d", "1"));
  await page.goto("/#story");
  const hero = page.getByTestId("cinematic-hero");
  await hero.getByRole("button", { name: "Organs", exact: true }).click();
  await expect(hero).toHaveAttribute("data-stage", "1");
  await page.waitForTimeout(8000);
  await expect(hero).toHaveAttribute("data-stage", "1");
  await hero.getByRole("button", { name: "Nerves", exact: true }).click();
  await expect(hero).toHaveAttribute("data-stage", "2");
  await hero.getByRole("button", { name: "Auto", exact: true }).click();
  await expect(hero).toHaveAttribute("data-stage", "0", { timeout: 15000 });
});

 test("phone story opens with a pinned scene and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("force3d", "1"));
  await page.goto("/#story");
  await page.getByRole("button", { name: "Begin", exact: true }).focus();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const hero = page.getByTestId("cinematic-hero");
  await expect(hero).toBeVisible();
  await expect(page.getByText("Growing a little world…")).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await hero.screenshot({ path: "test-results/cinematic-mobile.png" });
});

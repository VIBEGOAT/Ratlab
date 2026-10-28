import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "e2e/screenshots/phase-a";
mkdirSync(SHOTS, { recursive: true });

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Start from a clean browser state: fresh context storage, then a real load of the target path. */
async function fresh(page: Page, path = "/#story", opts: { threeD?: boolean } = {}) {
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.goto("/#story");
  await page.evaluate(async (threeD) => { localStorage.clear(); if (!threeD) localStorage.setItem("no3d", "1"); else localStorage.setItem("force3d", "1"); await new Promise<void>((r) => { const q = indexedDB.deleteDatabase("eliminate-lab"); q.onsuccess = q.onerror = q.onblocked = () => r(); }); }, !!opts.threeD);
  await page.goto("about:blank");
  await page.goto(path);
}

test("story hero, footer disclaimer and honest status chip", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchConsole(page);
  await fresh(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every animal we spare");
  await expect(page.getByRole("contentinfo")).toContainText("Not validated for regulatory or safety decisions");
  const chip = page.getByRole("button", { name: /parameters awaiting expert verification/ });
  await expect(chip).toBeVisible();
  const text = (await chip.textContent()) ?? "";
  const m = text.match(/(\d+) of (\d+)/);
  expect(m).not.toBeNull();
  expect(Number(m![1])).toBeGreaterThan(50); // the real count, not a softened number
  await chip.click();
  await expect(page.getByRole("dialog")).toContainText("has not been validated against real animal data");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText(/virtual rats ready/)).toBeVisible({ timeout: 150_000 });
  expect(errors.filter((e) => !/Download the React DevTools|GL Driver Message|GPU stall/.test(e))).toEqual([]);
});

test("Lab opens on the Overview, with five sections for the full analysis", async ({ page }) => {
  const errors = watchConsole(page);
  await fresh(page);
  await page.getByRole("button", { name: "Lab", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Lab sections" });
  for (const s of ["Overview", "Design", "Animal", "Data", "Population", "Translate & Trust"]) await expect(nav.getByRole("button", { name: new RegExp(`^${s}`) })).toBeVisible();
  await expect(nav.getByRole("button", { name: /^Overview/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: /No adverse effect|Adverse effects/ })).toBeVisible({ timeout: 90_000 });
  await nav.getByRole("button", { name: /^Design/ }).click();
  await expect(page.getByText(/virtual animals simulated/)).toBeVisible({ timeout: 90_000 });
  expect(errors.filter((e) => !/Download the React DevTools|GL Driver Message|GPU stall/.test(e))).toEqual([]);
});

test("timeline length follows the configured study length", async ({ page }) => {
  await fresh(page, "/#lab/design");
  await expect(page.getByText(/virtual animals simulated/)).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "14 days" }).click();
  await expect(page.getByText(/Settings changed|Simulating/)).toBeVisible();
  await expect(page.getByText(/virtual animals simulated/)).toBeVisible({ timeout: 90_000 });
  await page.getByRole("navigation", { name: "Lab sections" }).getByRole("button", { name: /^Animal/ }).click();
  await expect(page.getByText(/Day \d+ \/ 14/)).toBeVisible({ timeout: 60_000 });
});

test("PK reports Tmax per dose, within the dosing interval", async ({ page }) => {
  await fresh(page, "/#lab/data");
  await expect(page.getByRole("cell", { name: "First dose" })).toBeVisible({ timeout: 90_000 });
  const row = page.getByRole("row").filter({ hasText: "First dose" });
  const tmax = Number(((await row.getByRole("cell").nth(2).textContent()) ?? "").replace(",", "."));
  expect(tmax).toBeGreaterThan(0);
  expect(tmax).toBeLessThan(24);
  await expect(page.locator(".chip", { hasText: "PBPK · Mechanistic" })).toHaveCount(1);
  await expect(page.locator(".chip", { hasText: "PD models · Mechanistic" })).toHaveCount(1);
});

test("theme toggle and colour-blind palette apply to the document", async ({ page }) => {
  await fresh(page);
  await page.getByRole("button", { name: /^Theme:/ }).click();
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(["dark", "light"]).toContain(theme);
  await page.getByRole("button", { name: /CB palette/ }).click();
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-palette"))).toBe("cb");
});

for (const [w, h] of [[1440, 900], [1920, 1080], [390, 844]] as const) {
  test(`screenshots and no horizontal scroll at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await fresh(page);
    await expect(page.getByText(/virtual rats ready/)).toBeVisible({ timeout: 90_000 });
    await page.screenshot({ path: `${SHOTS}/story-hero-${w}x${h}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole("button", { name: "Lab", exact: true }).click();
    await expect(page.getByRole("heading", { name: /No adverse effect|Adverse effects/ })).toBeVisible({ timeout: 90_000 });
    await page.screenshot({ path: `${SHOTS}/lab-overview-${w}x${h}.png`, fullPage: false });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole("navigation", { name: "Lab sections" }).getByRole("button", { name: /^Design/ }).click();
    await expect(page.getByText(/virtual animals simulated/)).toBeVisible({ timeout: 90_000 });
    await page.screenshot({ path: `${SHOTS}/lab-design-${w}x${h}.png`, fullPage: false });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole("navigation", { name: "Lab sections" }).getByRole("button", { name: /^Data/ }).click();
    await expect(page.getByRole("cell", { name: "First dose" })).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: `${SHOTS}/lab-data-${w}x${h}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}

test("dark theme screenshots", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  for (const [w, h] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await fresh(page);
    await expect(page.getByText(/virtual rats ready/)).toBeVisible({ timeout: 90_000 });
    await page.screenshot({ path: `${SHOTS}/dark-story-hero-${w}x${h}.png` });
    await page.getByRole("button", { name: "Lab", exact: true }).click();
    await page.getByRole("navigation", { name: "Lab sections" }).getByRole("button", { name: /^Data/ }).click();
    await expect(page.getByRole("cell", { name: "First dose" })).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: `${SHOTS}/dark-lab-data-${w}x${h}.png` });
  }
});

test("3D rat renders, organs open their detail, and quality can be set", async ({ page }) => {
  const errors = watchConsole(page);
  await fresh(page, "/#lab/animal", { threeD: true });
  await expect(page.locator("canvas")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/Day \d+ \/ 28/)).toBeVisible();
  await page.locator("button.organ", { hasText: "Liver" }).click();
  await expect(page.getByRole("heading", { name: /Liver on day/ })).toBeVisible();
  // speed, layers and quality are expert controls, folded away in Simple mode
  await page.getByRole("button", { name: "Show layers, speed and quality" }).click();
  await page.getByLabel("Quality").selectOption("low");
  await page.waitForTimeout(1500);
  await page.locator("canvas").scrollIntoViewIfNeeded();
  for (const [w, h] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `e2e/screenshots/phase-b/rat-${w}x${h}.png` });
  }
  expect(errors.filter((e) => !/Download the React DevTools|WebGL|GPU stall|THREE\.WebGLRenderer/.test(e))).toEqual([]);
});

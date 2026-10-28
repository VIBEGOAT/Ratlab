import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "e2e/screenshots/phase-c";
mkdirSync(SHOTS, { recursive: true });

async function fresh(page: Page) {
  await page.goto("about:blank");
  await page.goto("/#story");
  await page.evaluate(async () => { localStorage.clear(); localStorage.setItem("quality", "low"); localStorage.setItem("force3d", "1"); await new Promise<void>((r) => { const q = indexedDB.deleteDatabase("eliminate-lab"); q.onsuccess = q.onerror = q.onblocked = () => r(); }); });
  await page.goto("about:blank");
  await page.goto("/#story");
  await expect(page.getByText(/virtual rats ready|Preparing/).first()).toBeAttached();
}

/** Scroll so the middle of the viewport sits `frac` of the way through chapter `n`. */
async function scrollTo(page: Page, n: number, frac: number) {
  await page.evaluate(([n, frac]) => {
    const el = document.querySelector<HTMLElement>(`[data-chapter='${n}']`)!;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + frac * el.offsetHeight - window.innerHeight / 2, behavior: "instant" as ScrollBehavior });
  }, [n, frac] as const);
  await page.waitForTimeout(900);
}

test("story chapters 1 to 6 tell the dose-to-humane-endpoint story", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await fresh(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every animal we spare");
  // wait for the default study (heart-toxic anticancer in tumour-bearing rats) and its twin
  await scrollTo(page, 2, 0.3);
  await expect(page.getByRole("status").filter({ hasText: "virtual rats ready" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("button", { name: /Heart-toxic anticancer/ })).toHaveAttribute("aria-pressed", "true");

  // dose dial is a keyboard-operable slider
  const dial = page.getByRole("slider", { name: "Highest dose" });
  const before = Number(await dial.getAttribute("aria-valuenow"));
  await dial.focus();
  await page.keyboard.press("ArrowRight");
  expect(Number(await dial.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("status").filter({ hasText: "virtual rats ready" })).toBeVisible({ timeout: 120_000 });

  await scrollTo(page, 3, 0.6);
  await expect(page.getByText("Hour", { exact: true })).toBeVisible();
  await scrollTo(page, 4, 0.9);
  await expect(page.locator(".day-counter").getByText("Study day", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: /Blood tests on day/ })).toBeVisible();

  await scrollTo(page, 5, 0.75);
  await expect(page.getByText("Here, no one did.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/In a laboratory, this is the day a living animal would have suffered/)).toBeVisible();
  await expect(page.getByText(/virtual rats in this study/)).toBeVisible();
  expect(errors.filter((e) => !/WebGL|GPU stall|THREE\./.test(e))).toEqual([]);
});

for (const [w, h] of [[1440, 900], [1920, 1080], [390, 844]] as const) {
  test(`story screenshots at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: w, height: h });
    await fresh(page);
    await scrollTo(page, 2, 0.3);
    await expect(page.getByRole("status").filter({ hasText: "virtual rats ready" })).toBeVisible({ timeout: 120_000 });
    await page.waitForTimeout(1500);
    const shots: Array<[string, number, number]> = [["1-hero", 0, 0.1], ["2-meet", 1, 0.45], ["3-choose", 2, 0.45], ["4-dose-day", 3, 0.45], ["5-damage", 4, 0.8], ["6-moment", 5, 0.8]];
    for (const [name, n, f] of shots) {
      await scrollTo(page, n, f);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${SHOTS}/${name}-${w}x${h}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
  });
}

test("reduced motion shows the moment without animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fresh(page);
  await scrollTo(page, 2, 0.3);
  await expect(page.getByRole("status").filter({ hasText: "virtual rats ready" })).toBeVisible({ timeout: 120_000 });
  await scrollTo(page, 5, 0.3);
  await expect(page.getByText("Here, no one did.")).toBeVisible();
});

test("story chapters 7 to 12: twin slider, thousand rats, behaviour, humans, trust, finale", async ({ page }) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fresh(page);
  await scrollTo(page, 2, 0.3);
  await expect(page.getByRole("status").filter({ hasText: "virtual rats ready" })).toBeVisible({ timeout: 120_000 });

  // 7 · twin: the divider is a keyboard-operable slider
  await scrollTo(page, 6, 0.5);
  await expect(page.getByRole("heading", { name: "Meet the twin." })).toBeVisible();
  const divider = page.getByRole("slider", { name: "Compare treated and untreated" });
  await expect(divider).toBeVisible();
  const before = Number(await divider.getAttribute("aria-valuenow"));
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  expect(Number(await divider.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
  await expect(page.getByRole("table", { name: /Treated against untreated twin/ })).toBeVisible();

  // 8 · a thousand rats: the field fills and the numbers have ranges
  await scrollTo(page, 7, 0.6);
  await expect(page.getByText(/Simulating… \d+ of 2[.,\s]?000|Dose \d+ mg\/kg\/day for 28 days/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Dose \d+ mg\/kg\/day for 28 days/)).toBeVisible({ timeout: 360_000 });
  await expect(page.getByRole("img", { name: /1,?000 of 1,?000 virtual rats simulated|1.000 of 1.000 virtual rats simulated/ })).toBeVisible();
  await expect(page.getByText(/95% range/).first()).toBeVisible();
  await page.getByRole("button", { name: "Untreated", exact: true }).click();
  await expect(page.getByRole("img", { name: /without treatment/ })).toBeVisible();

  // 9 · behaviour is labelled as modelled, not felt
  await scrollTo(page, 8, 0.4);
  await expect(page.getByText(/Modelled endpoints, not what the animal feels/)).toBeVisible();

  // 10 · humans: arithmetic only, with the unverified flag
  await scrollTo(page, 9, 0.6);
  await expect(page.getByText("Km factors unverified")).toBeVisible();
  await expect(page.getByText("Suggested first dose")).toBeVisible();
  await expect(page.getByText(/free of adverse effects/)).toHaveCount(0);
  await expect(page.getByText(/never guide a real dose/)).toBeVisible();

  // 11 · trust: teaching passes, replacing an animal study does not
  await scrollTo(page, 10, 0.4);
  await expect(page.getByText("Adequate for this use.")).toBeVisible();
  await page.getByRole("button", { name: "Replacing an animal study" }).click();
  await expect(page.getByText("Not yet credible for this use.")).toBeVisible();
  await expect(page.getByText("None yet")).toBeVisible();

  // 12 · finale: editable assumptions change the number, references shown are verified
  await scrollTo(page, 11, 0.3);
  const big = page.locator(".finale .big-number");
  const v1 = await big.textContent();
  await page.getByLabel("Studies a year").fill("40");
  await expect.poll(async () => big.textContent()).not.toBe(v1);
  await expect(page.getByText(/Verified sources/)).toBeVisible();
  await expect(page.getByText(/does not replace animal studies/)).toBeVisible();
  expect(errors).toEqual([]);
});

for (const [w, h] of [[1440, 900], [1920, 1080], [390, 844]] as const) {
  test(`story chapters 7-12 screenshots at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(480_000);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: w, height: h });
    await fresh(page);
    await scrollTo(page, 2, 0.3);
    await expect(page.getByRole("status").filter({ hasText: "virtual rats ready" })).toBeVisible({ timeout: 120_000 });
    await scrollTo(page, 7, 0.6);
    await expect(page.getByText(/Dose \d+ mg\/kg\/day for 28 days/)).toBeVisible({ timeout: 360_000 });
    const shots: Array<[string, number, number]> = [["7-twin", 6, 0.5], ["8-forecast", 7, 0.85], ["9-behaviour", 8, 0.4], ["10-human", 9, 0.7], ["11-trust", 10, 0.4], ["12-finale", 11, 0.3]];
    for (const [name, n, f] of shots) {
      await scrollTo(page, n, f);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/${name}-${w}x${h}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
  });
}


test("chapters 10 and 11 screenshots without waiting for the thousand-rat run", async ({ page }) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ colorScheme: "dark" });
  for (const [w, h] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await fresh(page);
    await scrollTo(page, 2, 0.3);
    await expect(page.getByRole("status").filter({ hasText: "virtual rats ready" })).toBeVisible({ timeout: 120_000 });
    await scrollTo(page, 3, 0.45);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/4-dose-day-fixed-${w}x${h}.png` });
    await scrollTo(page, 4, 0.8);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/5-damage-fixed-${w}x${h}.png` });
    await scrollTo(page, 7, 0.6);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/8-forecast-fixed-${w}x${h}.png` });
    await scrollTo(page, 9, 0.7);
    await expect(page.getByText("Suggested first dose")).toBeVisible();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/10-human-fixed-${w}x${h}.png` });
    await scrollTo(page, 10, 0.4);
    await page.getByRole("button", { name: "Replacing an animal study" }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/11-trust-fixed-${w}x${h}.png` });
  }
});

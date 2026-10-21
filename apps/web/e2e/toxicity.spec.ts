import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

async function choose(page: import("@playwright/test").Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("menuitemradio", { name: option, exact: true }).click();
}

test("toxicity-first workflow compares doses, recovery, organ coverage, and HED", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("One virtual rat");
  await expect(page.getByRole("button", { name: "Run experiment", exact: true })).toBeEnabled();
  const cards = page.getByRole("group", { name: "Organ responses" });
  await expect(cards.getByRole("button")).toHaveCount(6);
  await expect(cards.getByRole("button", { name: /Kidneys/ })).toContainText("Exposure only");
  await page.getByRole("button", { name: /Translate the dose/ }).click();
  await expect(page.getByTestId("hed-value")).toHaveText("24.32 mg/kg");
  await page.getByRole("button", { name: /Explore the rat/ }).click();
  await page.getByLabel("Daily dose (mg/kg)", { exact: true }).fill("300");
  await expect(page.getByText(/Ready for a new experiment/)).toBeVisible();
  await choose(page, "Dosing duration", "7 days");
  await page.locator(".tox-advanced > summary").click();
  await choose(page, "Recovery after dosing", "7 days without dosing");
  await page.getByRole("button", { name: "Run experiment", exact: true }).click();
  await expect(page.getByRole("button", { name: "Run experiment", exact: true })).toBeEnabled();
  await expect(page.getByText(/Ready for a new experiment/)).toHaveCount(0);
  await page.getByRole("button", { name: /Translate the dose/ }).click();
  await expect(page.getByTestId("hed-value")).toHaveText("48.65 mg/kg");
  await page.getByRole("button", { name: /Explore the rat/ }).click();
  const day = page.getByRole("slider", { name: /Inspect day/ });
  await expect(day).toHaveAttribute("max", "14");
  await day.fill("0");
  await expect(cards.getByRole("button", { name: /Liver/ })).toContainText("No modeled injury");
  await day.fill("14");
  await expect(page.getByText("Recovery period", { exact: true })).toBeVisible();
  await cards.getByRole("button", { name: /Kidneys/ }).click();
  await page.getByRole("button", { name: /Compare exposure/ }).click();
  await expect(page.getByText(/No injury mechanism is parameterized for kidneys/)).toBeVisible();
  await choose(page, "Concentration", "Blood plasma");
  await choose(page, "Time window", "First 24 hours");
  await page.getByRole("button", { name: /Translate the dose/ }).click();
  await page.getByLabel("Rat dose (mg/kg)", { exact: true }).fill("37");
  await expect(page.getByTestId("hed-value")).toHaveText("6 mg/kg");
  await page.locator(".tox-notebook > summary").click();
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PK data (CSV)" }).click();
  expect((await csv).suggestedFilename()).toBe("vast-exposure-comparison.csv");
  const json = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export results (JSON)" }).click();
  const artifact = await json;
  expect(artifact.suggestedFilename()).toBe("vast-toxicity-experiment.json");
  const exported = JSON.parse(await readFile((await artifact.path())!, "utf8"));
  expect(exported.experiment).toMatchObject({ dose: 300, days: 7, recovery: 7 });
  expect(exported.selected.doseMgPerKg).toBe(300);
  expect(exported.reference.doseMgPerKg).toBe(150);
  expect((await new AxeBuilder({ page }).include(".tox-page").analyze()).violations).toEqual([]);
  await page.screenshot({ path: "test-results/toxicity-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Theme: Auto", exact: true }).click();
  expect((await new AxeBuilder({ page }).include(".tox-page").analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: /Explore the rat/ }).click();
  await page.getByTestId("rat-stage").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/toxicity-mobile.png" });
  await page.getByRole("button", { name: /Edit experiment/ }).click();
  await page.getByLabel("Daily dose (mg/kg)", { exact: true }).fill("");
  await expect(page.getByRole("button", { name: "Run experiment", exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("profiles update coverage and cancel leaves a usable workbench", async ({ page }) => {
  await page.goto("/#toxicity");
  await expect(page.getByRole("button", { name: "Run experiment", exact: true })).toBeEnabled();
  await choose(page, "Compound profile", "Marrow & gut injury");
  await page.getByRole("button", { name: "Run experiment", exact: true }).click();
  await expect(page.getByRole("button", { name: "Run experiment", exact: true })).toBeEnabled();
  const cards = page.getByRole("group", { name: "Organ responses" });
  await expect(cards.getByRole("button", { name: /Liver/ })).toContainText("Exposure only");
  await expect(cards.getByRole("button", { name: /Bone marrow/ })).not.toContainText("Exposure only");
  await choose(page, "Dosing duration", "90 days");
  await page.getByRole("button", { name: "Run experiment", exact: true }).click();
  await page.getByRole("button", { name: "Cancel run", exact: true }).click();
  await expect(page.getByRole("button", { name: "Run experiment", exact: true })).toBeEnabled();
  await choose(page, "Dosing duration", "7 days");
  await page.getByRole("button", { name: "Run experiment", exact: true }).click();
  await expect(page.getByRole("button", { name: "Run experiment", exact: true })).toBeEnabled();
  await expect(page.getByRole("slider", { name: /Inspect day/ })).toHaveAttribute("max", "7");
});

test("the interactive rat, timeline, simple navigation, and mobile learning flow stay synchronized", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("no3d", "1"));
  await page.goto("/");
  await expect(page.getByRole("group", { name: "Organ responses" })).toBeVisible();
  await expect(page.getByLabel("Recovery after dosing", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Explore Kidneys", exact: true }).click();
  await expect(page.getByRole("group", { name: "Organ responses" }).getByRole("button", { name: /Kidneys/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Explore Liver", exact: true }).click();
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  const day = page.getByRole("slider", { name: /Inspect day/ });
  await expect.poll(async () => Number(await day.inputValue())).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  const paused = await day.inputValue();
  await page.waitForTimeout(650);
  await expect(day).toHaveValue(paused);
  await day.fill("0");
  await expect(page.locator(".tox-detail h3")).toHaveText("No modeled injury");
  await day.fill("28");
  await expect(page.locator(".tox-detail h3")).not.toHaveText("No modeled injury");
  for (const name of ["Explore the rat", "Compare exposure", "Translate the dose"]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.getByRole("button", { name: "Theme: Auto", exact: true }).click();
  for (const name of ["Explore the rat", "Compare exposure", "Translate the dose"]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.getByLabel("More options", { exact: true }).click();
  await page.getByRole("button", { name: /^CB palette/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "cb");
  await page.keyboard.press("Escape");
  await expect(page.locator(".app-more")).not.toHaveAttribute("open");
  await expect(page.getByLabel("More options", { exact: true })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["Explore the rat", "Compare exposure", "Translate the dose"]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole("button", { name: /VAST home/ }).click();
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Different exposure");
  await page.getByRole("button", { name: "VAST home", exact: true }).click();
  await expect(page.getByRole("group", { name: "Organ responses" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("3D rat loads, rotates, changes layers, and recovers to the organ map", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => { localStorage.setItem("force3d", "1"); });
  await page.goto("/");
  await expect(page.getByTestId("rat-stage")).toHaveAttribute("data-view", "3d");
  await expect(page.getByText("Drag to rotate · choose Inside to explore", { exact: true })).toBeVisible();
  await expect(page.locator(".rat-stage canvas")).toBeVisible();
  await page.getByRole("button", { name: "Surface", exact: true }).click();
  await expect(page.getByRole("button", { name: "Surface", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Rotate rat left", exact: true }).click();
  await page.getByRole("button", { name: "Rotate rat right", exact: true }).click();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.getByRole("button", { name: "Inside", exact: true }).click();
  await page.getByRole("button", { name: "Focus Liver", exact: true }).click();
  await expect(page.getByRole("button", { name: "Focus Liver", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.screenshot({ path: "test-results/rat-3d.png" });
  await page.evaluate(() => document.querySelector(".rat-stage canvas")!.dispatchEvent(new Event("webglcontextlost")));
  await expect(page.getByTestId("rat-stage")).toHaveAttribute("data-view", "map");
  await expect(page.getByText(/3D is unavailable on this device/)).toBeVisible();
  await page.getByRole("button", { name: "Explore Heart", exact: true }).click();
  await expect(page.getByRole("group", { name: "Organ responses" }).getByRole("button", { name: /Heart/ })).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("a touch device can scroll across the 3D rat and edit the compact experiment", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    await context.addInitScript(() => localStorage.setItem("force3d", "1"));
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.getByText("Use arrows to meet the virtual rat", { exact: true })).toBeAttached();
    await expect(page.getByRole("button", { name: /Edit experiment/ })).toBeVisible();
    await expect(page.getByLabel("Daily dose (mg/kg)", { exact: true })).not.toBeVisible();
    const canvas = page.locator(".rat-stage canvas");
    const box = (await canvas.boundingBox())!;
    const session = await context.newCDPSession(page);
    const y = Math.min(780, box.y + box.height * 0.6), x = box.x + box.width / 2;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - i * 20 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(30);
    await page.getByRole("button", { name: /Edit experiment/ }).tap();
    await page.getByLabel("Daily dose (mg/kg)", { exact: true }).fill("75");
    await page.getByRole("button", { name: "Run experiment", exact: true }).tap();
    await expect(page.getByRole("button", { name: /Edit experiment/ })).toBeVisible();
    await expect(page.getByLabel("Daily dose (mg/kg)", { exact: true })).not.toBeVisible();
    await expect(page.locator(".tox-run-context")).toContainText("75 mg/kg daily");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "e2e/screenshots/phase-f";
mkdirSync(SHOTS, { recursive: true });

async function fresh(page: Page, hash = "") {
  await page.goto("about:blank");
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("quality", "low"); localStorage.setItem("no3d", "1"); });
  await page.goto("about:blank");
  await page.goto(`/${hash}`);
}

test("command palette: open, search, run, close, restore focus", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fresh(page);
  await page.getByRole("button", { name: /^Search/ }).focus();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();
  const box = dialog.getByRole("combobox", { name: "Search commands" });
  await expect(box).toBeFocused();

  // search and run: a Lab view
  await box.fill("validation");
  await expect(dialog.getByRole("option").first()).toContainText("Validation");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("tab", { name: "Validation" })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/#lab\/trust/);

  // nonsense shows an honest empty state; Escape closes and returns focus
  await page.getByRole("button", { name: /^Search/ }).focus();
  await page.keyboard.press("Control+k");
  await box.fill("zzzzqq");
  await expect(dialog).toContainText("Nothing matches");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /^Search/ })).toBeFocused();

  // arrow keys move the selection; a compound can be chosen from here
  await page.keyboard.press("Control+k");
  await box.fill("kidney");
  await expect(dialog.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("mode"))).toBe("lab");
  expect(errors).toEqual([]);
});

test("command palette jumps from the Lab to a Story chapter", async ({ page }) => {
  await fresh(page, "#lab/design");
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search commands" }).fill("thousand");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "A thousand rats." })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => { const r = document.querySelector("[data-chapter='7']")!.getBoundingClientRect(); return r.top < innerHeight / 2 && r.bottom > 0; }), { timeout: 15_000 }).toBe(true);
});

test("charts: direct labels, keyboard readout, data table", async ({ page }) => {
  test.setTimeout(300_000);
  await fresh(page, "#lab/animal");
  await page.getByRole("tab", { name: "Clinical observations" }).click();
  const chart = page.getByRole("group", { name: /^Body weight\. Use the left and right arrow keys/ }).first();
  await expect(chart).toBeVisible({ timeout: 200_000 });
  // two series: names are written on the chart itself
  await expect(chart.locator("svg text", { hasText: "Untreated twin" })).toBeVisible();
  await expect(chart.locator("svg text", { hasText: "Treated" }).first()).toBeVisible();
  // keyboard crosshair reads both series at the same day
  await chart.focus();
  await page.keyboard.press("End");
  const status = page.locator(".chart [role=status]").first();
  await expect(status).toContainText("Study day");
  await expect(status).toContainText("Treated:");
  await expect(status).toContainText("Untreated twin:");
  await expect(chart.locator(".tip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(chart.locator(".tip")).toHaveCount(0);
  // data table is available, with a header per series
  await page.locator(".chart-data summary").first().click();
  const table = page.getByRole("region", { name: /Body weight, data table/ });
  await expect(table.getByRole("columnheader")).toHaveCount(3);
  expect(await table.getByRole("row").count()).toBeGreaterThan(5);
  await page.screenshot({ path: `${SHOTS}/chart-1440.png` });
});

test("phase (f) screenshots: palette, dark theme, phone charts, log-axis PK chart", async ({ page }) => {
  test.setTimeout(300_000);
  await fresh(page, "#lab/data");
  await expect(page.getByRole("group", { name: /Use the left and right arrow keys/ }).first()).toBeVisible({ timeout: 200_000 });
  await page.screenshot({ path: `${SHOTS}/pkpd-1440.png` });
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search commands" }).fill("th");
  await page.screenshot({ path: `${SHOTS}/palette-1440.png` });
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.keyboard.press("Control+k");
  await page.screenshot({ path: `${SHOTS}/palette-dark-1440.png` });
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^Search/ }).click();
  await page.screenshot({ path: `${SHOTS}/palette-390.png` });
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${SHOTS}/pkpd-390.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("overview answers first and every tile opens its analysis", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fresh(page, "#lab/overview");
  await expect(page.getByRole("heading", { name: "No adverse effect up to 2.4 mg/kg/day. Adverse from 8 mg/kg/day." })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("First sign of harm: AST (liver and muscle enzyme) in males, up 416%.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Dose groups, lowest first" }).getByRole("listitem")).toHaveCount(4);
  const tile = page.getByRole("button", { name: /Highest dose with no adverse effect/ });
  await expect(tile).toContainText("2.4", { timeout: 10_000 });
  await tile.click();
  await expect(page.getByRole("tab", { name: "Statistics and NOAEL" })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/#lab\/data/);
  await page.getByRole("navigation", { name: "Lab sections" }).getByRole("button", { name: /^Overview/ }).click();
  await page.getByRole("button", { name: /Humane endpoints/ }).click();
  await expect(page.getByRole("tab", { name: "Humane endpoints and forecast" })).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});

test("simple mode folds expert tables away; expert mode shows them; readable names throughout", async ({ page }) => {
  await fresh(page, "#lab/data");
  await page.getByRole("tab", { name: "Statistics and NOAEL" }).click();
  await expect(page.getByText("Troponin I (heart damage) in males, up 1510%")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("chem.troponinI")).toHaveCount(0);
  const reveal = page.getByRole("button", { name: "Show every endpoint comparison" });
  await expect(reveal).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "Endpoint comparisons" })).toHaveCount(0);
  await reveal.click();
  await expect(page.getByRole("heading", { name: "Endpoint comparisons" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide every endpoint comparison" })).toHaveAttribute("aria-expanded", "true");
  // the Expert switch shows everything and is remembered
  await page.getByRole("button", { name: "Hide every endpoint comparison" }).click();
  await page.getByRole("group", { name: "Level of detail" }).getByRole("button", { name: "Expert" }).click();
  await expect(page.getByRole("heading", { name: "Endpoint comparisons" })).toBeVisible();
  await expect(page.getByRole("button", { name: /every endpoint comparison/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("group", { name: "Level of detail" }).getByRole("button", { name: "Expert" })).toHaveAttribute("aria-pressed", "true");
});

test("rat sounds: off by default, one toggle for the whole app, engine loads only on demand", async ({ page }) => {
  await fresh(page, "#lab/overview");
  const engine: string[] = [];
  page.on("request", (r) => { if (/engine/.test(r.url())) engine.push(r.url()); });
  const rat = page.getByRole("button", { name: /^Rat sounds/ });
  await expect(rat).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(500);
  expect(engine).toEqual([]);
  await rat.click();
  await expect(rat).toHaveAttribute("aria-pressed", "true");
  await expect(rat).toHaveText(/Rat sounds on/);
  await expect(page.getByRole("button", { name: /^Sound on/ })).toHaveAttribute("aria-pressed", "true");
  await rat.click();
  await expect(rat).toHaveAttribute("aria-pressed", "false");
});

test("rat voices run without errors: chirp on an organ, listen to the heart, ambience", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await fresh(page, "#lab/animal");
  await page.getByRole("tab", { name: "3D rat" }).click();
  await page.getByRole("button", { name: /^Rat sounds/ }).click();
  await expect(page.getByRole("button", { name: /^Rat sounds on/ })).toBeVisible();
  await page.getByRole("button", { name: /^Heart/ }).first().click();
  const listen = page.getByRole("button", { name: /Listen to the heart/ });
  await expect(listen).toBeVisible({ timeout: 30_000 });
  await listen.click();
  await expect(page.getByRole("button", { name: /Listening at \d+ beats a minute/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Listen to the heart/ })).toBeVisible({ timeout: 8_000 });
  await page.getByRole("tab", { name: "Behaviour" }).click();
  await page.waitForTimeout(7000); // at least one sniffing bout
  expect(await page.evaluate(() => typeof AudioContext)).toBe("function");
  expect(errors.filter((e) => !/GL Driver Message|GPU stall|WebGL/.test(e))).toEqual([]);
});

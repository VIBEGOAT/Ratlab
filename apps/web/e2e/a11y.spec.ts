import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility gate: axe-core must find no violations in the Story, every Lab section, the palette and presenter mode,
 * in light, dark and the colour-blind palette. Automated checks catch about a third of problems; the keyboard and
 * screen-reader behaviour is covered by the other specs.
 */
async function fresh(page: Page, hash = "") {
  await page.goto("about:blank");
  await page.goto("/#story");
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("no3d", "1"); });
  await page.goto("about:blank");
  await page.goto(`/${hash}`);
}

async function scan(page: Page, label: string) {
  await page.waitForTimeout(500); // let colour transitions finish so contrast is measured on the final colours
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  const summary = r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `${label}\n${summary.join("\n")}`).toEqual([]);
}

test("Story has no axe violations (light, dark, colour-blind)", async ({ page }) => {
  test.setTimeout(240_000);
  await fresh(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/virtual rats ready/).first()).toBeAttached({ timeout: 120_000 });
  await scan(page, "story light");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await scan(page, "story dark");
  await page.evaluate(() => { document.documentElement.setAttribute("data-theme", "light"); document.documentElement.setAttribute("data-palette", "cb"); });
  await scan(page, "story colour-blind");
});

test("Story chapters with live data have no axe violations", async ({ page }) => {
  test.setTimeout(240_000);
  await fresh(page);
  await expect(page.getByText(/virtual rats ready/).first()).toBeAttached({ timeout: 120_000 });
  for (const n of [3, 4, 6, 7, 9, 10]) {
    await page.evaluate((n) => {
      const el = document.querySelector<HTMLElement>(`[data-chapter='${n}']`)!;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + el.offsetHeight * 0.3 - innerHeight / 2, behavior: "instant" as ScrollBehavior });
    }, n);
    await page.waitForTimeout(700);
    await scan(page, `story chapter ${n}`);
  }
});

for (const section of ["overview", "design", "animal", "data", "population", "trust"]) {
  test(`Lab ${section} has no axe violations (light and dark)`, async ({ page }) => {
    test.setTimeout(240_000);
    await fresh(page, `#lab/${section}`);
    await expect(page.getByRole("navigation", { name: "Lab sections" })).toBeVisible();
    await expect(page.locator(".content").getByText(/Loading/)).toHaveCount(0, { timeout: 60_000 });
    await page.waitForTimeout(1200);
    await scan(page, `lab ${section} light`);
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await scan(page, `lab ${section} dark`);
  });
}

test("every Lab view, the palette and the honesty drawer have no axe violations", async ({ page }) => {
  test.setTimeout(400_000);
  await fresh(page, "#lab/animal");
  await expect(page.getByText(/Loading/)).toHaveCount(0, { timeout: 120_000 });
  for (const [section, views] of [["animal", ["3D rat", "Behaviour", "Clinical observations"]], ["data", ["PK/PD", "Clinical pathology", "Necropsy and histopathology", "Statistics and NOAEL", "Disease"]], ["population", ["Untreated twin", "Humane endpoints and forecast", "Uncertainty and credibility"]], ["trust", ["Dose calculator", "Human translation", "Validation", "Fidelity and parameters", "Pitch and references"]]] as const) {
    await page.goto(`/#lab/${section}`);
    for (const v of views) {
      await page.getByRole("tab", { name: v }).click();
      await page.waitForTimeout(900);
      await scan(page, `lab view ${v}`);
    }
  }
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await scan(page, "command palette");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Prototype/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await scan(page, "honesty drawer");
});

test("presenter mode and the notes window have no axe violations", async ({ page, context }) => {
  test.setTimeout(240_000);
  await fresh(page);
  await expect(page.getByText(/virtual rats ready/).first()).toBeAttached({ timeout: 120_000 });
  await page.keyboard.press("p");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(800);
  await scan(page, "presenter ask slide");
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(800);
  await scan(page, "presenter reveal slide");
  const notes = await context.newPage();
  await notes.goto("/#notes");
  await expect(notes.getByRole("heading", { name: /The answer|Speaker notes/ })).toBeVisible();
  await scan(notes, "notes window");
});

test("expert mode and opened expert sections have no axe violations", async ({ page }) => {
  test.setTimeout(300_000);
  await fresh(page, "#lab/data");
  await page.getByRole("tab", { name: "Statistics and NOAEL" }).click();
  await page.getByRole("button", { name: "Show every endpoint comparison" }).click();
  await scan(page, "simple mode, section opened");
  await page.getByRole("group", { name: "Level of detail" }).getByRole("button", { name: "Expert" }).click();
  for (const [section, view] of [["data", "Statistics and NOAEL"], ["animal", "3D rat"], ["animal", "Behaviour"], ["population", "Humane endpoints and forecast"], ["trust", "Fidelity and parameters"]] as const) {
    await page.goto(`/#lab/${section}`);
    await page.getByRole("tab", { name: view }).click();
    await page.waitForTimeout(900);
    await scan(page, `expert ${view}`);
  }
});

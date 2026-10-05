import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "e2e/screenshots/phase-c";
mkdirSync(SHOTS, { recursive: true });

async function fresh(page: Page) {
  await page.goto("about:blank");
  await page.goto("/");
  await page.evaluate(async () => { localStorage.clear(); localStorage.setItem("quality", "low"); await new Promise<void>((r) => { const q = indexedDB.deleteDatabase("eliminate-lab"); q.onsuccess = q.onerror = q.onblocked = () => r(); }); });
  await page.goto("about:blank");
  await page.goto("/");
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
  await expect(page.getByText("Study day", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: /Blood tests on day/ })).toBeVisible();

  await scrollTo(page, 5, 0.75);
  await expect(page.getByText("Here, no one did.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/In a laboratory, this is the day a living animal would have suffered/)).toBeVisible();
  await expect(page.getByText(/virtual rats in this study/)).toBeVisible();
  expect(errors.filter((e) => !/WebGL|GPU stall|THREE\./.test(e))).toEqual([]);
});

for (const [w, h] of [[1440, 900], [1920, 1080], [390, 844]] as const) {
  test(`story screenshots at ${w}x${h}`, async ({ page }) => {
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

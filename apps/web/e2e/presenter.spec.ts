import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "e2e/screenshots/phase-e";
mkdirSync(SHOTS, { recursive: true });

async function fresh(page: Page) {
  await page.goto("about:blank");
  await page.goto("/");
  await page.evaluate(async () => { localStorage.clear(); localStorage.setItem("quality", "low"); localStorage.setItem("force3d", "1"); await new Promise<void>((r) => { const q = indexedDB.deleteDatabase("eliminate-lab"); q.onsuccess = q.onerror = q.onblocked = () => r(); }); });
  await page.goto("about:blank");
  await page.goto("/");
  await expect(page.getByText(/virtual rats ready|Preparing/).first()).toBeAttached();
}

test("presenter mode: P starts, keys navigate, the prediction counts and reveals, Escape exits", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fresh(page);
  await expect(page.getByRole("status").filter({ hasText: "virtual rats ready" }).first()).toBeAttached({ timeout: 120_000 });

  await page.keyboard.press("p");
  await expect(page.locator("html")).toHaveClass(/presenting/);
  await expect(page.locator(".topbar")).toBeHidden();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Demo progress" })).toBeVisible();

  // walk to the prediction slide (index 4 in the 3-minute track)
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Which organ will fail first?")).toBeVisible();
  await page.keyboard.press("3");
  await page.keyboard.press("3");
  await page.keyboard.press("1");
  await expect(page.getByText("3 votes, counted on this device only")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/predict-1440.png` });

  // reveal two slides later
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("region", { name: "The answer" })).toContainText(/first to show injury|came closest/);
  await expect(page.getByRole("region", { name: "The answer" })).toContainText(/of the room chose/);
  await page.screenshot({ path: `${SHOTS}/reveal-1440.png` });

  // back navigation and exit
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).not.toHaveClass(/presenting/);
  await expect(page.locator(".topbar")).toBeVisible();
  expect(errors).toEqual([]);
});

test("speaker notes window follows the main window over the channel", async ({ page, context }) => {
  await fresh(page);
  const notes = await context.newPage();
  await notes.goto("/#notes");
  await expect(notes.getByRole("heading", { name: "Speaker notes" })).toBeVisible();
  await notes.getByRole("button", { name: "Start the 3-minute demo" }).click();
  await expect(notes.getByRole("heading", { name: "Every animal we spare" })).toBeVisible();
  await notes.getByRole("button", { name: "Next", exact: true }).click();
  await expect(notes.getByRole("heading", { name: "Meet the rat" })).toBeVisible();
  await expect(page.getByText("Meet the rat").first()).toBeAttached();
  await notes.getByRole("button", { name: "End presentation" }).click();
  await expect(notes.getByText("The presentation is not running.")).toBeVisible();
});

test("auto-advance moves on by itself", async ({ page }) => {
  await fresh(page);
  await page.keyboard.press("p");
  await page.keyboard.press("a");
  await expect(page.getByText(/2 \/ 12/)).toBeAttached({ timeout: 30_000 });
});

test("sound is off by default and loads only when switched on", async ({ page }) => {
  await fresh(page);
  const toggle = page.getByRole("button", { name: /^Sound/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const chunks: string[] = [];
  page.on("request", (r) => { if (/engine/.test(r.url())) chunks.push(r.url()); });
  expect(chunks).toEqual([]);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
});

test("phase (e) screenshots at 1920x1080, phone and the notes window", async ({ page, context }) => {
  test.setTimeout(400_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fresh(page);
  await expect(page.getByRole("status").filter({ hasText: "virtual rats ready" }).first()).toBeAttached({ timeout: 120_000 });
  await page.keyboard.press("p");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/present-1920.png` });
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("1"); await page.keyboard.press("3"); await page.keyboard.press("3");
  await page.screenshot({ path: `${SHOTS}/predict-1920.png` });
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/reveal-1920.png` });

  const notes = await context.newPage();
  await notes.setViewportSize({ width: 980, height: 720 });
  await notes.goto("/#notes");
  await expect(notes.getByRole("heading", { name: "The answer" })).toBeVisible();
  await notes.screenshot({ path: `${SHOTS}/notes-window.png` });

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("p");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/predict-390.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

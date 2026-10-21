import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("complete the practical, retain work, export it, and clear a shared device", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#learn");
  await page.evaluate(() => localStorage.removeItem("vast-practical-01-v1"));
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Different exposure");
  await expect(page.getByRole("button", { name: "Run comparison" })).toBeDisabled();
  const experiments = ["Change the dose", "Change clearance", "Change the interval"];
  for (let i = 0; i < experiments.length; i++) {
    await page.getByRole("navigation", { name: "Practical experiments" }).getByRole("button", { name: new RegExp(experiments[i]!) }).click();
    await page.getByRole("radio", { name: i === 2 ? "It stays the same" : "It increases", exact: true }).check();
    await page.getByRole("button", { name: "Run comparison" }).click();
    await expect(page.getByText("Your prediction matches this model.", { exact: false })).toBeVisible();
    await page.locator("#reflection").fill(`Experiment ${i + 1}: the controlled variable changes the expected exposure relationship.`);
  }
  await expect(page.getByText("3 / 3 reflections recorded")).toBeVisible();
  await page.getByRole("radio", { name: "No, clearance, bioavailability, and timing also matter", exact: true }).check();
  await page.getByRole("radio", { name: "It doubles", exact: true }).check();
  await page.getByRole("radio", { name: "It delivered more drug over the same period", exact: true }).check();
  await page.getByRole("radio", { name: "Nothing by themselves; biological safety requires appropriate evidence", exact: true }).check();
  await page.getByRole("button", { name: "Check answers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "4 / 4 answers correct" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("3 / 3 reflections recorded")).toBeVisible();
  await expect(page.getByRole("heading", { name: "4 / 4 answers correct" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download notebook", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("vast-practical-notebook.html");
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download comparison CSV" }).click();
  expect((await csv).suggestedFilename()).toBe("vast-dose-simulated.csv");
  const accessibility = await new AxeBuilder({ page }).include(".learn-page").analyze();
  expect(accessibility.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: "test-results/learn-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Clear notebook", exact: true }).click();
  await page.getByRole("button", { name: "Keep my work" }).click();
  await expect(page.getByText("3 / 3 reflections recorded")).toBeVisible();
  await page.getByRole("button", { name: "Clear notebook", exact: true }).click();
  await page.getByRole("button", { name: "Clear all my work" }).click();
  await expect(page.getByText("0 / 3 reflections recorded")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run comparison" })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("navigation and lightweight lesson load work", async ({ page }) => {
  await page.goto("/#learn");
  await expect(page.getByRole("button", { name: "Learn", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Story", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Meet the compound");
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Different exposure");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/learn-desktop.png", fullPage: true });
});


test("a blocked browser store does not prevent the lesson", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("Storage blocked"); }; });
  await page.goto("/#learn");
  await expect(page.getByRole("status")).toContainText("Browser storage is unavailable");
  await page.getByRole("radio", { name: "It decreases", exact: true }).check();
  await page.getByRole("button", { name: "Run comparison" }).click();
  await expect(page.getByText("The result differs from your prediction.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Theme: Auto" }).click();
  const accessibility = await new AxeBuilder({ page }).include(".learn-page").analyze();
  expect(accessibility.violations).toEqual([]);
});

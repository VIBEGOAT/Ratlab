// Captures every Lab section and view for design review. Usage: node scripts/lab-shots.mjs [outDir]
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? ".shots";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:5173/");
await page.evaluate(() => { localStorage.setItem("quality", "low"); localStorage.setItem("force3d", "1"); localStorage.setItem("theme", "dark"); });
const sections = { design: [], animal: ["3D rat", "Behaviour", "Clinical observations"], data: ["PK/PD", "Clinical pathology", "Necropsy and histopathology", "Statistics and NOAEL", "Disease"], population: ["Untreated twin", "Humane endpoints and forecast", "Uncertainty and credibility"], trust: ["Human translation", "Validation", "Fidelity and parameters", "Pitch and references"] };
for (const [s, views] of Object.entries(sections)) {
  await page.goto(`http://localhost:5173/#lab/${s}`);
  await page.waitForTimeout(2500);
  if (!views.length) { await page.screenshot({ path: `${out}/${s}.png` }); await page.screenshot({ path: `${out}/${s}-full.png`, fullPage: true }); continue; }
  for (const v of views) {
    await page.getByRole("tab", { name: v }).click();
    await page.waitForTimeout(v === "3D rat" || v === "Behaviour" ? 6000 : 2000);
    await page.screenshot({ path: `${out}/${s}-${v.replace(/\W+/g, "_")}.png`, fullPage: true });
  }
}
await browser.close();
console.log("done");

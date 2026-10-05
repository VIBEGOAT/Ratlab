// CPU profile of the page load against a built, unminified copy. Usage: node scripts/profile-load.mjs http://localhost:4174/
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:4174/";
const wait = Number(process.argv[3] ?? 7000);
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL, args: ["--headless=new"] } : {});
const page = await browser.newPage({ viewport: { width: 1350, height: 940 } });
const cdp = await page.context().newCDPSession(page);
if (process.env.NO3D) await page.addInitScript(() => localStorage.setItem("no3d", "1"));
await page.goto("about:blank");
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
await cdp.send("Profiler.start");
await page.goto(url);
await page.waitForTimeout(wait);
const { profile } = await cdp.send("Profiler.stop");
await browser.close();

const self = new Map();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas;
for (let i = 0; i < profile.samples.length; i++) {
  const n = byId.get(profile.samples[i]);
  const f = n.callFrame;
  const key = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`;
  self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
}
const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
for (const [k, ms] of rows) console.log(ms.toFixed(0).padStart(6), "ms", k);

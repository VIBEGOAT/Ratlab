import { chromium } from "@playwright/test";
for (const opts of [{}, { channel: "chrome", args: ["--headless=new"] }]) {
  try {
    const b = await chromium.launch(opts);
    const p = await b.newPage();
    await p.goto("http://localhost:4173/");
    console.log(JSON.stringify(opts), await p.evaluate(() => { const gl = document.createElement("canvas").getContext("webgl"); if (!gl) return "no webgl"; const e = gl.getExtension("WEBGL_debug_renderer_info"); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "no debug info ext: " + gl.getParameter(gl.RENDERER); }));
    await b.close();
  } catch (e) { console.log(JSON.stringify(opts), "failed", String(e).slice(0, 100)); }
}

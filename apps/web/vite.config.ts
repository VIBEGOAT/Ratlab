import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

/**
 * Inlines the (small) stylesheet into index.html on build, so the first paint needs only the HTML.
 * A separate CSS file is a render-blocking round trip, which is the slowest step on a slow connection.
 * The CSS file itself is kept, because lazy chunks reference it.
 */
function inlineCss(): Plugin {
  return {
    name: "inline-css",
    apply: "build",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        return html.replace(/<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g, (tag, href: string) => {
          const name = href.replace(/^.*\/assets\//, "assets/");
          const asset = bundle[name];
          if (!asset || asset.type !== "asset" || typeof asset.source !== "string") return tag;
          // the file stays in the build: lazily loaded chunks (the Lab) still list it as a dependency to preload
          return `<style>${asset.source}</style>`;
        });
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineCss()],
  server: { port: 5173, fs: { allow: ["../.."] } },
  worker: { format: "es" },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
    sourcemap: true,
    // the Latin Geist file is embedded in the inlined CSS so the first paint already uses the final font (no size jump)
    assetsInlineLimit: (file) => (/geist-latin-wght-normal\.woff2$/.test(file) ? true : undefined),
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});

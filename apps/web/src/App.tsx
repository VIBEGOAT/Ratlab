import { lazy, Suspense, useEffect, useRef } from "react";
import { useStore, type LabSection } from "./store";
import { Footer } from "./app/Footer";
import { StoryPage } from "./story/StoryPage";
import { download, studyToCsv, studyToHtml, studyToJson } from "./lib/export";

const LabShell = lazy(() => import("./app/LabShell").then((m) => ({ default: m.LabShell })));
const SECTIONS: LabSection[] = ["design", "animal", "data", "population", "trust"];

function ExportMenu() {
  const data = useStore((s) => s.study.data);
  return (
    <details className="hovercard" style={{ position: "relative" }}>
      <summary className="chip" style={{ cursor: "pointer", listStyle: "none", color: "var(--ink-2)", padding: "6px 12px", fontSize: 12 }} aria-label="Export">Export</summary>
      <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", display: "flex", flexDirection: "column", gap: 6, padding: 10, background: "var(--surface-solid)", border: "1px solid var(--line-strong)", borderRadius: 10, zIndex: 50, minWidth: 200 }}>
        <button disabled={!data} onClick={() => data && download("study-animals.csv", studyToCsv(data.study), "text/csv")}>Animal data (CSV)</button>
        <button disabled={!data} onClick={() => data && download("study.json", studyToJson(data), "application/json")}>Full run (JSON)</button>
        <button disabled={!data} onClick={() => data && download("study-report.html", studyToHtml(data), "text/html")}>Study report (HTML)</button>
      </div>
    </details>
  );
}

export function App() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const cb = useStore((s) => s.cbPalette);
  const setCb = useStore((s) => s.setCbPalette);
  const run = useStore((s) => s.runStudy);
  const started = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
    if (cb) root.setAttribute("data-palette", "cb"); else root.removeAttribute("data-palette");
  }, [theme, cb]);
  // pre-warm the default study as soon as the app opens, so the story never waits on a spinner
  useEffect(() => { if (!started.current) { started.current = true; void run(); } }, [run]);
  useEffect(() => {
    const read = () => {
      const h = location.hash;
      if (h.startsWith("#lab")) {
        const sec = h.split("/")[1] as LabSection | undefined;
        useStore.setState({ mode: "lab", ...(sec && SECTIONS.includes(sec) ? { labSection: sec } : {}) });
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  return (
    <div className="app">
      <a href="#main" className="sr-only">Skip to content</a>
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true" />ELIMINATE-Lab</div>
        <div className="segmented" role="group" aria-label="Mode">
          <button type="button" aria-pressed={mode === "story"} onClick={() => setMode("story")}>Story</button>
          <button type="button" aria-pressed={mode === "lab"} onClick={() => setMode("lab")}>Lab</button>
        </div>
        <div className="right">
          <ExportMenu />
          <button className="ghost" onClick={() => setCb(!cb)} aria-pressed={cb} title="Colour-blind-safe damage colours">{cb ? "CB palette on" : "CB palette"}</button>
          <button className="ghost" onClick={() => setTheme(nextTheme)} aria-label={`Theme: ${theme}. Switch to ${nextTheme}`}>{theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light"}</button>
        </div>
      </header>
      {mode === "story" ? <StoryPage /> : <Suspense fallback={<div className="empty" style={{ margin: 24 }}>Loading the Lab…</div>}><LabShell /></Suspense>}
      <Footer />
    </div>
  );
}

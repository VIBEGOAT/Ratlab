import { lazy, Suspense, useEffect, useRef } from "react";
import { useStore, type LabSection } from "./store";
import { Footer } from "./app/Footer";
import { StoryPage } from "./story/StoryPage";
import { download, studyToCsv, studyToHtml, studyToJson } from "./lib/export";
import { usePresenter } from "./presenter/store";
import { Presenter } from "./presenter/Presenter";
import { NotesWindow } from "./presenter/NotesWindow";
import { isNotesWindow } from "./presenter/channel";
import { SoundToggle } from "./audio/SoundToggle";
import { CommandPalette, openPalette } from "./palette/CommandPalette";
import { MouseCursor } from "./components/MouseCursor";

const ToxicityPage = lazy(() => import("./toxicity/ToxicityPage").then((m) => ({ default: m.ToxicityPage })));
const LearnPage = lazy(() => import("./learn/LearnPage").then((m) => ({ default: m.LearnPage })));
const LabShell = lazy(() => import("./app/LabShell").then((m) => ({ default: m.LabShell })));
const SECTIONS: LabSection[] = ["overview", "design", "animal", "data", "population", "trust"];

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

function MainApp() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const cb = useStore((s) => s.cbPalette);
  const setCb = useStore((s) => s.setCbPalette);
  const run = useStore((s) => s.runStudy);
  const started = useRef(false);
  const moreMenu = useRef<HTMLDetailsElement>(null);
  const focused = mode === "toxicity" || mode === "learn";

  useEffect(() => {
    window.scrollTo(0, 0);
    if (moreMenu.current) moreMenu.current.open = false;
  }, [mode]);
  useEffect(() => {
    const close = (e: PointerEvent) => { if (moreMenu.current && !moreMenu.current.contains(e.target as Node)) moreMenu.current.open = false; };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && moreMenu.current?.open) {
        moreMenu.current.open = false;
        moreMenu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
    if (cb) root.setAttribute("data-palette", "cb"); else root.removeAttribute("data-palette");
  }, [theme, cb]);
  // pre-warm the default study as soon as the app opens, so the story never waits on a spinner
  useEffect(() => { if ((mode === "story" || mode === "lab") && !started.current) { started.current = true; void run(); } }, [run, mode]);
  useEffect(() => {
    const read = () => {
      const h = location.hash;
      if (h.startsWith("#learn")) { useStore.setState({ mode: "learn" }); }
      else if (h.startsWith("#story")) { useStore.setState({ mode: "story" }); }
      else if (h === "" || h === "#" || h.startsWith("#toxicity")) { useStore.setState({ mode: "toxicity" }); }
      else if (h.startsWith("#lab")) {
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
      <a href="#main" className="sr-only skip-link">Skip to content</a>
      <header className={`topbar${focused ? " topbar-focused" : ""}`}>
        <button className="brand" onClick={() => setMode("toxicity")} aria-label="VAST home"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m5 6 7 12 7-12M8 6l4 7 4-7" stroke="var(--bg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>VAST<span className="brand-caption">A virtual learning lab.</span></button>
        <div className="segmented" role="group" aria-label="Mode">
          <button type="button" aria-pressed={mode === "toxicity"} onClick={() => setMode("toxicity")}>Toxicity</button>
          <button type="button" aria-pressed={mode === "learn"} onClick={() => setMode("learn")}>Learn</button>
          <button type="button" aria-pressed={mode === "story"} onClick={() => setMode("story")}>Story</button>
          {!focused && <button type="button" aria-pressed={mode === "lab"} onClick={() => setMode("lab")}>Lab</button>}
        </div>
        <div className="right">
          {focused ? <details className="app-more" ref={moreMenu}><summary aria-label="More options">More <span aria-hidden="true">⌄</span></summary><div className="app-more-menu">
            <p>Go further</p><button onClick={() => setMode("lab")}>Lab<small>Advanced tools & full study data</small></button>
            <p>Preferences</p><button onClick={() => { openPalette(); if (moreMenu.current) moreMenu.current.open = false; }}>Search<small>Find a tool or page</small></button><button onClick={() => setCb(!cb)} aria-pressed={cb}>CB palette {cb ? "on" : "off"}<small>Alternative injury colors</small></button>
          </div></details> : <button className="ghost palette-btn" onClick={openPalette} aria-keyshortcuts="Control+K Meta+K">Search <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"}</kbd></button>}
          {(mode === "story" || mode === "lab") && <SoundToggle className="ghost hide-narrow" />}
          {(mode === "story" || mode === "lab") && <button className="ghost hide-narrow" onClick={() => usePresenter.getState().start()} title="Presenter mode (P)">Present</button>}
          {(mode === "story" || mode === "lab") && <ExportMenu />}
          {!focused && <button className="ghost hide-narrow" onClick={() => setCb(!cb)} aria-pressed={cb} title="Colour-blind-safe damage colours">{cb ? "CB palette on" : "CB palette"}</button>}
          <button className={`ghost${focused ? " app-theme" : ""}`} onClick={() => setTheme(nextTheme)} title={`Switch to ${nextTheme}`} aria-label={`Theme: ${theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light"}`}>{focused ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg> : `Theme: ${theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light"}`}</button>
        </div>
      </header>
      {mode === "toxicity" ? <Suspense fallback={<div className="empty">Loading the toxicity workbench…</div>}><ToxicityPage /></Suspense> : mode === "learn" ? <Suspense fallback={<div className="empty">Loading the practical…</div>}><LearnPage /></Suspense> : mode === "story" ? <StoryPage /> : <Suspense fallback={<div className="empty" style={{ margin: 24 }}>Loading the Lab…</div>}><LabShell /></Suspense>}
      <Footer />
      <Presenter />
      <CommandPalette />
      <MouseCursor />
    </div>
  );
}

/** The speaker-notes window (#notes) is a light page with no simulation; everything else is the app. */
export function App() {
  return isNotesWindow() ? <NotesWindow /> : <MainApp />;
}

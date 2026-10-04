import { lazy, Suspense, useEffect, useRef } from "react";
import { DISCLAIMER, SIM_VERSION } from "@eliminate/sim-core";
import { useStore } from "./store";
import { Rail } from "./components/Rail";
import { download, studyToCsv, studyToHtml, studyToJson } from "./lib/export";

const DesignTab = lazy(() => import("./tabs/DesignTab"));
const RatTab = lazy(() => import("./tabs/RatTab"));
const BehaviourTab = lazy(() => import("./tabs/BehaviourTab"));
const PkpdTab = lazy(() => import("./tabs/PkpdTab"));
const DiseaseTab = lazy(() => import("./tabs/DiseaseTab"));
const ClinObsTab = lazy(() => import("./tabs/ClinObsTab"));
const ClinPathTab = lazy(() => import("./tabs/ClinPathTab"));
const NecropsyTab = lazy(() => import("./tabs/NecropsyTab"));
const StatsTab = lazy(() => import("./tabs/StatsTab"));
const TwinTab = lazy(() => import("./tabs/TwinTab"));
const PopulationTab = lazy(() => import("./tabs/PopulationTab"));
const TranslationTab = lazy(() => import("./tabs/TranslationTab"));
const CredibilityTab = lazy(() => import("./tabs/CredibilityTab"));
const ValidationTab = lazy(() => import("./tabs/ValidationTab"));
const PitchTab = lazy(() => import("./tabs/PitchTab"));
const FidelityTab = lazy(() => import("./tabs/FidelityTab"));

export const TABS: Array<{ id: string; label: string; View: React.LazyExoticComponent<() => JSX.Element> }> = [
  { id: "design", label: "Study Design", View: DesignTab },
  { id: "rat", label: "Live Rat 3D", View: RatTab },
  { id: "behaviour", label: "Behaviour", View: BehaviourTab },
  { id: "pkpd", label: "PK/PD", View: PkpdTab },
  { id: "disease", label: "Disease Progression", View: DiseaseTab },
  { id: "clinobs", label: "Clinical Obs", View: ClinObsTab },
  { id: "clinpath", label: "Clinical Pathology", View: ClinPathTab },
  { id: "necropsy", label: "Necropsy & Histopath", View: NecropsyTab },
  { id: "stats", label: "Statistics & NOAEL", View: StatsTab },
  { id: "twin", label: "Untreated Twin", View: TwinTab },
  { id: "population", label: "Population & Humane Endpoints", View: PopulationTab },
  { id: "translation", label: "Human Translation", View: TranslationTab },
  { id: "credibility", label: "Uncertainty & Credibility", View: CredibilityTab },
  { id: "validation", label: "Validation", View: ValidationTab },
  { id: "pitch", label: "Pitch", View: PitchTab },
  { id: "fidelity", label: "Model Fidelity & Assumptions", View: FidelityTab },
];

export function App() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const study = useStore((s) => s.study);
  const run = useStore((s) => s.runStudy);
  const started = useRef(false);

  useEffect(() => {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => { if (!started.current) { started.current = true; void run(); } }, [run]);
  useEffect(() => {
    const onHash = () => { const h = location.hash.slice(1); if (TABS.some((t) => t.id === h)) useStore.setState({ tab: h }); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const current = TABS.find((t) => t.id === tab) ?? TABS[0]!;
  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === current.id);
    if (e.key === "ArrowRight") { setTab(TABS[(i + 1) % TABS.length]!.id); e.preventDefault(); }
    if (e.key === "ArrowLeft") { setTab(TABS[(i - 1 + TABS.length) % TABS.length]!.id); e.preventDefault(); }
  };
  const data = study.data;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="eyebrow">In-silico rat study · {SIM_VERSION}</div>
          <h1>ELIMINATE-Lab</h1>
        </div>
        <div className="actions">
          <button disabled={!data} onClick={() => data && download("study-animals.csv", studyToCsv(data.study), "text/csv")}>CSV</button>
          <button disabled={!data} onClick={() => data && download("study.json", studyToJson(data), "application/json")}>JSON</button>
          <button disabled={!data} onClick={() => data && download("study-report.html", studyToHtml(data), "text/html")}>HTML report</button>
          <label className="small muted" htmlFor="theme">Theme </label>
          <select id="theme" value={theme} onChange={(e) => setTheme(e.target.value as "system" | "light" | "dark")} style={{ width: "auto" }}>
            <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </div>
      </header>
      <div className="disclaimer" role="note"><b>{DISCLAIMER}</b> Compounds are fictional archetypes. Most parameters are unverified placeholders.</div>
      <div className="body">
        <Rail />
        <main className="main">
          <div className="tabs" role="tablist" aria-label="Sections" onKeyDown={onKey}>
            {TABS.map((t) => (
              <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={t.id === current.id} aria-controls="panel" tabIndex={t.id === current.id ? 0 : -1} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <div className="content" id="panel" role="tabpanel" aria-labelledby={`tab-${current.id}`}>
            <Suspense fallback={<div className="empty">Loading…</div>}><current.View /></Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

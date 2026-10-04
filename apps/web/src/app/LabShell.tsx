import { lazy, Suspense, type LazyExoticComponent } from "react";
import { useStore, type LabSection } from "../store";
import { AnimalPicker, SetupPanel } from "./SetupPanel";

const views = {
  design: lazy(() => import("../tabs/DesignTab")),
  rat: lazy(() => import("../tabs/RatTab")),
  behaviour: lazy(() => import("../tabs/BehaviourTab")),
  clinobs: lazy(() => import("../tabs/ClinObsTab")),
  pkpd: lazy(() => import("../tabs/PkpdTab")),
  disease: lazy(() => import("../tabs/DiseaseTab")),
  clinpath: lazy(() => import("../tabs/ClinPathTab")),
  necropsy: lazy(() => import("../tabs/NecropsyTab")),
  stats: lazy(() => import("../tabs/StatsTab")),
  twin: lazy(() => import("../tabs/TwinTab")),
  population: lazy(() => import("../tabs/PopulationTab")),
  uncertainty: lazy(() => import("../tabs/CredibilityTab")),
  translation: lazy(() => import("../tabs/TranslationTab")),
  validation: lazy(() => import("../tabs/ValidationTab")),
  fidelity: lazy(() => import("../tabs/FidelityTab")),
  pitch: lazy(() => import("../tabs/PitchTab")),
} satisfies Record<string, LazyExoticComponent<() => JSX.Element>>;
type ViewId = keyof typeof views;

/** Five sections replace the old sixteen tabs. Nothing is lost, only regrouped. */
export const SECTIONS: Array<{ id: LabSection; label: string; hint: string; picker: boolean; views: Array<[ViewId, string]> }> = [
  { id: "design", label: "Design", hint: "Compound, dose, groups", picker: false, views: [["design", "Study design"]] },
  { id: "animal", label: "Animal", hint: "3D rat, behaviour, signs", picker: true, views: [["rat", "3D rat"], ["behaviour", "Behaviour"], ["clinobs", "Clinical observations"]] },
  { id: "data", label: "Data", hint: "PK/PD, pathology, statistics", picker: true, views: [["pkpd", "PK/PD"], ["clinpath", "Clinical pathology"], ["necropsy", "Necropsy and histopathology"], ["stats", "Statistics and NOAEL"], ["disease", "Disease"]] },
  { id: "population", label: "Population", hint: "Twin, humane endpoints, forecast", picker: true, views: [["twin", "Untreated twin"], ["population", "Humane endpoints and forecast"], ["uncertainty", "Uncertainty and credibility"]] },
  { id: "trust", label: "Translate & Trust", hint: "Human outlook, validation, sources", picker: false, views: [["translation", "Human translation"], ["validation", "Validation"], ["fidelity", "Fidelity and parameters"], ["pitch", "Pitch and references"]] },
];

export function LabShell() {
  const section = useStore((s) => s.labSection);
  const view = useStore((s) => s.labView);
  const goLab = useStore((s) => s.goLab);
  const sec = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]!;
  const viewId = (sec.views.find(([v]) => v === view)?.[0] ?? sec.views[0]![0]) as ViewId;
  const View = views[viewId];
  return (
    <div className="lab">
      <nav className="lab-nav" aria-label="Lab sections">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" aria-current={s.id === sec.id ? "page" : undefined} onClick={() => goLab(s.id)}>
            {s.label}<span>{s.hint}</span>
          </button>
        ))}
      </nav>
      <main className="lab-main" id="main">
        {sec.id === "design" && <SetupPanel />}
        {(sec.views.length > 1 || sec.picker) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            {sec.views.length > 1 ? (
              <div className="segmented" role="tablist" aria-label={`${sec.label} views`}>
                {sec.views.map(([v, l]) => <button key={v} role="tab" type="button" aria-selected={v === viewId} aria-pressed={v === viewId} onClick={() => goLab(sec.id, v)}>{l}</button>)}
              </div>
            ) : <span />}
            {sec.picker && <AnimalPicker />}
          </div>
        )}
        <div className="content" role="tabpanel">
          <Suspense fallback={<div className="empty">Loading…</div>}><View /></Suspense>
        </div>
      </main>
    </div>
  );
}

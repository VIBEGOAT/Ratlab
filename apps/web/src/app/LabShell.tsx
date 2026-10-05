import { lazy, Suspense, type LazyExoticComponent } from "react";
import { useStore } from "../store";
import { AnimalPicker, SetupPanel } from "./SetupPanel";
import { SECTIONS, type ViewId } from "../lib/nav";

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
} satisfies Record<ViewId, LazyExoticComponent<() => JSX.Element>>;

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
        <h1 className="sr-only">Lab: {sec.label}</h1>
        {sec.id === "design" && <SetupPanel />}
        {(sec.views.length > 1 || sec.picker) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            {sec.views.length > 1 ? (
              <div className="segmented" role="tablist" aria-label={`${sec.label} views`}>
                {sec.views.map(([v, l]) => <button key={v} role="tab" type="button" aria-selected={v === viewId} onClick={() => goLab(sec.id, v)}>{l}</button>)}
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

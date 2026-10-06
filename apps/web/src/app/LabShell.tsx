import { lazy, Suspense, useRef, type LazyExoticComponent } from "react";
import { useStore } from "../store";
import { AnimalPicker, SetupPanel } from "./SetupPanel";
import { SECTIONS, type ViewId } from "../lib/nav";
import { Icon } from "../components/icons";
import { useSlidingPill } from "../components/motion";
import { SoundToggle } from "../audio/SoundToggle";

const views = {
  overview: lazy(() => import("../tabs/OverviewTab")),
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

function DetailSwitch() {
  const detail = useStore((s) => s.detail);
  const setDetail = useStore((s) => s.setDetail);
  return (
    <div className="segmented detail-switch" role="group" aria-label="Level of detail" title="Simple folds expert-only tables away. Nothing is removed.">
      <button type="button" aria-pressed={detail === "simple"} onClick={() => setDetail("simple")}>Simple</button>
      <button type="button" aria-pressed={detail === "expert"} onClick={() => setDetail("expert")}>Expert</button>
    </div>
  );
}

export function LabShell() {
  const section = useStore((s) => s.labSection);
  const view = useStore((s) => s.labView);
  const goLab = useStore((s) => s.goLab);
  const sec = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]!;
  const viewId = (sec.views.find(([v]) => v === view)?.[0] ?? sec.views[0]![0]) as ViewId;
  const View = views[viewId];
  const navRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const navPill = useSlidingPill(navRef, '[aria-current="page"]', [sec.id]);
  const tabPill = useSlidingPill(tabsRef, '[aria-selected="true"]', [sec.id, viewId]);
  return (
    <div className="lab">
      <nav className="lab-nav" aria-label="Lab sections" ref={navRef}>
        {navPill.ready && <span className="nav-pill" style={navPill.style} aria-hidden="true" />}
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" aria-current={s.id === sec.id ? "page" : undefined} onClick={() => goLab(s.id)}>
            <Icon name={s.icon} size={18} className="nav-icon" />
            <span className="nav-text"><b>{s.label}</b><span>{s.hint}</span></span>
          </button>
        ))}
      </nav>
      <main className="lab-main" id="main">
        <h1 className="sr-only">Lab: {sec.label}</h1>
        <div className="lab-toolbar">
          {sec.views.length > 1 ? (
            <div className="segmented tabs" role="tablist" aria-label={`${sec.label} views`} ref={tabsRef}>
              {tabPill.ready && <span className="seg-pill" style={tabPill.style} aria-hidden="true" />}
              {sec.views.map(([v, l]) => <button key={v} role="tab" type="button" aria-selected={v === viewId} onClick={() => goLab(sec.id, v)}>{l}</button>)}
            </div>
          ) : <span className="lab-crumb">{sec.label}</span>}
          <div className="lab-tools">
            {sec.picker && <AnimalPicker />}
            <DetailSwitch />
            <SoundToggle className="sound-chip" offText="Rat sounds" onText="Rat sounds on" hint="Synthesised sniffing, a chirp when you click the rat, footsteps and the heartbeat. Real rats make most of their calls above the range of human hearing.">
              <Icon name="sound" size={16} />
            </SoundToggle>
          </div>
        </div>
        {sec.id === "design" && <SetupPanel />}
        <div className="content view-enter" role="tabpanel" key={`${sec.id}/${viewId}`}>
          <Suspense fallback={<div className="empty shimmer">Loading…</div>}><View /></Suspense>
        </div>
      </main>
    </div>
  );
}

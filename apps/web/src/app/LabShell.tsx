import { lazy, Suspense, useRef, type LazyExoticComponent } from "react";
import { useStore } from "../store";
import { AnimalPicker, RunStatus, SetupPanel } from "./SetupPanel";
import { SECTIONS, type SectionDef, type ViewId } from "../lib/nav";
import { COMPOUNDS } from "../lib/setup";
import { referenceCaseForCompound } from "../lib/referenceStudies";
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
  calculator: lazy(() => import("../tabs/CalculatorTab")),
  translation: lazy(() => import("../tabs/TranslationTab")),
  validation: lazy(() => import("../tabs/ValidationTab")),
  fidelity: lazy(() => import("../tabs/FidelityTab")),
  pitch: lazy(() => import("../tabs/PitchTab")),
} satisfies Record<ViewId, LazyExoticComponent<() => JSX.Element>>;

function DetailSwitch({ sec, viewId }: { sec: SectionDef; viewId: ViewId }) {
  const detail = useStore((s) => s.detail);
  const setDetail = useStore((s) => s.setDetail);
  const goLab = useStore((s) => s.goLab);
  const choose = (next: "simple" | "expert") => {
    setDetail(next);
    if (next === "simple" && !sec.coreViews.includes(viewId)) goLab(sec.id, sec.coreViews[0]);
  };
  return (
    <div className="segmented detail-switch" role="group" aria-label="Learning depth" title="Guided shows the essential undergraduate path. Research reveals specialist analyses and parameters.">
      <button type="button" aria-pressed={detail === "simple"} onClick={() => choose("simple")}>Guided</button>
      <button type="button" aria-pressed={detail === "expert"} onClick={() => choose("expert")}>Research</button>
    </div>
  );
}

export function LabShell() {
  const section = useStore((s) => s.labSection);
  const view = useStore((s) => s.labView);
  const detail = useStore((s) => s.detail);
  const setup = useStore((s) => s.setup);
  const goLab = useStore((s) => s.goLab);
  const sec = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]!;
  const visibleViews = detail === "simple" ? sec.views.filter(([v]) => sec.coreViews.includes(v)) : sec.views;
  const viewId = (visibleViews.find(([v]) => v === view)?.[0] ?? visibleViews[0]![0]) as ViewId;
  const View = views[viewId];
  const step = SECTIONS.findIndex((s) => s.id === sec.id);
  const modelCompound = COMPOUNDS.find((c) => c.key === setup.compoundKey)?.name ?? setup.custom.name;
  const referenceCase = referenceCaseForCompound(setup.compoundKey);
  const compound = referenceCase ? `${referenceCase.drug} · model proxy` : modelCompound;
  const animalViews: ViewId[] = ["rat", "behaviour", "clinobs", "pkpd", "clinpath", "disease"];
  const soundViews: ViewId[] = ["rat", "behaviour"];
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
            <span className="nav-text"><span className="nav-step" aria-hidden="true">Step {SECTIONS.indexOf(s) + 1}</span><b>{s.label}</b><span>{s.hint}</span></span>
          </button>
        ))}
      </nav>
      <main className="lab-main" id="main">
        <h1 className="sr-only">Lab: {sec.label}</h1>
        <section className="lab-guide" aria-labelledby="lab-step-title">
          <div className="lab-guide-copy">
            <span className="eyebrow">Step {step + 1} of {SECTIONS.length}</span>
            <h2 id="lab-step-title">{sec.label}</h2>
            <p>{sec.question}</p>
          </div>
          <div className="lab-guide-side">
            <DetailSwitch sec={sec} viewId={viewId} />
            <span className="small muted">{detail === "simple" ? "Essential learning path" : "All specialist analyses"}</span>
          </div>
          <div className="study-context" aria-label="Current virtual study">
            <span><small>Compound</small><b>{compound}</b></span>
            <span><small>Top dose</small><b>{setup.highDose} mg/kg/day</b></span>
            <span><small>Schedule</small><b>{setup.durationDays} days · {setup.route === "oral" ? "oral" : setup.route.toUpperCase()}</b></span>
            <RunStatus />
          </div>
          <div className="lab-step-actions">
            <button type="button" className="ghost" disabled={step === 0} onClick={() => step > 0 && goLab(SECTIONS[step - 1]!.id)}>← Previous</button>
            <button type="button" className="primary" disabled={step === SECTIONS.length - 1} onClick={() => step < SECTIONS.length - 1 && goLab(SECTIONS[step + 1]!.id)}>Next step →</button>
          </div>
        </section>
        <div className="lab-toolbar">
          {visibleViews.length > 1 ? (
            <div className="segmented tabs" role="tablist" aria-label={`${sec.label} views`} ref={tabsRef}>
              {tabPill.ready && <span className="seg-pill" style={tabPill.style} aria-hidden="true" />}
              {visibleViews.map(([v, l]) => <button key={v} role="tab" type="button" aria-selected={v === viewId} onClick={() => goLab(sec.id, v)}>{l}</button>)}
            </div>
          ) : <span className="lab-crumb">{sec.label}</span>}
          <div className="lab-tools">
            {animalViews.includes(viewId) && <AnimalPicker />}
            {soundViews.includes(viewId) && <SoundToggle className="sound-chip" offText="Rat sounds" onText="Rat sounds on" hint="Synthesised sniffing, a chirp when you click the rat, footsteps and the heartbeat. Real rats make most of their calls above the range of human hearing.">
              <Icon name="sound" size={16} />
            </SoundToggle>}
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

/* eslint-disable jsx-a11y/label-has-associated-control --
   These labels have visible text in nested spans and an explicit htmlFor/id pair; the rule cannot see through the spans. */
import { ARCHETYPES } from "@eliminate/sim-core";
import { useStore, useResultsStale } from "../store";
import { COMPOUNDS, designProblems, type DiseaseChoice } from "../lib/setup";
import { REFERENCE_CASES, referenceCaseForCompound } from "../lib/referenceStudies";
import { fmtInt } from "../design/format";

/** Study setup with progressive disclosure: four primary choices, everything else under Advanced. */
export function SetupPanel() {
  const setup = useStore((s) => s.setup);
  const set = useStore((s) => s.setSetup);
  const detail = useStore((s) => s.detail);
  const study = useStore((s) => s.study);
  const stale = useResultsStale();
  const problems = designProblems(setup);
  const compoundName = COMPOUNDS.find((c) => c.key === setup.compoundKey)?.name ?? setup.custom.name;
  const referenceCase = referenceCaseForCompound(setup.compoundKey);
  const routeName = setup.route === "oral" ? "oral gavage" : setup.route === "iv" ? "intravenous dosing" : "dietary dosing";
  const pickCompound = (key: string) => set({
    studyMode: "sandbox",
    compoundKey: key,
    highDose: key === "custom" ? setup.custom.defaultDoseMgPerKg : ARCHETYPES[key]!.defaultDoseMgPerKg,
    disease: key === "cardiotoxin" ? "cancer" : "none",
  });
  const modelDoses = [0, ...setup.fractions.map((fraction) => Math.round(fraction * setup.highDose * 10) / 10)];

  if (setup.studyMode === "published" && referenceCase?.id === "acetaminophen-liver") return (
    <section className="lesson-modebar" aria-label="Current learning mode">
      <div><span className="eyebrow">Guided learning mode</span><b>Acetaminophen liver-toxicity practical</b><small>Published observations · approximately 12 minutes</small></div>
    </section>
  );

  return (
    <section className="panel" aria-labelledby="setup-title">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 id="setup-title">Set up the experiment</h2>
      </div>

      <div className="guided-launch">
        <div><span className="eyebrow">Recommended first visit</span><h3>Acetaminophen: a guided liver-toxicity practical</h3><p>Learn through prediction, an animated drug journey, published pathology observations and immediate feedback.</p></div>
        <button type="button" className="primary" onClick={() => set({ studyMode: "published", compoundKey: "hepatotoxin", disease: "none" })}>Start 12-minute practical →</button>
      </div>

      <div className="study-route" aria-label="Study design workflow">
        <span className="active"><b>01</b> Organ challenge</span><span><b>02</b> Reference drug</span><span><b>03</b> Protocol</span><span><b>04</b> Readout</span>
      </div>

      <div className="field"><b>1. Choose the biological question</b> <span className="small">Each case begins with a known drug–organ relationship, then asks you to design the study that would reveal it.</span></div>
      <div className="reference-cases" role="group" aria-label="Published reference cases">
        {REFERENCE_CASES.map((item) => (
          <button key={item.id} type="button" className="reference-case" aria-pressed={setup.compoundKey === item.compoundKey} onClick={() => pickCompound(item.compoundKey)}>
            <span className="reference-organ">{item.organShort}</span>
            <strong>{item.drug}</strong>
            <span>{item.teachingQuestion}</span>
            <small>{item.evidenceState === "curating" ? "Evidence package in curation" : "Source mapped · data import next"}</small>
          </button>
        ))}
      </div>

      {referenceCase && <div className="case-dossier" aria-live="polite">
        <div>
          <span className="eyebrow">Reference case · {referenceCase.organ}</span>
          <h3>{referenceCase.drug}</h3>
          <p>{referenceCase.mechanism}</p>
        </div>
        <div className="endpoint-list" aria-label="Endpoints taught in this case">
          {referenceCase.protocolSnapshot?.map((fact) => <span className="protocol-fact" key={fact}>{fact}</span>)}
          {referenceCase.endpoints.map((endpoint) => <span key={endpoint}>{endpoint}</span>)}
        </div>
        <div className="evidence-contract">
          <b>Evidence contract</b>
          <p><span className="evidence-dot observed" /> Published observations appear only after their numerical tables and units are checked. <span className="evidence-dot predicted" /> Until then, results use the fictional <b>{compoundName.toLowerCase()}</b> model as a labelled prediction proxy.</p>
          <a href={referenceCase.source.url} target="_blank" rel="noreferrer">{referenceCase.source.label} · {referenceCase.source.citation} ↗</a>
        </div>
      </div>}

      {referenceCase && <div className="evidence-mode" role="group" aria-label="Evidence mode">
        <button type="button" className={setup.studyMode === "published" ? "active" : ""} disabled={referenceCase.id !== "acetaminophen-liver"} aria-pressed={setup.studyMode === "published"} onClick={() => set({ studyMode: "published" })}>
          <span><b>Published protocol</b><small>Observed dose groups and endpoints</small></span>
          <em>{referenceCase.id === "acetaminophen-liver" ? "Available · limited evidence" : "Locked · data checking"}</em>
        </button>
        <button type="button" className={setup.studyMode === "sandbox" ? "active" : ""} aria-pressed={setup.studyMode === "sandbox"} onClick={() => set({ studyMode: "sandbox" })}>
          <span><b>Model sandbox</b><small>Change dose and duration to explore</small></span>
          <em>Prediction</em>
        </button>
        <p>{setup.studyMode === "published" ? <><b>Published mode never fills gaps with simulated values.</b> This package currently supports protocol metadata and processed pathology findings only.</> : <><b>You are not editing the published experiment.</b> The controls below change a teaching model.</>}</p>
      </div>}

      {referenceCase?.publishedDoseGroups && <div className="protocol-compare" aria-label="Published and model dose comparison">
        <div><span className="eyebrow">Published design</span><strong>{referenceCase.publishedDoseGroups.map(fmtInt).join(" · ")}</strong><small>mg/kg · observed protocol arms</small></div>
        <span className="protocol-arrow" aria-hidden="true">→</span>
        <div><span className="eyebrow">Your sandbox design</span><strong>{modelDoses.map(fmtInt).join(" · ")}</strong><small>mg/kg/day · predicted model arms</small></div>
        <p><b>Your task:</b> use the model ladder to explore dose–response, then compare its pattern with the published protocol without treating a prediction as an observation.</p>
      </div>}

      {setup.studyMode === "published" && referenceCase?.publishedDoseGroups ? <div className="published-design-lock">
        <span className="eyebrow">2. Published protocol · read only</span>
        <h3>{referenceCase.drug} rat liver study</h3>
        <div><span>Animals<b>Male Crj:CD(SD)IGS · 6 weeks</b></span><span>Administration<b>Gavage</b></span><span>Dose groups<b>{referenceCase.publishedDoseGroups.map(fmtInt).join(" · ")} mg/kg</b></span><span>Study arms<b>Single dose + repeat dose</b></span></div>
        <p>Continue to “Read the answer” to inspect the available observed-derived pathology. Missing PK, chemistry and NOAEL data stay unavailable.</p>
      </div> : <>
      <div className="field"><b>2. Design the dosing protocol</b> <span className="small">The simulator creates a control, low-, mid- and high-dose group. Current dose values are model-proxy settings—not published doses.</span></div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label className="field" htmlFor="top-dose">
          <span className="row"><span>Model top dose</span><b>{fmtInt(setup.highDose)} mg/kg/day</b></span>
          <input id="top-dose" type="range" min={1} max={Math.max(400, setup.highDose)} step={1} value={setup.highDose} onChange={(e) => set({ highDose: +e.target.value })} />
          <span className="small">Low and mid doses are {Math.round(setup.fractions[0] * 100)}% and {Math.round(setup.fractions[1] * 100)}% of this.</span>
        </label>
        <div className="field">
          <span>Study length</span>
          <div className="segmented" role="group" aria-label="Study length">
            {[7, 14, 28, 90].map((d) => <button key={d} type="button" aria-pressed={setup.durationDays === d} onClick={() => set({ durationDays: d })}>{d} days</button>)}
          </div>
          <span className="small">{setup.recovery ? `Plus ${setup.recoveryDays} recovery days for recovery groups.` : "No recovery period."}</span>
        </div>
        {detail === "expert" ? <label className="field" htmlFor="disease">Disease model
          <select id="disease" value={setup.disease} onChange={(e) => set({ disease: e.target.value as DiseaseChoice })}>
            <option value="none">None (healthy animals)</option><option value="cancer">Tumour (xenograft)</option><option value="diabetes-stz">Diabetes, fast onset</option><option value="diabetes-type2">Diabetes, slow onset</option>
          </select>
        </label> : <div className="field guided-context"><span>Biological baseline</span><b>{setup.disease === "cancer" ? "Tumour-bearing animals" : "Healthy animals"}</b><small>Chosen automatically for this teaching case. Research mode allows other disease models.</small></div>}
      </div>

      <div className="study-sentence" aria-live="polite">
        <span className="eyebrow">Study in plain language</span>
        <p>{referenceCase ? <>Explore the <b>{referenceCase.drug}</b> reference case using the labelled <b>{compoundName.toLowerCase()} model proxy</b></> : <>Give virtual rats <b>{compoundName}</b></>} by <b>{routeName}</b>, up to <b>{fmtInt(setup.highDose)} mg/kg/day</b>, for <b>{setup.durationDays} days</b>—then compare exposure, organ injury and recovery with the untreated control.</p>
      </div>

      <details className="more">
        <summary>Research settings (optional)</summary>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label className="field" htmlFor="nsex"><span className="row"><span>Animals per sex per group</span><b>{setup.nPerSex}</b></span>
            <input id="nsex" type="range" min={2} max={20} value={setup.nPerSex} onChange={(e) => set({ nPerSex: +e.target.value })} /></label>
          <div className="field">Sexes
            <div className="checks">{(["M", "F"] as const).map((x) => <label key={x}><input type="checkbox" checked={setup.sexes.includes(x)} onChange={(e) => set({ sexes: e.target.checked ? [...setup.sexes, x] : setup.sexes.filter((s) => s !== x) })} />{x === "M" ? "Male" : "Female"}</label>)}</div></div>
          <label className="field" htmlFor="strain">Strain<select id="strain" value={setup.strain} onChange={(e) => set({ strain: e.target.value as "SD" | "WI" })}><option value="SD">Sprague-Dawley</option><option value="WI">Wistar</option></select></label>
          <label className="field" htmlFor="age"><span className="row"><span>Age at start</span><b>{setup.ageWeeks} weeks</b></span><input id="age" type="range" min={6} max={20} value={setup.ageWeeks} onChange={(e) => set({ ageWeeks: +e.target.value })} /></label>
          <label className="field" htmlFor="route">Route<select id="route" value={setup.route} onChange={(e) => set({ route: e.target.value as "oral" | "iv" | "diet" })}><option value="oral">Oral gavage</option><option value="iv">Intravenous</option><option value="diet">In the diet</option></select></label>
          <div className="field">Satellite groups
            <div className="checks">
              <label><input type="checkbox" checked={setup.recovery} onChange={(e) => set({ recovery: e.target.checked })} />Recovery</label>
              <label><input type="checkbox" checked={setup.tk} onChange={(e) => set({ tk: e.target.checked })} />Toxicokinetic</label>
            </div></div>
          <label className="field" htmlFor="seed">Random seed<input id="seed" type="number" value={setup.seed} onChange={(e) => set({ seed: Math.floor(+e.target.value) || 0 })} /></label>
          <label className="field" htmlFor="custom-pick"><span>Custom compound</span><button id="custom-pick" type="button" aria-pressed={setup.compoundKey === "custom"} onClick={() => pickCompound("custom")}>Use the custom compound editor</button></label>
        </div>
      </details>
      </>}
      {problems.length > 0 && <div className="banner warn small" role="alert">{problems[0]}</div>}
      {study.status === "error" && <div className="banner bad small" role="alert">{study.error}</div>}
      {stale && study.status !== "running" && <span className="sr-only">Results are updating.</span>}
    </section>
  );
}

export function RunStatus() {
  const study = useStore((s) => s.study);
  const stale = useResultsStale();
  const n = study.data?.study.animals.length ?? 0;
  if (study.status === "running") return <span className="small muted" role="status">Simulating… {Math.round(study.progress * 100)}%</span>;
  if (stale) return <span className="small" style={{ color: "var(--warn)" }} role="status">Settings changed. Updating results…</span>;
  if (study.status === "done") return <span className="small muted" role="status">{fmtInt(n)} virtual animals simulated</span>;
  return null;
}

/** Choose which simulated animal the Animal and Data views show. */
export function AnimalPicker() {
  const study = useStore((s) => s.study.data);
  const focusId = useStore((s) => s.focusId);
  const setFocus = useStore((s) => s.setFocus);
  if (!study) return null;
  return (
    <label className="field" htmlFor="focus" style={{ maxWidth: 360 }}>Animal shown
      <select id="focus" value={focusId ?? ""} onChange={(e) => void setFocus(e.target.value)}>
        {study.study.design.groups.map((g) => (
          <optgroup key={g.id} label={`${g.label} · ${fmtInt(g.doseMgPerKg)} mg/kg`}>
            {study.study.animals.filter((a) => a.group === g.id).map((a) => <option key={a.id} value={a.id}>{a.id}{a.terminalReason === "humane" ? " · humane endpoint" : ""}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

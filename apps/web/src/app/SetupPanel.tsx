import { useStore, useResultsStale, type LessonPrediction } from "../store";
import { COMPOUNDS, TOXICITY_MODELS, designProblems, type DiseaseChoice } from "../lib/setup";
import { fmtInt } from "../design/format";

const COPY: Record<string, { model: string; note: string }> = {
  hepatotoxin: { model: "Liver injury", note: "Follow reactive-metabolite stress and hepatocyte injury." },
  nephrotoxin: { model: "Kidney injury", note: "Follow renal concentration and tubular stress." },
  cardiotoxin: { model: "Cardiac injury", note: "Explore cumulative stress in heart muscle." },
  neurotoxin: { model: "Nerve injury", note: "Connect exposure to neural function and behaviour." },
  myelotoxin: { model: "Marrow suppression", note: "Follow reduced blood-cell production." },
};
const HYPOTHESES: Array<{ key: LessonPrediction; label: string; note: string }> = [
  { key: "low", label: "Low", note: "Little or no organ injury" }, { key: "moderate", label: "Moderate", note: "Clear but limited injury" }, { key: "severe", label: "Severe", note: "Major organ injury" },
];

export function SetupPanel() {
  const setup = useStore((s) => s.setup); const set = useStore((s) => s.setSetup);
  const prediction = useStore((s) => s.lessonPrediction); const setPrediction = useStore((s) => s.setLessonPrediction);
  const runStudy = useStore((s) => s.runStudy); const goLab = useStore((s) => s.goLab);
  const detail = useStore((s) => s.detail); const study = useStore((s) => s.study); const stale = useResultsStale();
  const problems = designProblems(setup); const selected = COMPOUNDS.find((item) => item.key === setup.compoundKey); const model = TOXICITY_MODELS[setup.compoundKey]!;
  const pick = (key: string) => { const next = TOXICITY_MODELS[key]!; set({ studyMode: "sandbox", compoundKey: key, highDose: next.doses[1]!, durationDays: next.days.includes(14) ? 14 : next.days[0]!, route: next.route, disease: key === "cardiotoxin" ? "cancer" : "none" }); };
  const run = async () => { await runStudy(); if (designProblems(useStore.getState().setup).length === 0) goLab("overview"); };

  return <section className="simple-study" aria-labelledby="setup-title">
    <header><span className="eyebrow">Interactive toxicity lab</span><h2 id="setup-title">Build a study. Make a prediction. Test it.</h2><p>Choose one of five major toxicity models, set exposure, then commit to a hypothesis before the result is revealed.</p></header>
    <fieldset className="simple-study-models"><legend><span>1</span> Choose a toxicity model</legend><div>{COMPOUNDS.map((item) => { const lesson = TOXICITY_MODELS[item.key]!; const copy = COPY[item.key]!; return <button key={item.key} type="button" aria-pressed={setup.compoundKey === item.key} onClick={() => pick(item.key)}><span className="model-card-top"><small>{lesson.organ}</small><i aria-hidden="true" /></span><b>{lesson.drug}</b><em>{copy.model}</em><p>{copy.note}</p></button>; })}</div></fieldset>
    <div className="simple-study-controls">
      <fieldset><legend><span>2</span> Dose</legend><div className="segmented">{model.doses.map((dose) => <button key={dose} type="button" aria-pressed={setup.highDose === dose} onClick={() => set({ highDose: dose })}>{fmtInt(dose)} mg/kg</button>)}</div><small>Select a low, middle or high teaching exposure.</small></fieldset>
      <fieldset><legend><span>3</span> Study length</legend><div className="segmented">{model.days.map((days) => <button key={days} type="button" aria-pressed={setup.durationDays === days} onClick={() => set({ durationDays: days })}>{days} days</button>)}</div><small>Ask how repeated exposure changes the response.</small></fieldset>
    </div>
    <fieldset className="hypothesis-picker"><legend><span>4</span> Predict the {model.organ.toLowerCase()} response</legend><p>What do you expect at {fmtInt(setup.highDose)} mg/kg/day after {setup.durationDays} days?</p><div>{HYPOTHESES.map((item) => <button key={item.key} type="button" aria-pressed={prediction === item.key} onClick={() => setPrediction(item.key)}><b>{item.label}</b><span>{item.note}</span></button>)}</div></fieldset>
    <div className="simple-study-guide"><article><span>Hypothesis</span><b>Predict before seeing</b><p>Commit to low, moderate or severe injury.</p></article><article><span>Simulation</span><b>Watch exposure unfold</b><p>Follow the animal and target organ over time.</p></article><article><span>Explanation</span><b>Connect cause and effect</b><p>Compare biomarkers, mechanism and your prediction.</p></article></div>
    <div className="simple-study-summary"><div><span className={`support-badge ${model.support}`}>{model.support === "data-backed" ? "Measured-data prediction" : "Mechanistic teaching estimate"}</span><p>Test the <b>{model.organ.toLowerCase()} response to {model.drug}</b> after <b>{setup.durationDays} days</b> at <b>{fmtInt(setup.highDose)} mg/kg/day</b>.</p><small>{model.support === "data-backed" ? "Model readouts use supported repeat-dose data; uncertainty is shown with the result." : "This lesson explains a biological pattern; it is not presented as a calibrated clinical prediction."}</small></div><button type="button" className="primary glass-action" disabled={!prediction || problems.length > 0 || study.status === "running"} onClick={() => void run()}><span>{study.status === "running" ? "Running…" : "Run and reveal"}</span></button></div>
    {detail === "expert" && <details className="more"><summary>Advanced study settings</summary><div className="simple-advanced"><label htmlFor="nsex">Animals per sex<input id="nsex" type="number" min={2} max={20} value={setup.nPerSex} onChange={(event) => set({ nPerSex: +event.target.value })} /></label><label htmlFor="strain">Strain<select id="strain" value={setup.strain} onChange={(event) => set({ strain: event.target.value as "SD" | "WI" })}><option value="SD">Sprague-Dawley</option><option value="WI">Wistar</option></select></label><label htmlFor="route">Route<select id="route" value={setup.route} onChange={(event) => set({ route: event.target.value as "oral" | "iv" | "diet" })}><option value="oral">Oral gavage</option><option value="iv">Intravenous</option><option value="diet">Diet</option></select></label><label htmlFor="disease">Disease context<select id="disease" value={setup.disease} onChange={(event) => set({ disease: event.target.value as DiseaseChoice })}><option value="none">Healthy</option><option value="cancer">Tumour</option><option value="diabetes-stz">Diabetes, fast onset</option><option value="diabetes-type2">Diabetes, slow onset</option></select></label></div></details>}
    {selected && <span className="sr-only">Selected model: {selected.name}</span>}{problems.length > 0 && <div className="banner warn" role="alert">{problems[0]}</div>}{study.status === "error" && <div className="banner bad" role="alert">{study.error}</div>}{stale && study.status !== "running" && <span className="sr-only">Results are updating.</span>}
  </section>;
}

export function RunStatus() { const study = useStore((s) => s.study); const stale = useResultsStale(); const n = study.data?.study.animals.length ?? 0; if (study.status === "running") return <span className="small muted" role="status">Simulating… {Math.round(study.progress * 100)}%</span>; if (stale) return <span className="small" style={{ color: "var(--warn)" }} role="status">Updating results…</span>; if (study.status === "done") return <span className="small muted" role="status">{fmtInt(n)} virtual animals</span>; return null; }

export function AnimalPicker() { const study = useStore((s) => s.study.data); const focusId = useStore((s) => s.focusId); const setFocus = useStore((s) => s.setFocus); if (!study) return null; return <label className="field" htmlFor="focus" style={{ maxWidth: 360 }}>Animal shown<select id="focus" value={focusId ?? ""} onChange={(event) => void setFocus(event.target.value)}>{study.study.design.groups.map((group) => <optgroup key={group.id} label={`${group.label} · ${fmtInt(group.doseMgPerKg)} mg/kg`}>{study.study.animals.filter((animal) => animal.group === group.id).map((animal) => <option key={animal.id} value={animal.id}>{animal.id}{animal.terminalReason === "humane" ? " · humane endpoint" : ""}</option>)}</optgroup>)}</select></label>; }

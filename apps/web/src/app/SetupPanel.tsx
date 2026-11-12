import { ARCHETYPES } from "@eliminate/sim-core";
import { useStore, useResultsStale } from "../store";
import { COMPOUNDS, designProblems, type DiseaseChoice } from "../lib/setup";
import { fmtInt } from "../design/format";

const ORGAN: Record<string, string> = {
  hepatotoxin: "Liver", nephrotoxin: "Kidneys", cardiotoxin: "Heart", neurotoxin: "Nervous system", myelotoxin: "Bone marrow", reference: "Low toxicity",
};
const DRUG: Record<string, { name: string; model: string; note: string }> = {
  hepatotoxin: { name: "Acetaminophen", model: "Liver injury model", note: "Explore reactive-metabolite stress in the liver." },
  nephrotoxin: { name: "Cisplatin", model: "Kidney injury model", note: "Explore drug accumulation and tubular injury." },
  cardiotoxin: { name: "Doxorubicin", model: "Cardiac injury model", note: "Balance anticancer activity with heart stress." },
  neurotoxin: { name: "Paclitaxel", model: "Nerve injury model", note: "Explore exposure-related peripheral nerve effects." },
  myelotoxin: { name: "Cyclophosphamide", model: "Marrow suppression model", note: "Explore reduced blood-cell production and recovery." },
};

/** The Lab starts with only the decisions needed to run a teaching simulation. */
export function SetupPanel() {
  const setup = useStore((s) => s.setup);
  const set = useStore((s) => s.setSetup);
  const goLab = useStore((s) => s.goLab);
  const detail = useStore((s) => s.detail);
  const study = useStore((s) => s.study);
  const stale = useResultsStale();
  const problems = designProblems(setup);
  const selected = COMPOUNDS.find((item) => item.key === setup.compoundKey);
  const referenceDrug = DRUG[setup.compoundKey];
  const pick = (key: string) => set({
    studyMode: "sandbox",
    compoundKey: key,
    highDose: ARCHETYPES[key]!.defaultDoseMgPerKg,
    disease: key === "cardiotoxin" ? "cancer" : "none",
  });

  return <section className="simple-study" aria-labelledby="setup-title">
    <header><span className="eyebrow">New simulation</span><h2 id="setup-title">Design a study</h2><p>Choose an organ response to investigate. The Lab will compare an untreated control with three increasing dose groups.</p></header>

    <fieldset className="simple-study-models"><legend><span>1</span> Choose a toxicity model</legend><div>
      {COMPOUNDS.filter((item) => item.key !== "reference").map((item) => { const drug = DRUG[item.key]!; return <button key={item.key} type="button" aria-pressed={setup.compoundKey === item.key} onClick={() => pick(item.key)}><span className="model-card-top"><small>{ORGAN[item.key]}</small><i aria-hidden="true" /></span><b>{drug.name}</b><em>{drug.model}</em><p>{drug.note}</p></button>; })}
    </div></fieldset>

    <div className="simple-study-controls">
      <label htmlFor="top-dose"><span><b><i>2</i> Highest dose</b><strong>{fmtInt(setup.highDose)} mg/kg/day</strong></span><input id="top-dose" type="range" min={1} max={Math.max(400, setup.highDose)} step={1} value={setup.highDose} onChange={(event) => set({ highDose: +event.target.value })} /><small>The simulation also creates untreated, low-dose and mid-dose groups.</small></label>
      <fieldset><legend><span>3</span> Study length</legend><div className="segmented">{[7, 14, 28, 90].map((days) => <button key={days} type="button" aria-pressed={setup.durationDays === days} onClick={() => set({ durationDays: days })}>{days} days</button>)}</div><small>Longer studies reveal effects that build gradually.</small></fieldset>
    </div>

    <div className="simple-study-guide" aria-label="How the virtual study works"><article><span>Control</span><b>What is normal?</b><p>Untreated virtual rats provide the baseline for every comparison.</p></article><article><span>Dose groups</span><b>Does exposure matter?</b><p>Low, mid and high doses reveal whether effects increase with dose.</p></article><article><span>Readout</span><b>What changed?</b><p>Results connect exposure with organ response, signs and recovery.</p></article></div>

    <div className="simple-study-summary"><div><span className="eyebrow">Your study</span><p>Test a <b>{referenceDrug?.name ?? "custom compound"}-inspired {ORGAN[setup.compoundKey]?.toLowerCase() ?? "organ"} model</b> for <b>{setup.durationDays} days</b>, comparing untreated rats with doses up to <b>{fmtInt(setup.highDose)} mg/kg/day</b>.</p><small>Educational model inspired by a known toxicity pattern—not observed results for this drug.</small></div><button type="button" className="primary glass-action" onClick={() => goLab("overview")}><span>Run simulation</span><i aria-hidden="true">→</i></button></div>

    {detail === "expert" && <details className="more"><summary>Advanced study settings</summary><div className="simple-advanced">
      <label htmlFor="nsex">Animals per sex<input id="nsex" type="number" min={2} max={20} value={setup.nPerSex} onChange={(event) => set({ nPerSex: +event.target.value })} /></label>
      <label htmlFor="strain">Strain<select id="strain" value={setup.strain} onChange={(event) => set({ strain: event.target.value as "SD" | "WI" })}><option value="SD">Sprague-Dawley</option><option value="WI">Wistar</option></select></label>
      <label htmlFor="route">Route<select id="route" value={setup.route} onChange={(event) => set({ route: event.target.value as "oral" | "iv" | "diet" })}><option value="oral">Oral gavage</option><option value="iv">Intravenous</option><option value="diet">Diet</option></select></label>
      <label htmlFor="disease">Disease context<select id="disease" value={setup.disease} onChange={(event) => set({ disease: event.target.value as DiseaseChoice })}><option value="none">Healthy</option><option value="cancer">Tumour</option><option value="diabetes-stz">Diabetes, fast onset</option><option value="diabetes-type2">Diabetes, slow onset</option></select></label>
    </div></details>}
    {selected && <span className="sr-only">Selected model: {selected.name}</span>}
    {problems.length > 0 && <div className="banner warn" role="alert">{problems[0]}</div>}
    {study.status === "error" && <div className="banner bad" role="alert">{study.error}</div>}
    {stale && study.status !== "running" && <span className="sr-only">Results are updating.</span>}
  </section>;
}

export function RunStatus() {
  const study = useStore((s) => s.study);
  const stale = useResultsStale();
  const n = study.data?.study.animals.length ?? 0;
  if (study.status === "running") return <span className="small muted" role="status">Simulating… {Math.round(study.progress * 100)}%</span>;
  if (stale) return <span className="small" style={{ color: "var(--warn)" }} role="status">Updating results…</span>;
  if (study.status === "done") return <span className="small muted" role="status">{fmtInt(n)} virtual animals</span>;
  return null;
}

export function AnimalPicker() {
  const study = useStore((s) => s.study.data);
  const focusId = useStore((s) => s.focusId);
  const setFocus = useStore((s) => s.setFocus);
  if (!study) return null;
  return <label className="field" htmlFor="focus" style={{ maxWidth: 360 }}>Animal shown<select id="focus" value={focusId ?? ""} onChange={(event) => void setFocus(event.target.value)}>{study.study.design.groups.map((group) => <optgroup key={group.id} label={`${group.label} · ${fmtInt(group.doseMgPerKg)} mg/kg`}>{study.study.animals.filter((animal) => animal.group === group.id).map((animal) => <option key={animal.id} value={animal.id}>{animal.id}{animal.terminalReason === "humane" ? " · humane endpoint" : ""}</option>)}</optgroup>)}</select></label>;
}

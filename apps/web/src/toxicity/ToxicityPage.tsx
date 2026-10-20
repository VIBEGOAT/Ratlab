import { useCallback, useEffect, useRef, useState } from "react";
import { ARCHETYPES, ORGANS, SIM_VERSION, convertDoseMgPerKg, type AnimalBundle, type Organ, type Tissue } from "@eliminate/sim-core";
import { LineChart } from "../components/Chart";
import { ORGAN_LABEL } from "../lib/setup";
import { gradeVar } from "../design/damage";
import { download } from "../lib/export";
import { toCsv } from "../lib/csv";
import { call, cancelLane, CancelledError } from "../worker/client";
import { animalConfig, DEFAULT_EXPERIMENT, experimentProblems, organResponse, PROFILE_NAMES, responseRows, type Experiment } from "./experiment";
import { OrganMap } from "./OrganMap";

interface Result { experiment: Experiment; selected: AnimalBundle; reference: AnimalBundle }
const fmt = (n: number | null | undefined) => n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const dailyX = (b: AnimalBundle) => Array.from({ length: b.days + 1 }, (_, i) => i);

function HumanEquivalent({ dose }: { dose: number }) {
  const [ratDose, setRatDose] = useState(String(dose));
  const [weight, setWeight] = useState("60");
  useEffect(() => setRatDose(String(dose)), [dose]);
  const d = ratDose.trim() ? Number(ratDose) : NaN, w = weight.trim() ? Number(weight) : NaN;
  const valid = Number.isFinite(d) && d > 0 && Number.isFinite(w) && w > 0;
  const hed = valid ? convertDoseMgPerKg(d, "rat", "human") : null;
  return <section className="panel tox-hed" aria-labelledby="hed-title"><div className="tox-section-heading"><div><p className="eyebrow">03 / Translate the dose</p><h2 id="hed-title">Human-equivalent dose</h2></div><span className="tox-pill">BSA conversion</span></div>
    <p>Explore how a rat dose converts using standard body-surface-area factors.</p>
    <div className="tox-hed-fields"><label className="field">Rat dose (mg/kg)<input type="number" min="0.01" step="any" value={ratDose} onChange={(e) => setRatDose(e.target.value)} /></label><label className="field">Human body weight (kg)<input type="number" min="1" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} /></label><button onClick={() => setRatDose(String(dose))}>Use selected run dose</button></div>
    <div className="tox-hed-answer" aria-live="polite">{hed !== null ? <><div><span>Human-equivalent dose</span><strong data-testid="hed-value">{fmt(hed)} <small>mg/kg</small></strong></div><div><span>Total at {fmt(w)} kg</span><strong>{fmt(hed * w)} <small>mg</small></strong></div></> : <p>Enter a positive dose and body weight to calculate.</p>}</div>
    <p className="tox-equation">Rat dose × (rat Km 6 / adult human Km 37)</p><p className="small muted">Arithmetic conversion, not a safe human dose or a recommended starting dose. Standard Km factors are reference values; this does not model human exposure, species-specific metabolism, or equivalent toxicity. Weight scales total milligrams only.</p>
    <details><summary>Source and interpretation</summary><p className="small muted">FDA (2005), <i>Estimating the Maximum Safe Starting Dose in Initial Clinical Trials for Therapeutics in Adult Healthy Volunteers</i>, Table 1. A starting-dose assessment requires appropriate nonclinical evidence, selection of the relevant endpoint and species, and justified safety factors. A fictional simulation cannot supply that evidence.</p><a href="https://www.fda.gov/media/72309/download" target="_blank" rel="noreferrer">Read the FDA guidance</a></details>
  </section>;
}

export function ToxicityPage() {
  const [draft, setDraft] = useState<Experiment>({ ...DEFAULT_EXPERIMENT });
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [day, setDay] = useState(28);
  const [organ, setOrgan] = useState<Organ>("liver");
  const [windowMode, setWindowMode] = useState<"all" | "first">("all");
  const [tissue, setTissue] = useState<Tissue | "plasma">("plasma");
  const generation = useRef(0);
  const execute = useCallback(async (e: Experiment) => {
    const problems = experimentProblems(e);
    if (problems.length) { setError(problems.join(" ")); return; }
    const id = ++generation.current;
    cancelLane("toxicity"); setRunning(true); setError(""); setStage("Simulating the selected dose…");
    try {
      const selected = await call("twin", { cfg: animalConfig(e) }, undefined, "toxicity");
      if (id !== generation.current) return;
      setStage("Simulating the matched half-dose comparison…");
      const reference = await call("twin", { cfg: animalConfig(e, e.dose / 2) }, undefined, "toxicity");
      if (id !== generation.current) return;
      setResult({ experiment: { ...e }, selected: selected.treated, reference: reference.treated });
      setDay(e.days + e.recovery);
      setOrgan(ORGANS.find((o) => ARCHETYPES[e.compound]!.td[o]) ?? "liver");
    } catch (err) { if (id === generation.current && !(err instanceof CancelledError)) setError(err instanceof Error ? err.message : "Simulation failed. Try running the experiment again."); }
    finally { if (id === generation.current) setRunning(false); }
  }, []);
  const stop = useCallback(() => { generation.current++; cancelLane("toxicity"); }, []);
  useEffect(() => { void execute(DEFAULT_EXPERIMENT); return stop; }, [execute, stop]);
  const cancel = () => { stop(); setRunning(false); setStage(""); };
  const problems = experimentProblems(draft);
  const stale = !!result && JSON.stringify(draft) !== JSON.stringify(result.experiment);
  const profile = ARCHETYPES[draft.compound]!;
  const outside = draft.dose / 2 < profile.tunedDoseRange[0] || draft.dose > profile.tunedDoseRange[1];
  const rows = result ? responseRows(result.experiment, result.selected, day) : [];
  const active = rows.filter((r) => r.modeled);
  const detail = result ? organResponse(result.experiment, result.selected, organ, day) : null;
  const current = result?.selected;
  const lower = result?.reference;
  const selectedDose = result?.experiment.dose ?? DEFAULT_EXPERIMENT.dose;
  const downloadPk = () => {
    if (!result) return;
    const { selected: a, reference: b, experiment: e } = result;
    download("vast-exposure-comparison.csv", toCsv(a.hoursH.map((h, i) => ({ model_version: SIM_VERSION, evidence: "simulated-fictional", profile: e.compound, route: e.route, dosing_days: e.days, recovery_days: e.recovery, sex: e.sex, strain: "SD", age_weeks: 8, seed: e.seed, time_h: h, selected_dose_mg_kg_day: e.dose, reference_dose_mg_kg_day: e.dose / 2, selected_plasma_mg_L: a.plasma[i], reference_plasma_mg_L: b.plasma[i], ...Object.fromEntries(ORGANS.map((o) => [`selected_${o}_mg_L`, a.tissue[o][i]])) }))), "text/csv;charset=utf-8");
  };
  const exportRun = () => { if (result) download("vast-toxicity-experiment.json", JSON.stringify({ simVersion: SIM_VERSION, evidence: "fictional model; unvalidated against animal data", comparison: "same animal parameters; selected dose versus half dose; no disease overlay", snapshotDay: day, organResults: rows, ...result }, null, 2), "application/json"); };
  return <main className="tox-page" id="main">
    <header className="tox-header"><div><p className="eyebrow">VAST / Virtual toxicology workbench</p><h1>Explore the dose.<br /><span>Understand the response.</span></h1><p>One experiment. Organ response, drug exposure, and dose translation—connected.</p></div><div className="tox-header-note"><span className="tox-live-dot" /><b>Mechanistic simulation</b><span>Fictional compound profiles<br />Research & education prototype</span></div></header>
    <div className="tox-layout">
      <aside className="panel tox-design"><div><p className="eyebrow">Design your experiment</p><h2>What are you testing?</h2></div>
        <fieldset disabled={running}><legend className="sr-only">Experiment inputs</legend>
          <label className="field">Compound profile<select value={draft.compound} onChange={(ev) => { const compound = ev.target.value; setDraft({ ...draft, compound, dose: ARCHETYPES[compound]!.defaultDoseMgPerKg }); }}>{Object.entries(PROFILE_NAMES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
          <p className="small muted">{profile.description}</p>
          <label className="field">Daily dose (mg/kg)<input type="number" min="0.01" max="2000" step="any" value={Number.isNaN(draft.dose) ? "" : draft.dose} onChange={(ev) => setDraft({ ...draft, dose: ev.target.value === "" ? NaN : Number(ev.target.value) })} /></label>
          <div className="tox-presets" aria-label="Dose presets">{[0.5, 1, 2].map((m) => <button key={m} aria-pressed={draft.dose === profile.defaultDoseMgPerKg * m} onClick={() => setDraft({ ...draft, dose: profile.defaultDoseMgPerKg * m })}>{m}× baseline</button>)}</div>
          <label className="field">Dosing duration<select value={draft.days} onChange={(ev) => setDraft({ ...draft, days: Number(ev.target.value) })}>{[7, 14, 28, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
          <label className="field">Recovery after dosing<select value={draft.recovery} onChange={(ev) => setDraft({ ...draft, recovery: Number(ev.target.value) })}>{[0, 7, 14].map((d) => <option key={d} value={d}>{d === 0 ? "No recovery period" : `${d} days without dosing`}</option>)}</select></label>
          <div className="tox-field-pair"><label className="field">Route<select value={draft.route} onChange={(ev) => setDraft({ ...draft, route: ev.target.value as "oral" | "iv" })}><option value="oral">Oral</option><option value="iv">IV bolus</option></select></label><label className="field">Sex<select value={draft.sex} onChange={(ev) => setDraft({ ...draft, sex: ev.target.value as "M" | "F" })}><option value="M">Male</option><option value="F">Female</option></select></label></div>
          <details><summary>Reproducibility</summary><label className="field">Animal seed<input type="number" min="0" max="2147483647" value={Number.isNaN(draft.seed) ? "" : draft.seed} onChange={(ev) => setDraft({ ...draft, seed: ev.target.value === "" ? NaN : Number(ev.target.value) })} /></label><p className="small muted">Sprague–Dawley, 8 weeks at baseline. One virtual animal, matched across both doses. No disease overlay. Once-daily dosing. This is not a population estimate.</p></details>
        </fieldset>
        {outside && <p className="tox-note">One or both comparison doses are outside this profile’s tuned demonstration range ({profile.tunedDoseRange.join("–")} mg/kg/day). Outputs are extrapolations.</p>}
        {problems.length > 0 && <p className="tox-note" role="alert">{problems.join(" ")}</p>}
        <button className="primary tox-run" disabled={running || problems.length > 0} onClick={() => void execute({ ...draft })}>{running ? "Running experiment…" : "Run experiment"}</button>
        {running && <><p role="status" className="small muted">{stage}</p><button onClick={cancel}>Cancel run</button></>}
        {error && <p role="alert" className="tox-note">{error}</p>}
        <div className="tox-comparison-key"><span>COMPARISON</span><p>Selected dose <b>{fmt(draft.dose)} mg/kg/day</b></p><p>Half dose <b>{fmt(draft.dose / 2)} mg/kg/day</b></p><small>Same seed, route, duration, and physiology.</small></div>
      </aside>
      <div className="tox-results" aria-busy={running}>
        {stale && <div className="tox-pending" role="status">Inputs changed. Results below still show {PROFILE_NAMES[result!.experiment.compound]} at {fmt(result!.experiment.dose)} mg/kg/day for {result!.experiment.days} dosing days. Run the experiment to update.</div>}
        {result && current && lower ? <>
          <section className="panel tox-organ-panel" aria-labelledby="organ-results-title"><div className="tox-section-heading"><div><p className="eyebrow">01 / Organ response</p><h2 id="organ-results-title">Where does the impact appear?</h2></div><span className="tox-pill">{PROFILE_NAMES[result.experiment.compound]} · {fmt(selectedDose)} mg/kg/day</span></div>
            <div className="tox-timeline"><label htmlFor="tox-day">Inspect day <strong>{day}</strong> / {current.days}</label><input id="tox-day" type="range" min="0" max={current.days} step="1" value={day} onChange={(ev) => setDay(Number(ev.target.value))} /><span>{day > result.experiment.days ? "Recovery period" : day === result.experiment.days && result.experiment.recovery > 0 ? "End of dosing" : "Dosing period"}</span></div>
            <div className="tox-organ-grid"><div className="tox-map-wrap"><OrganMap experiment={result.experiment} animal={current} day={day} selected={organ} /><div className="tox-map-caption"><b>Day {day} snapshot</b><span>Color = modeled injury grade · gray = not modeled</span></div></div><div className="tox-organ-cards" role="group" aria-label="Organ responses">{rows.map((r) => <button key={r.organ} aria-pressed={organ === r.organ} onClick={() => { setOrgan(r.organ); setTissue(r.organ); }} className="tox-organ-card" style={{ "--organ-color": r.grade === null ? "var(--muted)" : gradeVar(r.grade) } as React.CSSProperties}><span>{ORGAN_LABEL[r.organ]}</span><b>{r.severity}</b><small>{r.grade === null ? "No injury mechanism in this profile" : `Grade ${r.grade} / 5 · index ${fmt(r.damage)}`}</small><i aria-hidden="true"><em style={{ width: `${r.damage === null ? 0 : r.damage * 100}%` }} /></i></button>)}</div></div>
            <div className="tox-detail"><div><span className="eyebrow">Selected organ</span><h3>{ORGAN_LABEL[organ]}</h3><p>{detail?.modeled ? `Modeled injury index ${fmt(detail.damage)} at day ${day}. Grades are illustrative bins of the model index, not observed histopathology.` : "Exposure is simulated, but this compound profile has no injury mechanism for this organ. This does not establish safety."}</p></div><div><span className="small muted">First modeled mild injury over the run</span><b>{detail?.modeled ? detail.firstMildDay === null ? "Not reached" : `Day ${detail.firstMildDay}` : "Not assessed"}</b></div></div>
            <p className="small muted">Lung, spleen, muscle, and adipose have exposure compartments but no injury models. Selecting a profile does not enable toxicity prediction for every organ.</p>
          </section>
          <div className="tox-metrics"><div><span>Whole-run plasma Cmax</span><strong>{fmt(current.pk.cmax)} <small>mg/L</small></strong><p>Half dose: {fmt(lower.pk.cmax)} mg/L</p></div><div><span>AUC over {current.days * 24} h</span><strong>{fmt(current.pk.aucAll)} <small>mg·h/L</small></strong><p>Half dose: {fmt(lower.pk.aucAll)} mg·h/L</p></div><div><span>Injury mechanisms in this profile</span><strong>{active.length} <small>/ 6 systems</small></strong><p>Other systems are not assessed for injury</p></div></div>
          <section className="panel tox-plot" aria-labelledby="pk-title"><div className="tox-section-heading"><div><p className="eyebrow">02 / Exposure explains response</p><h2 id="pk-title">What changes when the dose increases?</h2></div><div className="tox-chart-controls"><div className="field"><label htmlFor="tox-concentration">Concentration</label><select id="tox-concentration" value={tissue} onChange={(ev) => setTissue(ev.target.value as Tissue | "plasma")}><option value="plasma">Plasma</option>{ORGANS.map((o) => <option key={o} value={o}>{ORGAN_LABEL[o]}</option>)}<option value="lung">Lung (exposure only)</option><option value="fat">Adipose (exposure only)</option></select></div><div className="field"><label htmlFor="tox-window">Time window</label><select id="tox-window" value={windowMode} onChange={(ev) => setWindowMode(ev.target.value as "all" | "first")}><option value="all">Whole experiment</option><option value="first">First 24 hours</option></select></div></div></div>
            <LineChart label="Dose comparison: concentration over time" height={280} xLabel="Time after first dose (h)" yLabel="Concentration (mg/L)" xMin={0} xMax={windowMode === "first" ? 24 : current.days * 24} yMin={0} marker={windowMode === "all" ? day * 24 : undefined} shade={result.experiment.recovery > 0 && windowMode === "all" ? [[result.experiment.days * 24, current.days * 24]] : undefined} series={[{ name: `${fmt(selectedDose / 2)} mg/kg/day`, x: lower.hoursH.filter((h) => windowMode === "all" || h <= 24), y: (tissue === "plasma" ? lower.plasma : lower.tissue[tissue]).slice(0, windowMode === "first" ? 25 : undefined), color: "var(--c2)", dash: "6 4" }, { name: `${fmt(selectedDose)} mg/kg/day`, x: current.hoursH.filter((h) => windowMode === "all" || h <= 24), y: (tissue === "plasma" ? current.plasma : current.tissue[tissue]).slice(0, windowMode === "first" ? 25 : undefined), color: "var(--accent)" }]} />
            <p className="small muted">Two simulated dose arms with matched individual parameters. Concentrations shown hourly; summary metrics use the 0.25 h solver grid. Shaded region denotes recovery without further doses. Injury may feed back on clearance, so exposure need not scale exactly with dose.</p>
          </section>
          <section className="panel tox-plot"><div className="tox-section-heading"><div><p className="eyebrow">Response over time</p><h2>{ORGAN_LABEL[organ]} injury trajectory</h2></div><span className="tox-pill">Selected vs half dose</span></div>{detail?.modeled ? <LineChart label={`${ORGAN_LABEL[organ]} modeled injury over days`} height={220} xLabel="Study day" yLabel="Modeled injury index (0–1)" xMin={0} xMax={current.days} yMin={0} yMax={1} marker={day} shade={result.experiment.recovery > 0 ? [[result.experiment.days, current.days]] : undefined} series={[{ name: "Half dose", x: dailyX(lower), y: lower.daily.damage[organ], color: "var(--c2)", dash: "6 4" }, { name: "Selected dose", x: dailyX(current), y: current.daily.damage[organ], color: "var(--accent)" }]} /> : <p className="tox-note">No injury mechanism is parameterized for {ORGAN_LABEL[organ].toLowerCase()} in this profile. Inspect the exposure curve or choose another profile.</p>}<p className="small muted">Index 0–1 is an internal model state, not the fraction of tissue destroyed or the probability of toxicity. Recovery reflects the profile’s assumed repair rates.</p></section>
          <HumanEquivalent dose={selectedDose} />
          <section className="panel tox-export"><div><h2>Keep the experiment</h2><p>Export the settings, model version, organ results, and exposure data for a report or discussion.</p></div><div><button onClick={exportRun}>Export results (JSON)</button><button onClick={downloadPk}>Export PK data (CSV)</button></div></section>
          <details className="panel tox-methods"><summary>Model coverage, assumptions, and reproducibility</summary><p>This experiment uses the existing compartmental PBPK and injury–repair engine, with fictional compound parameters. Organs are affected only where the selected profile defines a toxicodynamic mechanism. The model has not been validated against real animal data. No real-compound prediction, NOAEL determination, or human safety assessment is made here.</p><p>Both dose arms use seed {result.experiment.seed}, {result.experiment.sex === "M" ? "male" : "female"} Sprague–Dawley physiology at 8 weeks, once-daily {result.experiment.route} dosing for {result.experiment.days} days, and {result.experiment.recovery} recovery days. Whole-experiment results continue through the scheduled duration even if a modeled humane-endpoint signal occurs; they do not represent a protocol for continuing a live-animal experiment.</p><p>Model version {SIM_VERSION}. Injury is sampled daily; PK is displayed hourly. Population variability and statistical significance are not estimated from these two matched simulations. Model source: <code>packages/sim-core</code>; parameter provenance is available in Lab → Translate & Trust.</p></details>
        </> : <section className="panel tox-loading"><p className="eyebrow">Preparing your first experiment</p><h2>From dose to organ response.</h2><p>{running ? stage : error ? "Adjust the inputs or retry the experiment." : "Run an experiment to inspect organ responses."}</p><div className="tox-loading-grid">{ORGANS.map((o) => <div key={o}>{ORGAN_LABEL[o]}<span>Awaiting simulation</span></div>)}</div></section>}
      </div>
    </div>
  </main>;
}

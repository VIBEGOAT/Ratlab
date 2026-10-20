import { useCallback, useEffect, useRef, useState } from "react";
import { ARCHETYPES, ORGANS, SIM_VERSION, type AnimalBundle, type Organ, type Tissue } from "@eliminate/sim-core";
import { LineChart } from "../components/Chart";
import { Icon } from "../components/icons";
import { ORGAN_LABEL } from "../lib/setup";
import { gradeVar } from "../design/damage";
import { download } from "../lib/export";
import { toCsv } from "../lib/csv";
import { call, cancelLane, CancelledError } from "../worker/client";
import { useStore } from "../store";
import { animalConfig, DEFAULT_EXPERIMENT, experimentProblems, organResponse, PROFILE_NAMES, responseRows, type Experiment } from "./experiment";
import { RatExplorer } from "./RatExplorer";
import { HumanEquivalent } from "./HumanEquivalent";

interface Result { experiment: Experiment; selected: AnimalBundle; reference: AnimalBundle }
type View = "explore" | "exposure" | "translate";
const fmt = (n: number | null | undefined) => n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const dailyX = (b: AnimalBundle) => Array.from({ length: b.days + 1 }, (_, i) => i);
const ORGAN_LESSON: Record<Organ, string> = {
  liver: "The liver processes many compounds. In this profile, reactive metabolites can drive injury while tissue repair works in the opposite direction.",
  kidney: "The kidneys help remove compounds from the blood. Tissue exposure and the profile’s injury threshold both matter for the response.",
  heart: "Some compounds persist in heart tissue. Repeated exposure can build up injury when repair is slow.",
  brain: "Brain exposure depends on how the compound distributes. An injury response appears only when this profile includes a brain mechanism.",
  gut: "The gut is the first stop after an oral dose. Some profiles also model injury to its renewing tissue.",
  marrow: "Bone marrow produces blood cells. Profiles that suppress cell production can show a delayed response across the study.",
};

export function ToxicityPage() {
  const [draft, setDraft] = useState<Experiment>({ ...DEFAULT_EXPERIMENT });
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [day, setDay] = useState(28);
  const [organ, setOrgan] = useState<Organ>("liver");
  const [view, setView] = useState<View>("explore");
  const [playing, setPlaying] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [windowMode, setWindowMode] = useState<"all" | "first">("first");
  const [tissue, setTissue] = useState<Tissue | "plasma">("plasma");
  const generation = useRef(0);
  const setMode = useStore((s) => s.setMode);
  const execute = useCallback(async (e: Experiment) => {
    const problems = experimentProblems(e);
    if (problems.length) { setError(problems.join(" ")); return; }
    const id = ++generation.current;
    cancelLane("toxicity"); setPlaying(false); setRunning(true); setError(""); setStage("Simulating your dose…");
    try {
      const selected = await call("twin", { cfg: animalConfig(e) }, undefined, "toxicity");
      if (id !== generation.current) return;
      setStage("Preparing the half-dose comparison…");
      const reference = await call("twin", { cfg: animalConfig(e, e.dose / 2) }, undefined, "toxicity");
      if (id !== generation.current) return;
      setResult({ experiment: { ...e }, selected: selected.treated, reference: reference.treated });
      setDay(e.days + e.recovery);
      setOrgan(ORGANS.find((o) => ARCHETYPES[e.compound]!.td[o]) ?? "liver");
      setSetupOpen(false);
    } catch (err) { if (id === generation.current && !(err instanceof CancelledError)) setError(err instanceof Error ? err.message : "Simulation failed. Try running the experiment again."); }
    finally { if (id === generation.current) setRunning(false); }
  }, []);
  const stop = useCallback(() => { generation.current++; cancelLane("toxicity"); }, []);
  useEffect(() => { void execute(DEFAULT_EXPERIMENT); return stop; }, [execute, stop]);
  useEffect(() => {
    if (!playing || !result) return;
    if (day >= result.selected.days) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setDay((d) => Math.min(d + 1, result.selected.days)), 450);
    return () => window.clearTimeout(timer);
  }, [playing, day, result]);
  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  const cancel = () => { stop(); setRunning(false); setStage(""); };
  const changeView = (next: View) => { setPlaying(false); setView(next); };
  const selectOrgan = (next: Organ) => { setOrgan(next); setTissue(next); };
  const problems = experimentProblems(draft);
  const stale = !!result && JSON.stringify(draft) !== JSON.stringify(result.experiment);
  const profile = ARCHETYPES[draft.compound]!;
  const outside = draft.dose / 2 < profile.tunedDoseRange[0] || draft.dose > profile.tunedDoseRange[1];
  const rows = result ? responseRows(result.experiment, result.selected, day) : [];
  const detail = result ? organResponse(result.experiment, result.selected, organ, day) : null;
  const halfDetail = result ? organResponse(result.experiment, result.reference, organ, day) : null;
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
    <header className="tox-header"><div><p className="eyebrow">A little curiosity. A deeper understanding.</p><h1>A living lesson.<br /><span>One virtual rat.</span></h1><p>Change the dose. Explore the organs. See the story unfold.</p></div>
      <button className="tox-lesson-link" onClick={() => setMode("learn")}><Icon name="design" /><span>New to pharmacokinetics?<b>Start with a guided lesson <span aria-hidden="true">↗</span></b></span></button>
    </header>
    <div className="tox-layout">
      <aside className={`panel tox-design${setupOpen ? " tox-design-open" : ""}`} aria-labelledby="experiment-design-title">
        <button className="tox-mobile-summary" aria-expanded={setupOpen} aria-controls="tox-experiment-fields" onClick={() => setSetupOpen(!setupOpen)}><span><b>{PROFILE_NAMES[draft.compound]}</b><small>{fmt(draft.dose)} mg/kg · {draft.days} days{draft.recovery > 0 ? ` + ${draft.recovery} recovery` : ""}</small></span><span>{setupOpen ? "Done" : "Edit experiment"} <span aria-hidden="true">{setupOpen ? "−" : "+"}</span></span></button>
        <div className="tox-design-heading"><p className="eyebrow">Your experiment</p><h2 id="experiment-design-title">Start with a question.</h2><p className="small muted">What happens when the dose changes?</p></div>
        <fieldset id="tox-experiment-fields" disabled={running}><legend className="sr-only">Experiment inputs</legend>
          <label className="field">Compound profile<select value={draft.compound} onChange={(ev) => { const compound = ev.target.value; setDraft({ ...draft, compound, dose: ARCHETYPES[compound]!.defaultDoseMgPerKg }); }}>{Object.entries(PROFILE_NAMES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
          <label className="field">Daily dose (mg/kg)<input type="number" min="0.01" max="2000" step="any" value={Number.isNaN(draft.dose) ? "" : draft.dose} onChange={(ev) => setDraft({ ...draft, dose: ev.target.value === "" ? NaN : Number(ev.target.value) })} /></label>
          <input className="tox-dose-slider" aria-label="Adjust daily dose" type="range" min={profile.defaultDoseMgPerKg / 10} max={Math.min(2000, profile.defaultDoseMgPerKg * 3)} step={profile.defaultDoseMgPerKg / 10} value={Number.isFinite(draft.dose) ? Math.min(profile.defaultDoseMgPerKg * 3, draft.dose) : profile.defaultDoseMgPerKg} onChange={(ev) => setDraft({ ...draft, dose: Number(ev.target.value) })} />
          <div className="tox-presets" aria-label="Dose presets">{[0.5, 1, 2].map((m, i) => <button key={m} aria-pressed={draft.dose === profile.defaultDoseMgPerKg * m} onClick={() => setDraft({ ...draft, dose: profile.defaultDoseMgPerKg * m })}>{["Half", "Baseline", "Double"][i]}</button>)}</div>
          <label className="field">Dosing duration<select value={draft.days} onChange={(ev) => setDraft({ ...draft, days: Number(ev.target.value) })}>{[7, 14, 28, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
          <details className="tox-advanced"><summary>More options</summary><div>
            <label className="field">Recovery after dosing<select value={draft.recovery} onChange={(ev) => setDraft({ ...draft, recovery: Number(ev.target.value) })}>{[0, 7, 14].map((d) => <option key={d} value={d}>{d === 0 ? "No recovery period" : `${d} days without dosing`}</option>)}</select></label>
            <div className="tox-field-pair"><label className="field">Route<select value={draft.route} onChange={(ev) => setDraft({ ...draft, route: ev.target.value as "oral" | "iv" })}><option value="oral">Oral</option><option value="iv">IV bolus</option></select></label><label className="field">Sex<select value={draft.sex} onChange={(ev) => setDraft({ ...draft, sex: ev.target.value as "M" | "F" })}><option value="M">Male</option><option value="F">Female</option></select></label></div>
            <label className="field">Animal seed<input type="number" min="0" max="2147483647" value={Number.isNaN(draft.seed) ? "" : draft.seed} onChange={(ev) => setDraft({ ...draft, seed: ev.target.value === "" ? NaN : Number(ev.target.value) })} /></label>
            <p className="small muted">Same seed = same virtual animal. Sprague–Dawley, 8 weeks at baseline. Once-daily dosing; no disease overlay.</p>
          </div></details>
        </fieldset>
        {outside && <p className="tox-note">A comparison dose is outside the teaching range ({profile.tunedDoseRange.join("–")} mg/kg/day). Treat these results as extrapolations.</p>}
        {problems.length > 0 && <p className="tox-note" role="alert">{problems.join(" ")}</p>}
        <button className="primary tox-run" disabled={running || problems.length > 0} onClick={() => void execute({ ...draft })}>{running ? "Running experiment…" : "Run experiment"}{!running && <Icon name="arrow" />}</button>
        {running && <><p role="status" className="small muted">{stage}</p><button onClick={cancel}>Cancel run</button></>}
        {error && <p role="alert" className="tox-note">{error}</p>}
        <p className="tox-design-foot">Every run includes a matched half-dose comparison.</p>
      </aside>
      <div className="tox-results" aria-busy={running}>
        <nav className="tox-steps" aria-label="Explore your experiment">{([ ["explore", "Explore the rat", "animal"], ["exposure", "Compare exposure", "data"], ["translate", "Translate the dose", "arrow"] ] as const).map(([key, label, icon], i) => <button key={key} aria-pressed={view === key} aria-controls="tox-workspace" disabled={!result} onClick={() => changeView(key)}><span className="tox-step-number">0{i + 1}</span><Icon name={icon} /><span>{label}</span></button>)}</nav>
        {stale && <div className="tox-pending" role="status"><Icon name="design" /><span>Ready for a new experiment. The results still show {PROFILE_NAMES[result!.experiment.compound]} at {fmt(result!.experiment.dose)} mg/kg/day. <b>Run to update.</b></span></div>}
        {result && current && lower ? <div id="tox-workspace" className="tox-workspace">
          <div className="tox-run-context"><span>{PROFILE_NAMES[result.experiment.compound]}</span><span>{fmt(selectedDose)} mg/kg daily</span><span>{result.experiment.days} dosing days{result.experiment.recovery > 0 ? ` + ${result.experiment.recovery} recovery` : ""}</span></div>
          <section hidden={view !== "explore"} className="panel tox-organ-panel" aria-labelledby="organ-results-title">
            <div className="tox-section-heading"><div><p className="eyebrow">Look closer</p><h2 id="organ-results-title">Small changes. Visible responses.</h2></div><span className="tox-pill">Fictional teaching profile</span></div>
            <RatExplorer experiment={result.experiment} animal={current} day={day} selected={organ} onSelect={selectOrgan} />
            <div className="tox-timeline">
              <button className="tox-play" disabled={running} onClick={() => { if (playing) setPlaying(false); else { if (day >= current.days) setDay(0); setPlaying(true); } }} aria-label={playing ? "Pause timeline" : "Play timeline"}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">{playing ? <path d="M4 3h3v10H4zm5 0h3v10H9z" /> : <path d="M5 3l8 5-8 5z" />}</svg></button>
              <div><label htmlFor="tox-day">Inspect day <strong>{day}</strong><span> / {current.days}</span></label><input id="tox-day" type="range" min="0" max={current.days} step="1" value={day} onChange={(ev) => { setPlaying(false); setDay(Number(ev.target.value)); }} /></div>
              <span className="tox-period">{day === 0 ? "Before first dose" : day > result.experiment.days ? "Recovery period" : day === result.experiment.days && result.experiment.recovery > 0 ? "End of dosing" : "Dosing period"}</span>
            </div>
            <div className="tox-organ-cards" role="group" aria-label="Organ responses">{rows.map((r) => <button key={r.organ} aria-pressed={organ === r.organ} onClick={() => selectOrgan(r.organ)} className="tox-organ-card" style={{ "--organ-color": r.grade === null ? "var(--muted)" : gradeVar(r.grade) } as React.CSSProperties}><span><i />{ORGAN_LABEL[r.organ]}</span><b>{r.severity}</b></button>)}</div>
            <div className="tox-detail"><div><p className="eyebrow">{ORGAN_LABEL[organ]} · Day {day}</p><h3>{detail?.severity}</h3><p>{detail?.modeled ? ORGAN_LESSON[organ] : "This profile simulates exposure here, but has no injury mechanism for this organ. “Not modeled” does not establish safety."}</p></div><div className="tox-dose-response"><span>At your dose<b>{detail?.severity}</b></span><span>At half dose<b>{halfDetail?.severity}</b></span></div></div>
            <details className="tox-science"><summary>What do the colors mean?</summary><p>Cards and the organ map use color for the illustrative injury grade. Gray means injury is not modeled. In 3D, the selected organ is highlighted for navigation; organ shape, appearance, and motion are illustrations, not observations of a real animal.</p><p>{ORGAN_LABEL[organ]}: {detail?.modeled ? `grade ${detail.grade} / 5; injury index ${fmt(detail.damage)}. First mild injury over the whole run: ${detail.firstMildDay === null ? "not reached" : `day ${detail.firstMildDay}`}.` : "not assessed for injury in this profile."} The index is an internal model state, not a probability or percentage of tissue destroyed. Lung, spleen, muscle, and fat have exposure compartments only.</p></details>
            <button className="tox-next" onClick={() => changeView("exposure")}>Why does the dose matter? <Icon name="arrow" /></button>
          </section>
          {view === "exposure" && <>
            <section className="panel tox-plot" aria-labelledby="pk-title"><div className="tox-section-heading"><div><p className="eyebrow">Follow the compound</p><h2 id="pk-title">A dose becomes a curve.</h2></div></div>
              <p className="tox-section-intro">The curve shows how much compound is present over time. Compare your dose with half the dose in the same virtual animal.</p>
              <div className="tox-chart-controls"><div className="field"><label htmlFor="tox-concentration">Concentration</label><select id="tox-concentration" value={tissue} onChange={(ev) => setTissue(ev.target.value as Tissue | "plasma")}><option value="plasma">Blood plasma</option>{ORGANS.map((o) => <option key={o} value={o}>{ORGAN_LABEL[o]}</option>)}<option value="lung">Lung (exposure only)</option><option value="fat">Adipose (exposure only)</option></select></div><div className="field"><label htmlFor="tox-window">Time window</label><select id="tox-window" value={windowMode} onChange={(ev) => setWindowMode(ev.target.value as "all" | "first")}><option value="first">First 24 hours</option><option value="all">Whole experiment</option></select></div></div>
              <LineChart label="Dose comparison: concentration over time" height={280} xLabel="Time after first dose (h)" yLabel="Concentration (mg/L)" xMin={0} xMax={windowMode === "first" ? 24 : current.days * 24} yMin={0} marker={windowMode === "all" ? day * 24 : undefined} shade={result.experiment.recovery > 0 && windowMode === "all" ? [[result.experiment.days * 24, current.days * 24]] : undefined} series={[{ name: `${fmt(selectedDose / 2)} mg/kg/day`, x: lower.hoursH.filter((h) => windowMode === "all" || h <= 24), y: (tissue === "plasma" ? lower.plasma : lower.tissue[tissue]).slice(0, windowMode === "first" ? 25 : undefined), color: "var(--c2)", dash: "6 4" }, { name: `${fmt(selectedDose)} mg/kg/day`, x: current.hoursH.filter((h) => windowMode === "all" || h <= 24), y: (tissue === "plasma" ? current.plasma : current.tissue[tissue]).slice(0, windowMode === "first" ? 25 : undefined), color: "var(--accent)" }]} />
              <div className="tox-metrics"><div><span>Peak in blood (Cmax)</span><strong>{fmt(current.pk.cmax)} <small>mg/L</small></strong><p>Half dose: {fmt(lower.pk.cmax)} mg/L</p></div><div><span>Total blood exposure (AUC)</span><strong>{fmt(current.pk.aucAll)} <small>mg·h/L</small></strong><p>Half dose: {fmt(lower.pk.aucAll)} mg·h/L</p></div></div>
              <p className="small muted">Summary values cover all {current.days} days. Curves show hourly samples; summaries use the 0.25 h solver grid. Shading marks recovery without further dosing. Injury can alter clearance, so exposure may not scale exactly with dose.</p>
            </section>
            <section className="panel tox-plot"><div className="tox-section-heading"><div><p className="eyebrow">Exposure meets response</p><h2>{ORGAN_LABEL[organ]} over the study.</h2></div><label className="field">Response organ<select value={organ} onChange={(e) => selectOrgan(e.target.value as Organ)}>{ORGANS.map((o) => <option key={o} value={o}>{ORGAN_LABEL[o]}</option>)}</select></label></div>
              {detail?.modeled ? <LineChart label={`${ORGAN_LABEL[organ]} modeled injury over days`} height={220} xLabel="Study day" yLabel="Modeled injury index (0–1)" xMin={0} xMax={current.days} yMin={0} yMax={1} marker={day} shade={result.experiment.recovery > 0 ? [[result.experiment.days, current.days]] : undefined} series={[{ name: "Half dose", x: dailyX(lower), y: lower.daily.damage[organ], color: "var(--c2)", dash: "6 4" }, { name: "Your dose", x: dailyX(current), y: current.daily.damage[organ], color: "var(--accent)" }]} /> : <p className="tox-note">No injury mechanism is parameterized for {ORGAN_LABEL[organ].toLowerCase()} in this profile. Inspect the exposure curve or choose another profile.</p>}
              <p className="small muted">The injury index describes this model’s state; it does not measure tissue loss or toxicity probability. Recovery follows the profile’s assumed repair rates.</p>
              <button className="tox-next" onClick={() => changeView("translate")}>How does dose translation work? <Icon name="arrow" /></button>
            </section>
          </>}
          <div hidden={view !== "translate"}><HumanEquivalent dose={selectedDose} /></div>
          <details className="panel tox-notebook"><summary>Experiment notes & downloads</summary><div className="tox-notebook-content"><p>Keep the completed run for a report or class discussion. Downloads include the settings, model version, and simulation data.</p><div className="tox-export"><button onClick={exportRun}>Export results (JSON)</button><button onClick={downloadPk}>Export PK data (CSV)</button></div><h3>Model & assumptions</h3><p>Fictional compound parameters drive a compartmental PBPK and injury–repair engine. This model has not been validated against real animal data. No real-compound prediction, NOAEL determination, or human safety assessment is made.</p><p>Both arms use seed {result.experiment.seed}, {result.experiment.sex === "M" ? "male" : "female"} Sprague–Dawley physiology at 8 weeks, once-daily {result.experiment.route} dosing for {result.experiment.days} days, and {result.experiment.recovery} recovery days. One virtual animal does not estimate population variability.</p><p>The simulation continues through its scheduled duration even if a modeled humane-endpoint signal occurs. This is not a protocol for continuing a live-animal experiment. Model version {SIM_VERSION}. Injury is sampled daily; PK is displayed hourly.</p></div></details>
        </div> : <section id="tox-workspace" className="panel tox-loading"><div className="tox-loading-orbit" aria-hidden="true"><Icon name="animal" size={48} /></div><p className="eyebrow">Your first experiment</p><h2>A little science is taking shape.</h2><p>{running ? stage : error ? "Adjust the inputs or retry the experiment." : "Run an experiment to explore your virtual rat."}</p></section>}
      </div>
    </div>
    <p className="tox-page-foot">Made for curiosity. Built for learning. <span>Fictional compounds · Educational simulation</span></p>
  </main>;
}

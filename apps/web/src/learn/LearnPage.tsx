import { useEffect, useState } from "react";
import { LineChart } from "../components/Chart";
import { download } from "../lib/export";
import { toCsv } from "../lib/csv";
import { BASE, EXPERIMENTS, MODEL_VERSION, QUESTIONS, simulate, type Prediction, type Regimen } from "./model";
import { emptyNotebook, parseNotebook, reportHtml, STORAGE_KEY, type Notebook } from "./notebook";

function loadNotebook() { try { return parseNotebook(localStorage.getItem(STORAGE_KEY)); } catch { return emptyNotebook(); } }
const format = (n: number) => n.toFixed(2);
const regimenText = (r: Regimen) => `${r.dose} mg/kg ${r.repeated ? `every ${r.interval} h` : "once"}; clearance ${r.clearance} L/h/kg`;

export function LearnPage() {
  const [notebook, setNotebook] = useState<Notebook>(loadNotebook);
  const [index, setIndex] = useState(0);
  const [prediction, setPrediction] = useState<Prediction | "">("");
  const [storageOk, setStorageOk] = useState(true);
  const [reset, setReset] = useState(false);
  const exp = EXPERIMENTS[index]!;
  const entry = notebook.entries[exp.id];
  const control = simulate(exp.control), changed = simulate(exp.treatment);
  const completed = EXPERIMENTS.filter((e) => notebook.entries[e.id]?.reflection.trim()).length;
  const allRun = EXPERIMENTS.every((e) => notebook.entries[e.id]);
  const allAnswered = QUESTIONS.every((_, i) => Number.isInteger(notebook.answers[i]) && notebook.answers[i]! >= 0);
  const score = QUESTIONS.filter((q, i) => notebook.answers[i] === q.correct).length;

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notebook)); setStorageOk(true); } catch { setStorageOk(false); } }, [notebook]);
  const selectExperiment = (next: number) => { setIndex(next); setPrediction(""); requestAnimationFrame(() => { document.getElementById("experiment-title")?.focus({ preventScroll: true }); document.getElementById("experiment-workspace")?.scrollIntoView({ block: "start" }); }); };
  const setReflection = (reflection: string) => setNotebook((n) => ({ ...n, entries: { ...n.entries, [exp.id]: { ...n.entries[exp.id]!, reflection } } }));
  const run = () => { if (prediction) setNotebook((n) => ({ ...n, entries: { ...n.entries, [exp.id]: { prediction, reflection: "" } } })); };
  const exportCsv = () => download(`vast-${exp.id}-simulated.csv`, toCsv(control.times.map((time, i) => ({ model: MODEL_VERSION, evidence: "simulated-fictional", experiment: exp.id, time_h: time, control_mg_L: control.values[i], changed_mg_L: changed.values[i], control_dose_mg_kg: exp.control.dose, changed_dose_mg_kg: exp.treatment.dose, control_clearance_L_h_kg: exp.control.clearance, changed_clearance_L_h_kg: exp.treatment.clearance, control_interval_h: exp.control.repeated ? exp.control.interval : null, changed_interval_h: exp.treatment.repeated ? exp.treatment.interval : null, bioavailability: 0.8, volume_L_kg: 1, absorption_per_h: 1 }))), "text/csv;charset=utf-8");

  return <main id="main" className="learn-page">
    <header className="learn-hero">
      <div><p className="eyebrow">VAST classroom · Practical 01</p><h1>Same dose.<br /><span>Different exposure.</span></h1><p className="learn-intro">Think like an experimental scientist. Make a prediction, change one variable, and use the evidence to explain what happens.</p>
        <div className="learn-tags"><span>35–45 minutes</span><span>Undergraduate biotechnology</span><span>No live animals</span></div>
      </div>
      <details className="panel learn-objectives"><summary>What you’ll learn</summary><ol><li>Distinguish dose from concentration and exposure.</li><li>Explain how clearance affects half-life.</li><li>Interpret repeated dosing without confusing dose rate with elimination.</li></ol><p className="small muted">Prerequisites: units, ratios, and reading a line graph. Work individually or in pairs.</p></details>
    </header>
    <details className="learn-notice"><summary>About this teaching model</summary><p>This practical uses a fictional compound in a simple, linear, one-compartment model. Its curves illustrate PK relationships; they are not measured rat data or toxicity predictions. The exploratory Lab uses a separate, more detailed model.</p></details>
    <section className="learn-toolbar" aria-label="Notebook tools">
      <div><b>{completed} / 3 reflections recorded</b><p className="small muted" role="status">{storageOk ? "Saved in this browser only. On shared computers, download your work and clear the notebook when finished." : "Browser storage is unavailable. Download your notebook before leaving this page."}</p></div>
      <div className="learn-actions"><button onClick={() => download("vast-practical-notebook.html", reportHtml(notebook), "text/html;charset=utf-8")}>Download notebook</button><button onClick={() => setReset(!reset)}>Clear notebook</button></div>
      {reset && <div className="learn-reset" role="group" aria-label="Confirm notebook reset"><p>Clear predictions, reflections, and answers on this browser? Download your work first.</p><button onClick={() => { setNotebook(emptyNotebook()); setPrediction(""); setReset(false); }}>Clear all my work</button><button onClick={() => setReset(false)}>Keep my work</button></div>}
    </section>
    <nav className="learn-experiments" aria-label="Practical experiments">{EXPERIMENTS.map((e, i) => <button key={e.id} aria-current={index === i ? "step" : undefined} onClick={() => selectExperiment(i)}><span className="learn-number">0{i + 1}</span><span><b>{e.title}</b><small>{notebook.entries[e.id]?.reflection.trim() ? "Reflection recorded" : notebook.entries[e.id] ? "Experiment run · reflect next" : "Predict → experiment → explain"}</small></span></button>)}</nav>
    <section id="experiment-workspace" className="learn-workspace" aria-label={exp.title}>
      <div className="panel learn-predict"><p className="eyebrow">01 · Predict</p><h2 id="experiment-title" tabIndex={-1}>{exp.title}</h2><p>{exp.question}</p>
        <dl className="learn-regimens"><dt>Control</dt><dd>{regimenText(exp.control)}</dd><dt>Changed condition</dt><dd>{regimenText(exp.treatment)}</dd></dl>
        <p className="small muted">Held constant: bioavailability 0.8; distribution volume 1 L/kg; absorption rate 1/h; observation window 72 h. All are teaching assumptions.</p>
        <fieldset disabled={!!entry}><legend>Your prediction</legend>{(["higher", "same", "lower"] as const).map((p) => <label key={p}><input type="radio" name={`prediction-${exp.id}`} value={p} checked={(entry?.prediction ?? prediction) === p} onChange={() => setPrediction(p)} />{p === "higher" ? "It increases" : p === "lower" ? "It decreases" : "It stays the same"}</label>)}</fieldset>
        {!entry ? <><button className="primary" onClick={run} disabled={!prediction}>Run comparison</button><p className="small muted">Record a prediction to reveal the result. A wrong prediction is a useful starting point.</p></> : <p className="learn-feedback" role="status">{entry.prediction === exp.answer ? "Your prediction matches this model." : "The result differs from your prediction. Compare the evidence below."} Your initial prediction is retained in the notebook.</p>}
      </div>
      <div className="panel learn-result"><p className="eyebrow">02 · Experiment</p><h2>Follow the concentration</h2>
        {entry ? <>
          <LineChart label={`${exp.title}: simulated concentration comparison`} xLabel="Time (h)" yLabel="Concentration (mg/L)" height={280} xMin={0} xMax={72} yMin={0} series={[{ name: "Control", x: control.times, y: control.values, color: "var(--c2)", dash: "6 4" }, { name: "Changed condition", x: changed.times, y: changed.values, color: "var(--accent)" }]} />
          <div className="learn-table"><table><caption>Simulated results over 0–72 hours</caption><thead><tr><th scope="col">Measure</th><th scope="col">Control</th><th scope="col">Changed</th></tr></thead><tbody>
            <tr><th scope="row">AUC (mg·h/L)</th><td>{format(control.auc)}</td><td>{format(changed.auc)}</td></tr>
            <tr><th scope="row">Sampled peak (mg/L)</th><td>{format(control.peak)}</td><td>{format(changed.peak)}</td></tr>
            <tr><th scope="row">Elimination half-life (h)</th><td>{format(control.halfLife)}</td><td>{format(changed.halfLife)}</td></tr>
            <tr><th scope="row">Total administered (mg/kg)</th><td>{control.totalDose}</td><td>{changed.totalDose}</td></tr>
            {control.steadyAverage !== null && changed.steadyAverage !== null && <tr><th scope="row">Theoretical steady-state average (mg/L)</th><td>{format(control.steadyAverage)}</td><td>{format(changed.steadyAverage)}</td></tr>}
          </tbody></table></div>
          <p className="small muted">AUC ratio (changed / control): <b>{format(changed.auc / control.auc)}×</b>. AUC is integrated analytically; peak is sampled every 0.1 h. Repeated doses occur before, not at, 72 h. Steady-state average assumes dosing continues indefinitely.</p>
          <button onClick={exportCsv}>Download comparison CSV</button>
        </> : <div className="learn-empty"><svg viewBox="0 0 100 60" width="100" height="60" aria-hidden="true"><path d="M5 50 C20 50 20 8 35 8 S55 48 95 50" fill="none" stroke="currentColor" strokeWidth="3" /></svg><p>Your experiment starts with a prediction.</p><p className="small muted">Choose an answer, then run both conditions together.</p></div>}
      </div>
    </section>
    {entry && <section className="panel learn-reflect" aria-labelledby="reflection-title"><p className="eyebrow">03 · Explain</p><h2 id="reflection-title">What does the evidence tell you?</h2><p>{exp.insight}</p><label className="field" htmlFor="reflection">{exp.prompt}<textarea id="reflection" rows={4} maxLength={4000} value={entry.reflection} onChange={(e) => setReflection(e.target.value)} placeholder="Write your explanation using a result from the experiment…" /></label><p className="small muted">Reflections are saved for discussion with your instructor; they are not automatically marked.</p>{index < EXPERIMENTS.length - 1 && <button className="primary" onClick={() => selectExperiment(index + 1)}>Next experiment</button>}</section>}
    <section className="panel learn-assessment" aria-labelledby="assessment-title"><p className="eyebrow">04 · Apply</p><h2 id="assessment-title">Check your understanding</h2><p>Apply the relationships to a new situation. This is formative practice, not a graded examination.</p>
      {!allRun ? <p className="learn-notice">Run all three experiments to unlock the knowledge check.</p> : <>
        {QUESTIONS.map((q, i) => <fieldset key={q.question} disabled={notebook.submitted}><legend>{i + 1}. {q.question}</legend>{q.options.map((option, j) => <label key={option}><input type="radio" name={`quiz-${i}`} checked={notebook.answers[i] === j} onChange={() => setNotebook((n) => { const answers = [...n.answers]; answers[i] = j; return { ...n, answers }; })} />{option}</label>)}{notebook.submitted && <p className="learn-feedback">{notebook.answers[i] === q.correct ? "Correct. " : "Revisit this idea. "}{q.explanation}</p>}</fieldset>)}
        {!notebook.submitted ? <button className="primary" disabled={!allAnswered} onClick={() => setNotebook((n) => ({ ...n, submitted: true }))}>Check answers</button> : <div role="status"><h3>{score} / {QUESTIONS.length} answers correct</h3><p>{completed === 3 ? "Your practical notebook is complete. Download it for your records or class discussion." : "Return to the experiments to finish your reflections, then download your notebook."}</p><button onClick={() => setNotebook((n) => ({ ...n, answers: [], submitted: false }))}>Try the knowledge check again</button></div>}
      </>}
    </section>
    <div className="learn-resources">
      <details className="panel"><summary>Model, equations & glossary</summary><p><b>Dose</b> is administered mass per body weight. <b>Concentration</b> is mass per fluid volume. <b>AUC</b> is the area under the concentration–time curve. <b>Clearance</b> is the apparent volume cleared per time, not the mass eliminated per time.</p><p>k = CL / V; half-life = ln(2) / k. For a single oral dose, C(t) = F × D × ka / [V × (ka − k)] × [exp(−kt) − exp(−ka·t)]. Repeated-dose concentrations are the sum of single-dose contributions.</p><p>Single-dose AUC to infinity = F × D / CL. At steady state, average concentration = F × D / (CL × dosing interval). The plotted AUC stops at 72 h.</p><p>Assumptions: instantaneous mixing within one compartment, first-order absorption and elimination, fixed parameters, and no variability, disease, metabolites, saturation, or toxicity threshold. This is separate from the exploratory Lab’s PBPK engine.</p><p>Model version: <code>{MODEL_VERSION}</code>. Reference for broader model-building context: Kuepfer et al. (2016), “Applied Concepts in PBPK Modeling: How to Build a PBPK/PD Model,” <i>CPT: Pharmacometrics & Systems Pharmacology</i>. <a href="https://doi.org/10.1002/psp4.12134" target="_blank" rel="noreferrer">DOI: 10.1002/psp4.12134</a>. The numerical parameters here are invented for teaching, not taken from that paper.</p></details>
      <details className="panel"><summary>Instructor guide & printable worksheet</summary><p><b>Suggested session:</b> 5 minutes on dose versus exposure; 20 minutes for paired experiments; 10 minutes for reflection and assessment; 5–10 minutes for discussion.</p><p><b>Answer guide:</b> doubling dose doubles AUC; halving clearance doubles half-life; shortening the interval leaves half-life unchanged while increasing dose rate. Ask students to distinguish AUC to infinity from a finite observation window.</p><p><b>Reflection rubric (0–2 each):</b> identifies the controlled variable; cites a numerical result; correctly explains the mechanism; states a relevant assumption or limitation. Award 0 for absent/incorrect, 1 for partial, 2 for accurate. This suggested rubric has not been evaluated with learners.</p><p><b>Discussion:</b> how would you compare intervals at equal daily dose? What additional evidence would be needed for real animal predictions? Could a concentration curve alone establish toxicity?</p><p>This guide is openly available to students too. No account, submission server, or hidden answer key is provided. On a shared device, each learner should export and clear their notebook. Classroom learning outcomes have not yet been evaluated.</p><button onClick={() => download("vast-student-worksheet.html", reportHtml(emptyNotebook()).replace("<h2>Knowledge check</h2>", `<h2>Worksheet prompts</h2>${EXPERIMENTS.map((e) => `<h3>${e.title}</h3><p>${e.question}</p><p>${e.prompt}</p><p>Prediction: ____________________<br>Evidence: ____________________<br>Explanation: ____________________</p>`).join("")}<h2>Knowledge check</h2>`), "text/html;charset=utf-8")}>Download blank worksheet</button><p className="small muted">Open the downloaded HTML file and use your browser’s Print command to save a PDF or print a copy.</p></details>
    </div>
    <p className="small muted">VAST · Virtual Animal Studies for Toxicology. Teaching model baseline: {BASE.dose} mg/kg, clearance {BASE.clearance} L/h/kg. No personal details are required.</p>
  </main>;
}
